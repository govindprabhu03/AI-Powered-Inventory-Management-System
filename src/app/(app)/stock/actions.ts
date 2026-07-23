"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canRecordStock } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  recordMovementSchema,
  MOVEMENT_DIRECTION,
  type StockMutationResult,
} from "@/lib/validation/stock";
import { transferSchema } from "@/lib/validation/transfer";

/**
 * Post one movement to the ledger.
 *
 * Note how little this does: validate, derive the sign, insert one row. The
 * trigger owns everything difficult — updating the level, refusing negative
 * stock, keeping cache and ledger transactional. The app can't get it wrong
 * because the app isn't the one doing it.
 */
export async function recordMovement(
  values: unknown,
): Promise<StockMutationResult> {
  const parsed = recordMovementSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await requireContext();
  if (!canRecordStock(ctx.activeOrg.role)) {
    return { ok: false, error: "You do not have permission to record stock." };
  }

  const { productId, warehouseId, movementType, quantity, note } = parsed.data;

  // Type decides direction; adjustments carry their own sign.
  const direction = MOVEMENT_DIRECTION[movementType];
  const signed = direction === 0 ? quantity : direction * Math.abs(quantity);

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    org_id: ctx.activeOrg.orgId,
    product_id: productId,
    warehouse_id: warehouseId,
    movement_type: movementType,
    quantity: signed,
    note: note ?? null,
  });

  if (error) {
    // The trigger's friendly errors (insufficient stock, wrong org) come
    // through as the message; surface them as-is.
    return { ok: false, error: error.message };
  }

  revalidatePath("/stock");
  return { ok: true };
}

/**
 * Look up a product by scanned code — barcode first, then SKU, since our
 * printed labels encode the barcode when present and fall back to the SKU.
 */
export async function lookupProductByCode(code: string): Promise<
  | { ok: true; product: { id: string; name: string; sku: string } }
  | { ok: false; error: string }
> {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 100) {
    return { ok: false, error: "Invalid code" };
  }

  const ctx = await requireContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("org_id", ctx.activeOrg.orgId)
    .eq("is_archived", false)
    .or(`barcode.eq.${sanitizeForFilter(trimmed)},sku.eq.${sanitizeForFilter(trimmed)}`)
    .limit(1);

  const product = data?.[0];
  if (!product) {
    return { ok: false, error: `No product matches “${trimmed}”` };
  }
  return { ok: true, product };
}

/** PostgREST .or() treats commas/parens as syntax; strip them from user input. */
function sanitizeForFilter(v: string) {
  return v.replace(/[,()"]/g, "");
}

/**
 * Move stock between warehouses.
 *
 * One RPC call — record_stock_transfer() posts the out and in legs inside a
 * single database transaction, so a failure (e.g. insufficient stock at the
 * source) rolls back BOTH. The app never has the chance to half-complete it.
 */
export async function transferStock(
  values: unknown,
): Promise<StockMutationResult> {
  const parsed = transferSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ctx = await requireContext();
  if (!canRecordStock(ctx.activeOrg.role)) {
    return { ok: false, error: "You do not have permission to transfer stock." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_transfer", {
    p_product_id: parsed.data.productId,
    p_from_warehouse: parsed.data.fromWarehouseId,
    p_to_warehouse: parsed.data.toWarehouseId,
    p_quantity: parsed.data.quantity,
    p_note: parsed.data.note ?? undefined,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/stock");
  return { ok: true };
}

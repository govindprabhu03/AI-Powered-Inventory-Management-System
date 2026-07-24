"use server";

import { revalidatePath } from "next/cache";

import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  createPurchaseOrderSchema,
  type OrderMutationResult,
} from "@/lib/validation/purchase-order";

/**
 * These actions are deliberately thin. All the workflow rules — role checks,
 * legal transitions, stock effects — live in the SECURITY DEFINER functions.
 * Each action validates input, calls one RPC, and surfaces the DB's message.
 */

export async function createPurchaseOrder(
  values: unknown,
): Promise<OrderMutationResult> {
  const parsed = createPurchaseOrderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  await requireContext(); // ensure signed in; the RPC does the role check

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_supplier_id: parsed.data.supplierId,
    p_warehouse_id: parsed.data.warehouseId,
    p_items: parsed.data.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      unit_cost: i.unitCost,
    })),
    p_notes: parsed.data.notes ?? undefined,
    p_expected_date: parsed.data.expectedDate ?? undefined,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/purchases");
  return { ok: true, id: (data as { id: string }).id };
}

async function transition(
  rpc:
    | "submit_purchase_order"
    | "approve_purchase_order"
    | "receive_purchase_order"
    | "cancel_purchase_order",
  id: string,
): Promise<OrderMutationResult> {
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/purchases");
  revalidatePath(`/purchases/${id}`);
  revalidatePath("/stock");
  return { ok: true };
}

// Every export in a "use server" module must be an async function — arrow
// consts are stripped by the compiler and won't be found by importers.
export async function submitPurchaseOrder(id: string) {
  return transition("submit_purchase_order", id);
}
export async function approvePurchaseOrder(id: string) {
  return transition("approve_purchase_order", id);
}
export async function receivePurchaseOrder(id: string) {
  return transition("receive_purchase_order", id);
}
export async function cancelPurchaseOrder(id: string) {
  return transition("cancel_purchase_order", id);
}

export async function setPurchasePayment(
  id: string,
  status: "unpaid" | "partial" | "paid",
): Promise<OrderMutationResult> {
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_payment_status", {
    p_id: id,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/purchases/${id}`);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";

import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  createSalesOrderSchema,
  type SalesMutationResult,
} from "@/lib/validation/sales-order";

/**
 * Thin actions over the workflow RPCs. All the intelligence — reserving stock,
 * checking availability, releasing on fulfil/cancel, guarding returns — lives
 * in the SECURITY DEFINER functions. Every export here is an async function
 * (required in a "use server" module).
 */

export async function createSalesOrder(
  values: unknown,
): Promise<SalesMutationResult> {
  const parsed = createSalesOrderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  await requireContext();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sales_order", {
    p_customer_id: parsed.data.customerId,
    p_warehouse_id: parsed.data.warehouseId,
    p_items: parsed.data.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    })),
    p_notes: parsed.data.notes ?? undefined,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/sales");
  return { ok: true, id: (data as { id: string }).id };
}

async function transition(
  rpc:
    | "confirm_sales_order"
    | "fulfil_sales_order"
    | "cancel_sales_order",
  id: string,
): Promise<SalesMutationResult> {
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/stock");
  return { ok: true };
}

export async function confirmSalesOrder(id: string) {
  return transition("confirm_sales_order", id);
}
export async function fulfilSalesOrder(id: string) {
  return transition("fulfil_sales_order", id);
}
export async function cancelSalesOrder(id: string) {
  return transition("cancel_sales_order", id);
}

export async function returnSalesOrderItems(
  id: string,
  items: { productId: string; quantity: number }[],
): Promise<SalesMutationResult> {
  await requireContext();
  const clean = items.filter((i) => i.quantity > 0);
  if (clean.length === 0) {
    return { ok: false, error: "Enter a quantity to return." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_sales_order_items", {
    p_id: id,
    p_items: clean.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
    })),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sales/${id}`);
  revalidatePath("/stock");
  return { ok: true };
}

export async function setSalesPayment(
  id: string,
  status: "unpaid" | "partial" | "paid",
): Promise<SalesMutationResult> {
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_sales_payment_status", {
    p_id: id,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sales/${id}`);
  return { ok: true };
}

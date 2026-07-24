"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canManageSales } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  customerSchema,
  type CustomerMutationResult,
} from "@/lib/validation/customer";

async function authorize() {
  const ctx = await requireContext();
  return { ctx, allowed: canManageSales(ctx.activeOrg.role) };
}

function toRow(v: ReturnType<typeof customerSchema.parse>, orgId: string) {
  return {
    org_id: orgId,
    name: v.name,
    email: v.email ?? null,
    phone: v.phone ?? null,
    address: v.address ?? null,
  };
}

export async function createCustomer(
  values: unknown,
): Promise<CustomerMutationResult> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "You do not have permission." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert(toRow(parsed.data, ctx.activeOrg.orgId))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { name: ["A customer with this name already exists."] } };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/customers");
  return { ok: true, id: data.id };
}

export async function updateCustomer(
  id: string,
  values: unknown,
): Promise<CustomerMutationResult> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "You do not have permission." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update(toRow(parsed.data, ctx.activeOrg.orgId))
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { name: ["A customer with this name already exists."] } };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/customers");
  return { ok: true, id: data.id };
}

export async function deleteCustomer(id: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();
  // sales_orders.customer_id is ON DELETE RESTRICT, so a customer with orders
  // can't be deleted — that error surfaces to the user.
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "This customer has orders and cannot be deleted." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/customers");
  return { ok: true };
}

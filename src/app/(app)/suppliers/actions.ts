"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  supplierSchema,
  type SupplierMutationResult,
} from "@/lib/validation/supplier";

async function authorize() {
  const ctx = await requireContext();
  return { ctx, allowed: canEditCatalog(ctx.activeOrg.role) };
}

function toRow(v: ReturnType<typeof supplierSchema.parse>, orgId: string) {
  return {
    org_id: orgId,
    company_name: v.companyName,
    contact_person: v.contactPerson ?? null,
    email: v.email ?? null,
    phone: v.phone ?? null,
    gst_number: v.gstNumber ?? null,
    address: v.address ?? null,
  };
}

export async function createSupplier(
  values: unknown,
): Promise<SupplierMutationResult> {
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "You do not have permission." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert(toRow(parsed.data, ctx.activeOrg.orgId))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { companyName: ["A supplier with this name already exists."] } };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/suppliers");
  return { ok: true, id: data.id };
}

export async function updateSupplier(
  id: string,
  values: unknown,
): Promise<SupplierMutationResult> {
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "You do not have permission." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .update(toRow(parsed.data, ctx.activeOrg.orgId))
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { companyName: ["A supplier with this name already exists."] } };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/suppliers");
  return { ok: true, id: data.id };
}

export async function deleteSupplier(id: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();
  // products.supplier_id is ON DELETE SET NULL, so products survive as
  // "no supplier" rather than being deleted with it.
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { isOrgMember } from "@/lib/data/members";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import {
  warehouseSchema,
  type WarehouseMutationResult,
} from "@/lib/validation/warehouse";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Insert"];

async function authorize() {
  const ctx = await requireContext();
  return { ctx, allowed: canEditCatalog(ctx.activeOrg.role) };
}

async function buildRow(
  values: unknown,
  orgId: string,
): Promise<
  | { ok: true; row: WarehouseRow }
  | { ok: false; result: WarehouseMutationResult }
> {
  const parsed = warehouseSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      result: { ok: false, fieldErrors: parsed.error.flatten().fieldErrors },
    };
  }

  // A manager must be a member of THIS org. RLS wouldn't stop an arbitrary
  // user id being stored (manager_id references auth.users, not org members),
  // so we verify it explicitly.
  if (parsed.data.managerId && !(await isOrgMember(orgId, parsed.data.managerId))) {
    return {
      ok: false,
      result: {
        ok: false,
        fieldErrors: { managerId: ["That person is not a member of this organization."] },
      },
    };
  }

  return {
    ok: true,
    row: {
      org_id: orgId,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      capacity: parsed.data.capacity ?? null,
      manager_id: parsed.data.managerId ?? null,
    },
  };
}

export async function createWarehouse(
  values: unknown,
): Promise<WarehouseMutationResult> {
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "You do not have permission." };

  const built = await buildRow(values, ctx.activeOrg.orgId);
  if (!built.ok) return built.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .insert(built.row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { name: ["A warehouse with this name already exists."] } };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/warehouses");
  return { ok: true, id: data.id };
}

export async function updateWarehouse(
  id: string,
  values: unknown,
): Promise<WarehouseMutationResult> {
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "You do not have permission." };

  const built = await buildRow(values, ctx.activeOrg.orgId);
  if (!built.ok) return built.result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .update(built.row)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { name: ["A warehouse with this name already exists."] } };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/warehouses");
  return { ok: true, id: data.id };
}

export async function deleteWarehouse(id: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/warehouses");
  return { ok: true };
}

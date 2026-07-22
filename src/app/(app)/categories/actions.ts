"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  type CategoryMutationResult,
} from "@/lib/validation/category";

async function authorize() {
  const ctx = await requireContext();
  return { ctx, allowed: canEditCatalog(ctx.activeOrg.role) };
}

/**
 * A category cannot become its own ancestor, or the tree turns into a loop and
 * category_tree() would recurse forever. We detect this by walking UP from the
 * proposed parent: if we ever reach the category being edited, it's a cycle.
 */
async function wouldCreateCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  proposedParentId: string,
): Promise<boolean> {
  if (categoryId === proposedParentId) return true;

  // Fetch the org's (id -> parent_id) map once; RLS scopes it to this org.
  const { data: all } = await supabase
    .from("categories")
    .select("id, parent_id");

  const parentOf = new Map(
    (all ?? []).map((c) => [c.id, c.parent_id as string | null]),
  );

  let cursor: string | null = proposedParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === categoryId) return true; // reached ourselves -> cycle
    if (seen.has(cursor)) break; // guard against pre-existing loops
    seen.add(cursor);
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

export async function createCategory(
  values: unknown,
): Promise<CategoryMutationResult> {
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { ctx, allowed } = await authorize();
  if (!allowed) {
    return { ok: false, error: "You do not have permission to add categories." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      org_id: ctx.activeOrg.orgId,
      name: parsed.data.name,
      parent_id: parsed.data.parentId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        fieldErrors: { name: ["A sibling category already has this name."] },
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/categories");
  return { ok: true, id: data.id };
}

export async function updateCategory(
  id: string,
  values: unknown,
): Promise<CategoryMutationResult> {
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { allowed } = await authorize();
  if (!allowed) {
    return { ok: false, error: "You do not have permission to edit categories." };
  }

  const supabase = await createClient();

  if (parsed.data.parentId) {
    if (await wouldCreateCycle(supabase, id, parsed.data.parentId)) {
      return {
        ok: false,
        fieldErrors: {
          parentId: ["A category cannot be nested inside itself."],
        },
      };
    }
  }

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      parent_id: parsed.data.parentId ?? null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        fieldErrors: { name: ["A sibling category already has this name."] },
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/categories");
  return { ok: true, id: data.id };
}

/**
 * Delete a category. The FK on categories.parent_id is ON DELETE SET NULL, so
 * child categories are promoted to top-level rather than deleted. products.
 * category_id is likewise SET NULL, so products keep existing, just uncategorised.
 */
export async function deleteCategory(id: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/categories");
  return { ok: true };
}

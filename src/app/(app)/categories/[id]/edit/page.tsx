import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CategoryForm } from "@/components/categories/category-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getCategoryTree, buildParentOptions } from "@/lib/data/categories";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit category · Smart Inventory" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/categories");

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("id", id)
    .single();

  if (!category) notFound();

  const tree = await getCategoryTree(ctx.activeOrg.orgId);
  // Exclude this category and its descendants from the parent options so it
  // cannot be nested inside itself.
  const parentOptions = buildParentOptions(tree, id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href="/categories"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit category
        </h1>
      </div>

      <CategoryForm
        categoryId={id}
        defaultValues={{
          name: category.name,
          parentId: category.parent_id ?? "",
        }}
        parentOptions={parentOptions}
      />
    </div>
  );
}

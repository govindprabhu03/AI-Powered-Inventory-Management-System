import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryForm } from "@/components/categories/category-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getCategoryTree, buildParentOptions } from "@/lib/data/categories";

export const metadata = { title: "Add category · Smart Inventory" };

export default async function NewCategoryPage() {
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/categories");

  const tree = await getCategoryTree(ctx.activeOrg.orgId);
  const parentOptions = buildParentOptions(tree);

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
          Add category
        </h1>
      </div>

      <CategoryForm parentOptions={parentOptions} />
    </div>
  );
}

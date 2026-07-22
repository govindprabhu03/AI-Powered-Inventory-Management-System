import Link from "next/link";

import { CategoryRowActions } from "@/components/categories/category-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getCategoryTree } from "@/lib/data/categories";

export const metadata = { title: "Categories · Smart Inventory" };

export default async function CategoriesPage() {
  const ctx = await requireContext();
  const canEdit = canEditCatalog(ctx.activeOrg.role);
  const tree = await getCategoryTree(ctx.activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            {tree.length} {tree.length === 1 ? "category" : "categories"}
          </p>
        </div>
        {canEdit && (
          <Button
            nativeButton={false}
            render={<Link href="/categories/new">Add category</Link>}
          />
        )}
      </div>

      {tree.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border">
          {tree.map((node) => (
            <li
              key={node.id}
              className="flex items-center justify-between border-b px-4 py-2.5 last:border-b-0"
            >
              {/* Indent by depth to show the hierarchy. The tree already comes
                  back ordered so parents sit directly above their children. */}
              <span
                className="flex items-center gap-2 text-sm"
                style={{ paddingLeft: `${node.depth * 20}px` }}
              >
                {node.depth > 0 && (
                  <span className="text-muted-foreground">└</span>
                )}
                <span className="font-medium">{node.name}</span>
                <Badge variant="secondary">
                  {node.product_count}{" "}
                  {node.product_count === 1 ? "product" : "products"}
                </Badge>
              </span>
              {canEdit && <CategoryRowActions id={node.id} />}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No categories yet.</p>
          {canEdit && (
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/categories/new">Add your first category</Link>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ParentOption } from "@/components/categories/category-form";

export type CategoryNode = {
  id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  path: string;
  product_count: number;
};

/** Call the recursive-CTE function and return the org's category tree. */
export async function getCategoryTree(orgId: string): Promise<CategoryNode[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("category_tree", { p_org_id: orgId });
  return (data ?? []) as CategoryNode[];
}

/**
 * Turn the tree into <select> options, indented by depth. When editing a
 * category we must not let it be re-parented under itself or a descendant, so
 * those rows are disabled.
 */
export function buildParentOptions(
  tree: CategoryNode[],
  excludeId?: string,
): ParentOption[] {
  const descendants = excludeId
    ? collectDescendants(tree, excludeId)
    : new Set<string>();

  return tree.map((n) => ({
    id: n.id,
    label: `${"  ".repeat(n.depth)}${n.name}`,
    disabled: n.id === excludeId || descendants.has(n.id),
  }));
}

/** All ids beneath `rootId` (not including it). */
function collectDescendants(tree: CategoryNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of tree) {
    if (n.parent_id) {
      const list = childrenOf.get(n.parent_id) ?? [];
      list.push(n.id);
      childrenOf.set(n.parent_id, list);
    }
  }

  const out = new Set<string>();
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}

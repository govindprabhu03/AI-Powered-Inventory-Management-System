import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AuditEntry = {
  id: string;
  action: "insert" | "update" | "delete";
  table: string;
  entityLabel: string;
  actor: string;
  changedFields: string[];
  when: string;
};

const TABLE_LABEL: Record<string, string> = {
  products: "Product",
  categories: "Category",
  suppliers: "Supplier",
  warehouses: "Warehouse",
  customers: "Customer",
  purchase_orders: "Purchase order",
  sales_orders: "Sales order",
  organization_members: "Member",
};

/** Pull the human-friendly subject out of a row's jsonb. */
function subjectOf(row: Record<string, unknown> | undefined): string {
  if (!row) return "";
  return String(
    row.name ??
      row.company_name ??
      row.order_number ??
      row.role ??
      row.id ??
      "",
  );
}

/** Which top-level fields differ between old and new (for update entries). */
function changedFields(changes: unknown): string[] {
  if (!changes || typeof changes !== "object") return [];
  const c = changes as { old?: Record<string, unknown>; new?: Record<string, unknown> };
  if (!c.old || !c.new) return [];
  const fields: string[] = [];
  for (const k of Object.keys(c.new)) {
    if (k === "updated_at") continue;
    if (JSON.stringify(c.new[k]) !== JSON.stringify(c.old[k])) fields.push(k);
  }
  return fields;
}

export async function getAuditLog(orgId: string): Promise<AuditEntry[]> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, actor_id, table_name, action, changes, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!rows || rows.length === 0) return [];

  // Resolve actor names via profiles (org colleagues are readable under RLS).
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => {
    const changes = r.changes as Record<string, unknown> | null;
    const row =
      r.action === "update"
        ? (changes?.new as Record<string, unknown> | undefined)
        : (changes as Record<string, unknown> | undefined);

    return {
      id: r.id,
      action: r.action as AuditEntry["action"],
      table: TABLE_LABEL[r.table_name] ?? r.table_name,
      entityLabel: subjectOf(row),
      actor: r.actor_id ? (nameById.get(r.actor_id) ?? "A user") : "System",
      changedFields: r.action === "update" ? changedFields(r.changes) : [],
      when: r.created_at,
    };
  });
}

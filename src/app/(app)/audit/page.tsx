import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext, canViewAudit } from "@/lib/auth/context";
import { getAuditLog } from "@/lib/data/audit";
import { cn } from "@/lib/utils";

export const metadata = { title: "Audit log · Smart Inventory" };

const ACTION_STYLE: Record<string, string> = {
  insert: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
const ACTION_VERB: Record<string, string> = {
  insert: "created",
  update: "updated",
  delete: "deleted",
};

export default async function AuditPage() {
  const ctx = await requireContext();
  if (!canViewAudit(ctx.activeOrg.role)) redirect("/dashboard");

  const entries = await getAuditLog(ctx.activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every create, update and delete across your catalog and orders,
          recorded by the database itself.
        </p>
      </div>

      {entries.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>What</TableHead>
                <TableHead>By</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Badge className={cn("border-transparent", ACTION_STYLE[e.action])}>
                      {ACTION_VERB[e.action]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{e.table}: </span>
                    <span className="font-medium">{e.entityLabel || "—"}</span>
                    {e.changedFields.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({e.changedFields.join(", ")})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.actor}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(e.when).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      )}
    </div>
  );
}

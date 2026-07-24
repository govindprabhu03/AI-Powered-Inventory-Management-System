import Link from "next/link";

import { ExportButton } from "@/components/reports/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ReportColumn<T> = {
  key: string;
  label: string;
  align?: "right";
  render?: (row: T) => React.ReactNode;
};

/**
 * Shared layout for a report: header, CSV export and a table. The table is
 * server-rendered (with per-column render fns); the export button is a client
 * component that receives the plain rows + {key,label} column list.
 */
export function ReportShell<T extends Record<string, unknown>>({
  title,
  description,
  filename,
  columns,
  rows,
  emptyMessage = "Nothing to report.",
}: {
  title: string;
  description?: string;
  filename: string;
  columns: ReportColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/reports" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Reports
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <ExportButton
          filename={filename}
          columns={columns.map((c) => ({ key: c.key, label: c.label }))}
          rows={rows}
        />
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" ? "text-right tabular-nums" : ""}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

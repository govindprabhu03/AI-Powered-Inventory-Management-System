"use client";

import Papa from "papaparse";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Client-side CSV export. The report data is already on the page, so rather
 * than a second server round-trip we unparse the rows in the browser and hand
 * the user a Blob download.
 */
export function ExportButton({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}) {
  function download() {
    const shaped = rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const c of columns) out[c.label] = r[c.key];
      return out;
    });
    const csv = Papa.unparse(shaped, { columns: columns.map((c) => c.label) });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download />
      Export CSV
    </Button>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { importProducts, type ImportResult } from "@/app/(app)/products/import/actions";
import { Button } from "@/components/ui/button";

export function CsvImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const text = await file.text();
      const res = await importProducts(text);
      if (res.error) setError(res.error);
      else {
        setResult(res);
        router.refresh(); // so the products list reflects new rows
      }
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {busy ? "Importing…" : "Choose CSV file"}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="grid gap-3 rounded-lg border p-4">
          <p className="text-sm">
            <span className="font-medium text-green-600 dark:text-green-500">
              {result.inserted} imported
            </span>{" "}
            of {result.total} rows
            {result.errors.length > 0 && (
              <>
                {" · "}
                <span className="font-medium text-destructive">
                  {result.errors.length} failed
                </span>
              </>
            )}
          </p>

          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="w-16 px-3 py-1.5 font-medium">Row</th>
                    <th className="px-3 py-1.5 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                        {e.row}
                      </td>
                      <td className="px-3 py-1.5">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

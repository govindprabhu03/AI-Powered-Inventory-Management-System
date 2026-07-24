"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { returnSalesOrderItems } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ReturnableLine = {
  productId: string;
  label: string;
  sold: number;
  alreadyReturned: number;
};

/**
 * Record a partial return. Each line shows how many are still returnable
 * (sold − already returned); the server's return_sales_order_items() re-checks
 * this, so the input is a convenience, not the guard.
 */
export function ReturnsForm({ id, lines }: { id: string; lines: ReturnableLine[] }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const anyReturnable = lines.some((l) => l.sold - l.alreadyReturned > 0);
  if (!anyReturnable) {
    return (
      <p className="text-sm text-muted-foreground">
        Everything on this order has been returned.
      </p>
    );
  }

  const submit = () => {
    setError(null);
    setDone(false);
    const items = lines
      .map((l) => ({ productId: l.productId, quantity: Number(qty[l.productId]) || 0 }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      setError("Enter a quantity to return.");
      return;
    }

    startTransition(async () => {
      const res = await returnSalesOrderItems(id, items);
      if (!res.ok) setError(res.error ?? "Return failed");
      else {
        setDone(true);
        setQty({});
        router.refresh();
      }
    });
  };

  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          Return recorded — stock added back.
        </p>
      )}

      <div className="grid gap-2">
        {lines.map((l) => {
          const returnable = l.sold - l.alreadyReturned;
          return (
            <div key={l.productId} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{l.label}</span>
              <span className="text-xs text-muted-foreground">
                {returnable} returnable
              </span>
              <Input
                type="number"
                min={0}
                max={returnable}
                className="w-24"
                placeholder="0"
                disabled={returnable === 0}
                value={qty[l.productId] ?? ""}
                onChange={(e) =>
                  setQty((q) => ({ ...q, [l.productId]: e.target.value }))
                }
              />
            </div>
          );
        })}
      </div>

      <div>
        <Button size="sm" disabled={isPending} onClick={submit}>
          {isPending ? "Recording…" : "Record return"}
        </Button>
      </div>
    </div>
  );
}

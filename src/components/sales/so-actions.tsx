"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  confirmSalesOrder,
  fulfilSalesOrder,
  cancelSalesOrder,
  setSalesPayment,
} from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import type { SalesMutationResult } from "@/lib/validation/sales-order";

export function SoActions({
  id,
  canConfirm,
  canFulfil,
  canCancel,
  canPay,
}: {
  id: string;
  canConfirm: boolean;
  canFulfil: boolean;
  canCancel: boolean;
  canPay: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<SalesMutationResult>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else router.refresh();
    });
  };

  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canConfirm && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(() => confirmSalesOrder(id), "Confirm this order? Stock will be reserved.")
            }
          >
            Confirm &amp; reserve
          </Button>
        )}
        {canFulfil && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(() => fulfilSalesOrder(id), "Fulfil this order? Stock will be dispatched.")
            }
          >
            Fulfil &amp; dispatch
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => cancelSalesOrder(id), "Cancel this sales order?")}
          >
            Cancel
          </Button>
        )}
      </div>

      {canPay && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mark payment:</span>
          {(["unpaid", "partial", "paid"] as const).map((s) => (
            <Button
              key={s}
              size="xs"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => setSalesPayment(id, s))}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

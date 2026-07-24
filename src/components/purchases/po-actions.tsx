"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  submitPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  setPurchasePayment,
} from "@/app/(app)/purchases/actions";
import { Button } from "@/components/ui/button";
import type { OrderMutationResult } from "@/lib/validation/purchase-order";

/**
 * The state-machine buttons. Which ones appear is decided on the server (by
 * status + role) and passed in as booleans, so this component only wires clicks
 * to the corresponding RPC-backed action and surfaces any error the DB returns.
 */
export function PoActions({
  id,
  canSubmit,
  canApprove,
  canReceive,
  canCancel,
  canPay,
}: {
  id: string;
  canSubmit: boolean;
  canApprove: boolean;
  canReceive: boolean;
  canCancel: boolean;
  canPay: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<OrderMutationResult>, confirmMsg?: string) => {
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
        {canSubmit && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => submitPurchaseOrder(id))}>
            Submit for approval
          </Button>
        )}
        {canApprove && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => approvePurchaseOrder(id))}>
            Approve
          </Button>
        )}
        {canReceive && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              run(
                () => receivePurchaseOrder(id),
                "Receive this order? Stock will be added to the warehouse.",
              )
            }
          >
            Receive into stock
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run(() => cancelPurchaseOrder(id), "Cancel this purchase order?")}
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
              onClick={() => run(() => setPurchasePayment(id, s))}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

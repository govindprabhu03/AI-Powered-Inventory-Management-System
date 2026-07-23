"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { transferStock } from "@/app/(app)/stock/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  transferSchema,
  type TransferFormValues,
} from "@/lib/validation/transfer";

type Option = { id: string; label: string };
/** on-hand keyed by `${productId}:${warehouseId}`, for the availability hint. */
type LevelMap = Record<string, number>;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function TransferForm({
  products,
  warehouses,
  levels,
}: {
  products: Option[];
  warehouses: Option[];
  levels: LevelMap;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      productId: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      quantity: 1,
      note: "",
    },
  });

  const productId = watch("productId");
  const fromId = watch("fromWarehouseId");
  const atSource =
    productId && fromId ? (levels[`${productId}:${fromId}`] ?? 0) : null;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await transferStock(values);

    if (result.ok) {
      setSaved(true);
      reset({ ...values, quantity: 1, note: "" });
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof TransferFormValues, { message: m?.[0] });
      }
    }
    if (result.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-5">
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          Transfer recorded.
        </p>
      )}

      <div className="grid gap-1.5">
        <Label>Product</Label>
        <select className={selectClass} {...register("productId")}>
          <option value="">— Choose —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {errors.productId && (
          <p className="text-xs text-destructive">{errors.productId.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>From</Label>
          <select className={selectClass} {...register("fromWarehouseId")}>
            <option value="">— Source —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          {errors.fromWarehouseId ? (
            <p className="text-xs text-destructive">
              {errors.fromWarehouseId.message}
            </p>
          ) : atSource !== null ? (
            <p className="text-xs text-muted-foreground">
              {atSource} on hand at source
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label>To</Label>
          <select className={selectClass} {...register("toWarehouseId")}>
            <option value="">— Destination —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
          {errors.toWarehouseId && (
            <p className="text-xs text-destructive">
              {errors.toWarehouseId.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Quantity</Label>
        <Input type="number" {...register("quantity")} />
        {errors.quantity && (
          <p className="text-xs text-destructive">{errors.quantity.message}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label>Note (optional)</Label>
        <Textarea rows={2} {...register("note")} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Transferring…" : "Transfer stock"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/stock")}>
          Done
        </Button>
      </div>
    </form>
  );
}

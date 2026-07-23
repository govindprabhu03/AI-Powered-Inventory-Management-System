"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { recordMovement } from "@/app/(app)/stock/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  recordMovementSchema,
  DIRECT_MOVEMENT_TYPES,
  MOVEMENT_LABELS,
  type RecordMovementValues,
} from "@/lib/validation/stock";

type Option = { id: string; label: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function RecordMovementForm({
  products,
  warehouses,
  initialProductId,
}: {
  products: Option[];
  warehouses: Option[];
  /** Pre-selects a product — read from ?product= by the server page, so this
   *  component needs no useSearchParams/Suspense. The scanner links here. */
  initialProductId?: string;
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
  } = useForm<RecordMovementValues>({
    resolver: zodResolver(recordMovementSchema),
    defaultValues: {
      productId: initialProductId ?? "",
      warehouseId: warehouses.length === 1 ? warehouses[0].id : "",
      movementType: "stock_in",
      quantity: 1,
      note: "",
    },
  });

  const movementType = watch("movementType");

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await recordMovement(values);

    if (result.ok) {
      setSaved(true);
      reset({ ...values, quantity: 1, note: "" }); // keep product/warehouse for rapid entry
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof RecordMovementValues, { message: m?.[0] });
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
          Movement recorded.
        </p>
      )}

      <Field label="Product" error={errors.productId?.message}>
        <select className={selectClass} {...register("productId")}>
          <option value="">— Choose —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Warehouse" error={errors.warehouseId?.message}>
        <select className={selectClass} {...register("warehouseId")}>
          <option value="">— Choose —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Movement type" error={errors.movementType?.message}>
        <select className={selectClass} {...register("movementType")}>
          {DIRECT_MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Quantity"
        error={errors.quantity?.message}
        hint={
          movementType === "adjustment"
            ? "Positive adds stock, negative removes it."
            : "Always positive — the type sets the direction."
        }
      >
        <Input type="number" {...register("quantity")} />
      </Field>

      <Field label="Note (optional)">
        <Textarea rows={2} {...register("note")} placeholder="e.g. GRN #142, box damaged in transit…" />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Recording…" : "Record movement"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/stock")}>
          Done
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5")}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

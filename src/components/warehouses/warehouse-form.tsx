"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createWarehouse, updateWarehouse } from "@/app/(app)/warehouses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  warehouseSchema,
  type WarehouseFormValues,
} from "@/lib/validation/warehouse";

type Member = { id: string; label: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function WarehouseForm({
  warehouseId,
  defaultValues,
  members,
}: {
  warehouseId?: string;
  defaultValues?: Partial<WarehouseFormValues>;
  members: Member[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: "",
      address: "",
      capacity: "",
      managerId: "",
      ...defaultValues,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = warehouseId
      ? await updateWarehouse(warehouseId, values)
      : await createWarehouse(values);

    if (result.ok) {
      router.push("/warehouses");
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof WarehouseFormValues, { message: m?.[0] });
      }
    }
    if (result.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message} className="sm:col-span-2">
          <Input {...register("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Capacity (units)" error={errors.capacity?.message}>
          <Input type="number" {...register("capacity")} />
        </Field>
        <Field label="Manager" error={errors.managerId?.message}>
          <select className={selectClass} {...register("managerId")}>
            <option value="">— Unassigned —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} {...register("address")} />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : warehouseId ? "Save changes" : "Add warehouse"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/warehouses")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

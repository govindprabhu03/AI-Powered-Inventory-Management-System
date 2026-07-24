"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createSalesOrder } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createSalesOrderSchema,
  type SalesOrderFormValues,
} from "@/lib/validation/sales-order";

type ProductOption = { id: string; label: string; price: number };
type Option = { id: string; label: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function SalesOrderForm({
  customers,
  warehouses,
  products,
}: {
  customers: Option[];
  warehouses: Option[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SalesOrderFormValues>({
    resolver: zodResolver(createSalesOrderSchema),
    defaultValues: {
      customerId: "",
      warehouseId: warehouses.length === 1 ? warehouses[0].id : "",
      notes: "",
      items: [{ productId: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const total = (items ?? []).reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createSalesOrder(values);
    if (result.ok) {
      router.push(`/sales/${result.id}`);
      router.refresh();
      return;
    }
    if (result.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Customer</Label>
          <select className={selectClass} {...register("customerId")}>
            <option value="">— Choose —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label>Ship from warehouse</Label>
          <select className={selectClass} {...register("warehouseId")}>
            <option value="">— Choose —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
          {errors.warehouseId && <p className="text-xs text-destructive">{errors.warehouseId.message}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Items</Label>
          {typeof errors.items?.message === "string" && (
            <p className="text-xs text-destructive">{errors.items.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="flex-1">
                <select
                  className={selectClass}
                  {...register(`items.${index}.productId`)}
                  onChange={(e) => {
                    register(`items.${index}.productId`).onChange(e);
                    const p = products.find((x) => x.id === e.target.value);
                    if (p) setValue(`items.${index}.unitPrice`, p.price);
                  }}
                >
                  <option value="">— Product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                {errors.items?.[index]?.productId && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.items[index]?.productId?.message}
                  </p>
                )}
              </div>
              <Input type="number" className="w-20" placeholder="Qty" {...register(`items.${index}.quantity`)} />
              <Input type="number" step="0.01" className="w-28" placeholder="Unit price" {...register(`items.${index}.unitPrice`)} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove item"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>

        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}>
            <Plus />
            Add item
          </Button>
        </div>

        <p className="text-right text-sm text-muted-foreground">
          Total:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(total)}
          </span>
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label>Notes (optional)</Label>
        <Textarea rows={2} {...register("notes")} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create draft order"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/sales")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

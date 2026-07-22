"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createProduct, updateProduct } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  productSchema,
  type ProductFormValues,
} from "@/lib/validation/product";

type Option = { id: string; label: string };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const BLANK: ProductFormValues = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  categoryId: "",
  supplierId: "",
  brand: "",
  costPrice: 0,
  sellingPrice: 0,
  taxRate: 0,
  unit: "pcs",
  weight: "",
  reorderLevel: 0,
};

export function ProductForm({
  productId,
  defaultValues,
  categories,
  suppliers,
}: {
  productId?: string;
  defaultValues?: Partial<ProductFormValues>;
  categories: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    // The SAME schema the server uses. Client validation here is instant
    // feedback; the server re-checks it because a form can be bypassed.
    resolver: zodResolver(productSchema),
    defaultValues: { ...BLANK, ...defaultValues },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = productId
      ? await updateProduct(productId, values)
      : await createProduct(values);

    if (result.ok) {
      router.push("/products");
      router.refresh();
      return;
    }

    // Surface server-side validation errors on the matching fields.
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field as keyof ProductFormValues, {
          message: messages?.[0],
        });
      }
    }
    if (result.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      {formError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message} className="sm:col-span-2">
          <Input {...register("name")} aria-invalid={!!errors.name} />
        </Field>

        <Field label="SKU" error={errors.sku?.message}>
          <Input {...register("sku")} aria-invalid={!!errors.sku} />
        </Field>

        <Field label="Barcode" error={errors.barcode?.message}>
          <Input {...register("barcode")} />
        </Field>

        <Field label="Category">
          <select className={selectClass} {...register("categoryId")}>
            <option value="">— None —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier">
          <select className={selectClass} {...register("supplierId")}>
            <option value="">— None —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Brand">
          <Input {...register("brand")} />
        </Field>

        <Field label="Unit" error={errors.unit?.message}>
          <Input {...register("unit")} placeholder="pcs, kg, box…" />
        </Field>

        <Field label="Cost price" error={errors.costPrice?.message}>
          <Input type="number" step="0.01" {...register("costPrice")} />
        </Field>

        <Field label="Selling price" error={errors.sellingPrice?.message}>
          <Input type="number" step="0.01" {...register("sellingPrice")} />
        </Field>

        <Field label="Tax rate (%)" error={errors.taxRate?.message}>
          <Input type="number" step="0.01" {...register("taxRate")} />
        </Field>

        <Field label="Weight" error={errors.weight?.message}>
          <Input type="number" step="0.001" {...register("weight")} />
        </Field>

        <Field label="Reorder level" error={errors.reorderLevel?.message}>
          <Input type="number" {...register("reorderLevel")} />
        </Field>

        <Field label="Description" className="sm:col-span-2">
          <Textarea rows={3} {...register("description")} />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : productId ? "Save changes" : "Add product"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
        >
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

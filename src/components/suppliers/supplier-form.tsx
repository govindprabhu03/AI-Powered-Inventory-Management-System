"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupplier, updateSupplier } from "@/app/(app)/suppliers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  supplierSchema,
  type SupplierFormValues,
} from "@/lib/validation/supplier";

export function SupplierForm({
  supplierId,
  defaultValues,
}: {
  supplierId?: string;
  defaultValues?: Partial<SupplierFormValues>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      gstNumber: "",
      address: "",
      ...defaultValues,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = supplierId
      ? await updateSupplier(supplierId, values)
      : await createSupplier(values);

    if (result.ok) {
      router.push("/suppliers");
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof SupplierFormValues, { message: m?.[0] });
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
        <Field label="Company name" error={errors.companyName?.message} className="sm:col-span-2">
          <Input {...register("companyName")} aria-invalid={!!errors.companyName} />
        </Field>
        <Field label="Contact person">
          <Input {...register("contactPerson")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Phone">
          <Input {...register("phone")} />
        </Field>
        <Field label="GST number">
          <Input {...register("gstNumber")} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} {...register("address")} />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : supplierId ? "Save changes" : "Add supplier"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/suppliers")}>
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

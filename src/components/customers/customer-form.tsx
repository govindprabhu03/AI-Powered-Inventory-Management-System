"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createCustomer, updateCustomer } from "@/app/(app)/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  customerSchema,
  type CustomerFormValues,
} from "@/lib/validation/customer";

export function CustomerForm({
  customerId,
  defaultValues,
}: {
  customerId?: string;
  defaultValues?: Partial<CustomerFormValues>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", address: "", ...defaultValues },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = customerId
      ? await updateCustomer(customerId, values)
      : await createCustomer(values);

    if (result.ok) {
      router.push("/customers");
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [f, m] of Object.entries(result.fieldErrors)) {
        setError(f as keyof CustomerFormValues, { message: m?.[0] });
      }
    }
    if (result.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-5">
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message} className="sm:col-span-2">
          <Input {...register("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Phone">
          <Input {...register("phone")} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea rows={2} {...register("address")} />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : customerId ? "Save changes" : "Add customer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/customers")}>
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

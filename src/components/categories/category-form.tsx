"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createCategory, updateCategory } from "@/app/(app)/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  categorySchema,
  type CategoryFormValues,
} from "@/lib/validation/category";

export type ParentOption = { id: string; label: string; disabled?: boolean };

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function CategoryForm({
  categoryId,
  defaultValues,
  parentOptions,
}: {
  categoryId?: string;
  defaultValues?: Partial<CategoryFormValues>;
  parentOptions: ParentOption[];
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", parentId: "", ...defaultValues },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = categoryId
      ? await updateCategory(categoryId, values)
      : await createCategory(values);

    if (result.ok) {
      router.push("/categories");
      router.refresh();
      return;
    }
    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setError(field as keyof CategoryFormValues, { message: messages?.[0] });
      }
    }
    if (result.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-5">
      {formError && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="parentId">Parent category</Label>
        <select id="parentId" className={selectClass} {...register("parentId")}>
          <option value="">— None (top level) —</option>
          {parentOptions.map((o) => (
            <option key={o.id} value={o.id} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.parentId && (
          <p className="text-xs text-destructive">{errors.parentId.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : categoryId ? "Save changes" : "Add category"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/categories")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

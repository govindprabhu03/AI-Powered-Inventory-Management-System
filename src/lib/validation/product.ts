import { z } from "zod";

/**
 * One product schema, used by the form (client) and the Server Action (server).
 *
 * HTML inputs always produce strings, so number fields are coerced. Empty
 * strings from untouched optional inputs are normalised to undefined here; the
 * Server Action then turns undefined into SQL NULL.
 */

// "" | "   " -> undefined ; otherwise the trimmed string.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

// "" -> undefined ; otherwise a non-negative number.
const optionalNonNegative = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0).optional(),
);

// "" -> undefined ; otherwise a uuid. Used for the category/supplier selects,
// where "no selection" is the empty string.
const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);

export const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  sku: z.string().trim().min(1, "SKU is required").max(80),
  barcode: optionalText(80),
  description: optionalText(2000),

  categoryId: optionalUuid,
  supplierId: optionalUuid,
  brand: optionalText(120),

  costPrice: z.coerce.number().min(0, "Cannot be negative").default(0),
  sellingPrice: z.coerce.number().min(0, "Cannot be negative").default(0),
  taxRate: z.coerce
    .number()
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100%")
    .default(0),

  unit: z.string().trim().min(1).max(20).default("pcs"),
  weight: optionalNonNegative,
  reorderLevel: z.coerce
    .number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .default(0),
});

// Input type (what the form collects, pre-coercion) vs output type (post-parse).
export type ProductFormValues = z.input<typeof productSchema>;
export type ProductInput = z.output<typeof productSchema>;

export type ProductActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const supplierSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  contactPerson: optionalText(120),
  email: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().email("Enter a valid email").optional(),
  ),
  phone: optionalText(40),
  gstNumber: optionalText(40),
  address: optionalText(500),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;

export type SupplierMutationResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

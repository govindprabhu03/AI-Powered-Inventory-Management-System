import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().email("Enter a valid email").optional(),
  ),
  phone: optionalText(40),
  address: optionalText(500),
});

export type CustomerFormValues = z.input<typeof customerSchema>;

export type CustomerMutationResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

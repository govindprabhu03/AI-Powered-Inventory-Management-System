import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  address: optionalText(500),
  capacity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int("Must be a whole number").min(0).optional(),
  ),
  managerId: optionalUuid,
});

export type WarehouseFormValues = z.input<typeof warehouseSchema>;

export type WarehouseMutationResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

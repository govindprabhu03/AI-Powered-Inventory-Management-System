import { z } from "zod";

export const poItemSchema = z.object({
  productId: z.string().uuid("Choose a product"),
  quantity: z.coerce.number().int("Whole units").positive("Must be > 0"),
  unitCost: z.coerce.number().min(0, "Cannot be negative"),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().uuid("Choose a supplier"),
  warehouseId: z.string().uuid("Choose a warehouse"),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  expectedDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  items: z.array(poItemSchema).min(1, "Add at least one item"),
});

export type PurchaseOrderFormValues = z.input<typeof createPurchaseOrderSchema>;

export type OrderMutationResult =
  | { ok: true; id?: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

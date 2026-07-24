import { z } from "zod";

export const soItemSchema = z.object({
  productId: z.string().uuid("Choose a product"),
  quantity: z.coerce.number().int("Whole units").positive("Must be > 0"),
  unitPrice: z.coerce.number().min(0, "Cannot be negative"),
});

export const createSalesOrderSchema = z.object({
  customerId: z.string().uuid("Choose a customer"),
  warehouseId: z.string().uuid("Choose a warehouse"),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : undefined)),
  items: z.array(soItemSchema).min(1, "Add at least one item"),
});

export type SalesOrderFormValues = z.input<typeof createSalesOrderSchema>;

export type SalesMutationResult =
  | { ok: true; id?: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

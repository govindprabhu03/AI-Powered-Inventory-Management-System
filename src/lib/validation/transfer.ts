import { z } from "zod";

export const transferSchema = z
  .object({
    productId: z.string().uuid("Choose a product"),
    fromWarehouseId: z.string().uuid("Choose the source warehouse"),
    toWarehouseId: z.string().uuid("Choose the destination warehouse"),
    quantity: z.coerce
      .number()
      .int("Whole units only")
      .positive("Quantity must be positive"),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
    message: "Source and destination must be different warehouses",
    path: ["toWarehouseId"],
  });

export type TransferFormValues = z.input<typeof transferSchema>;

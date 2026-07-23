import { z } from "zod";

/**
 * Movement types a user can post directly. Transfers are excluded — they are
 * two linked movements and go through record_stock_transfer() instead.
 */
export const DIRECT_MOVEMENT_TYPES = [
  "stock_in",
  "stock_out",
  "return",
  "damage",
  "loss",
  "adjustment",
] as const;

export type DirectMovementType = (typeof DIRECT_MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<DirectMovementType, string> = {
  stock_in: "Stock in (receive)",
  stock_out: "Stock out (dispatch)",
  return: "Customer return (+)",
  damage: "Damaged (−)",
  loss: "Lost (−)",
  adjustment: "Adjustment (+/−)",
};

/** Which way each type moves stock. The user always types a positive number
 *  (except adjustments, which may be negative); the sign is derived from this. */
export const MOVEMENT_DIRECTION: Record<DirectMovementType, 1 | -1 | 0> = {
  stock_in: 1,
  return: 1,
  stock_out: -1,
  damage: -1,
  loss: -1,
  adjustment: 0, // signed as entered
};

export const recordMovementSchema = z
  .object({
    productId: z.string().uuid("Choose a product"),
    warehouseId: z.string().uuid("Choose a warehouse"),
    movementType: z.enum(DIRECT_MOVEMENT_TYPES),
    quantity: z.coerce
      .number()
      .int("Whole units only")
      .refine((n) => n !== 0, "Quantity cannot be zero"),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine(
    (d) => d.movementType === "adjustment" || d.quantity > 0,
    {
      message: "Enter a positive quantity — the type decides the direction",
      path: ["quantity"],
    },
  );

export type RecordMovementValues = z.input<typeof recordMovementSchema>;

export type StockMutationResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

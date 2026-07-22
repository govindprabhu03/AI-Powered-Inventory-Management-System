import { z } from "zod";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().uuid().optional(),
);

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  parentId: optionalUuid,
});

export type CategoryFormValues = z.input<typeof categorySchema>;

export type CategoryMutationResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

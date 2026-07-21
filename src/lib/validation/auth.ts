import { z } from "zod";

/**
 * One schema per form, used by BOTH the client form and the Server Action.
 *
 * Client-side validation is a convenience — it gives instant feedback. It is
 * not security: anyone can POST directly to a Server Action and skip the form
 * entirely. That is why the server re-validates with this same schema.
 * One definition, so the two can never drift apart.
 */

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters"); // bcrypt truncates past 72

export const signupSchema = z.object({
  fullName: z
    .string()
    .min(1, "Name is required")
    .max(120, "Name is too long")
    .trim(),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const resetRequestSchema = z.object({
  email: emailSchema,
});

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Shape returned by every auth Server Action, so forms can render errors
 * uniformly. `fieldErrors` maps a field name to its messages.
 */
export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
};

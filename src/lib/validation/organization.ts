import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(80, "Organization name is too long")
    .trim(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export type OrganizationActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

/**
 * Turn a display name into a URL-safe slug: "Acme Traders Pvt Ltd" -> "acme-traders-pvt-ltd".
 *
 * Must satisfy the CHECK constraint on organizations.slug:
 *   ^[a-z0-9]+(-[a-z0-9]+)*$
 * i.e. lowercase alphanumerics separated by single hyphens, no leading or
 * trailing hyphen.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD") // split accented letters into base + accent
    .replace(/[̀-ͯ]/g, "") // drop the accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // anything else becomes a hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens from both ends
    .slice(0, 50);
}

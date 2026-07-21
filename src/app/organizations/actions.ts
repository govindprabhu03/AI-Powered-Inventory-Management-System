"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createOrganizationSchema,
  slugify,
  type OrganizationActionState,
} from "@/lib/validation/organization";

/**
 * Create an organization and make the caller its super admin.
 *
 * The two writes (organization + membership) happen inside the
 * create_organization() SQL function so they share one transaction. Doing them
 * as two separate calls from here would risk an organization with no members —
 * unreachable by anyone, including its creator, because RLS would hide it.
 */
export async function createOrganization(
  _prev: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // Server Actions are reachable by direct POST, so authorization is checked
  // here rather than relying on the proxy having redirected anonymous users.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create an organization." };
  }

  const base = slugify(parsed.data.name);

  if (!base) {
    return {
      fieldErrors: {
        name: ["Use at least a few letters or numbers in the name."],
      },
    };
  }

  // Slugs are globally unique because they appear in URLs. Two businesses may
  // legitimately share a name, so on collision we append a short suffix rather
  // than rejecting the second one.
  let lastError = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug =
      attempt === 0
        ? base
        : `${base}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabase.rpc("create_organization", {
      p_name: parsed.data.name,
      p_slug: slug,
    });

    if (!error && data) {
      revalidatePath("/", "layout");
      redirect("/dashboard"); // outside try/catch — redirect throws by design
    }

    // 23505 = unique_violation. Anything else is a real failure worth surfacing.
    if (error && !error.message.includes("organizations_slug_key")) {
      lastError = error.message;
      break;
    }

    lastError = error?.message ?? "Could not create the organization.";
  }

  return { error: lastError || "Could not create the organization." };
}

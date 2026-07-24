"use server";

import { revalidatePath } from "next/cache";

import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string) {
  await requireContext();
  const supabase = await createClient();
  // RLS restricts this to the caller's own notifications.
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  await requireContext();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  revalidatePath("/", "layout");
}

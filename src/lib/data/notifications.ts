import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

/** Recent notifications for the current user, unread first. RLS scopes to them. */
export async function getNotifications(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const supabase = await createClient();

  const [{ data: items }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false),
  ]);

  return { items: items ?? [], unread: count ?? 0 };
}

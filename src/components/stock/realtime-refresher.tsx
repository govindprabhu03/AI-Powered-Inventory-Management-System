"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Invisible component that keeps the stock page live.
 *
 * Subscribes to Postgres change events on stock_levels for this org. Realtime
 * enforces RLS, so the socket only ever delivers rows this user may SELECT.
 *
 * On any event we simply router.refresh() — the Server Component refetches and
 * re-renders with authoritative data. The event is a doorbell, not a payload:
 * we never patch client state from it, so there is nothing to get out of sync.
 */
export function RealtimeStockRefresher({ orgId }: { orgId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Hand Realtime the user's JWT before subscribing. Without it the socket
      // is anon, RLS on postgres_changes sees auth.uid() = null, and events for
      // this org are silently dropped.
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`stock-levels-${orgId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stock_levels",
            filter: `org_id=eq.${orgId}`,
          },
          () => router.refresh(),
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return null;
}

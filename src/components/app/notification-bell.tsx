"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/data/notifications";

export function NotificationBell({
  userId,
  items,
  unread,
}: {
  userId: string;
  items: Notification[];
  unread: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Live: any change to this user's notifications re-renders the layout, so the
  // bell count and list update without a refresh. RLS already scoped the feed;
  // the filter just narrows the socket.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Give Realtime the user's JWT. Without this the socket connects as anon,
      // auth.uid() is null when RLS evaluates postgres_changes, and every event
      // is silently dropped. @supabase/ssr loads the session from cookies, so we
      // must set it explicitly before subscribing.
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => router.refresh(),
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, router]);

  const open = (n: Notification) =>
    startTransition(async () => {
      if (!n.is_read) await markNotificationRead(n.id);
      if (n.link) router.push(n.link);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
            <Bell />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsRead();
                  router.refresh();
                })
              }
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50",
                  !n.is_read && "bg-muted/30",
                )}
              >
                <span className="flex w-full items-center gap-2">
                  {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-destructive" />}
                  <span className="text-sm font-medium">{n.title}</span>
                </span>
                {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

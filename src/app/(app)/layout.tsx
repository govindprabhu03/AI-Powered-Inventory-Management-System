import { logout } from "@/app/(auth)/actions";
import { NotificationBell } from "@/components/app/notification-bell";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Button } from "@/components/ui/button";
import { requireContext } from "@/lib/auth/context";
import { getNotifications } from "@/lib/data/notifications";

/**
 * The shell shared by every signed-in page: sidebar with org switcher, nav, and
 * the current user. requireContext() runs here once and redirects anyone who is
 * not signed in or has no organization, so child pages can assume both.
 *
 * Because this is a layout, it does NOT re-render on navigation between pages
 * inside it — the sidebar stays put while only the page area swaps.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContext();
  const { items, unread } = await getNotifications();

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-64 shrink-0 flex-col gap-4 border-r p-4">
        <OrgSwitcher
          activeOrgId={ctx.activeOrg.orgId}
          memberships={ctx.memberships}
        />

        <SidebarNav />

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {ctx.fullName ?? ctx.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ctx.activeOrg.role.replace(/_/g, " ")}
            </p>
          </div>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-end gap-2 border-b px-6">
          <NotificationBell userId={ctx.userId} items={items} unread={unread} />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

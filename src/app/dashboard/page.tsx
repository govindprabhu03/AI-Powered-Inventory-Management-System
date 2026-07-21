import { redirect } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Smart Inventory" };

export default async function DashboardPage() {
  const supabase = await createClient();

  // getUser() asks the auth server rather than trusting the cookie. The proxy
  // already redirected anonymous visitors, but a page that reads data must
  // verify for itself — never rely on a redirect elsewhere for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // These queries run as the signed-in user, so RLS decides what comes back.
  // No "where org_id = ..." appears anywhere — the database applies it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your organizations</h2>

        {memberships && memberships.length > 0 ? (
          <ul className="grid gap-2">
            {memberships.map((m) => (
              <li
                key={m.organizations?.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {m.organizations?.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.role.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t belong to an organization yet.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

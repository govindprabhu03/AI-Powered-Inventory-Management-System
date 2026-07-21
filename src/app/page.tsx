import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

// An async Server Component. It runs on the server only, so it can talk to
// Postgres directly — no API route, no useEffect, no loading spinner, and the
// Supabase credentials never reach the browser.
export default async function Home() {
  const supabase = await createClient();

  const { data: checks, error } = await supabase
    .from("health_check")
    .select("message, checked_at")
    .order("checked_at", { ascending: false })
    .limit(1);

  const check = checks?.[0];

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Phase 0 · Setup</p>
        <h1 className="text-3xl font-semibold tracking-tight">Smart Inventory</h1>
        <p className="text-muted-foreground">
          AI-powered inventory management for small and medium businesses.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Database connection</h2>

        {error ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">
              Not connected
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {error.message}
            </p>
          </div>
        ) : check ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Connected</p>
            <p className="text-sm text-muted-foreground">{check.message}</p>
            <p className="font-mono text-xs text-muted-foreground">
              row written {new Date(check.checked_at).toUTCString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connected, but the table is empty.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button>Primary action</Button>
        <Button variant="outline">Secondary action</Button>
      </div>
    </main>
  );
}

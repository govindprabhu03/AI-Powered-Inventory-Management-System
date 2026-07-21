/**
 * RLS attack test.
 *
 * Uses the PUBLISHABLE key — the same key compiled into every browser bundle —
 * with no login, and tries to read every table and call every privileged
 * function. Everything must be denied.
 *
 * Run after any schema or policy change:
 *   node scripts/verify-rls.mjs
 *
 * RLS failures are silent: a broken policy returns rows instead of an error.
 * The only way to know it works is to attack it.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Next.js loads both; .env.local wins. Accept whichever exists.
const envFile = [".env.local", ".env"]
  .map((f) => join(root, f))
  .find((p) => existsSync(p));

if (!envFile) {
  console.error("No .env.local or .env found. Copy .env.example first.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

let failures = 0;

console.log("Anonymous read attempts (all must return 0 rows):\n");

for (const table of [
  "profiles",
  "organizations",
  "organization_members",
  "invitations",
]) {
  const { data, error } = await supabase.from(table).select("*").limit(5);
  const rows = data?.length ?? 0;

  if (rows > 0) {
    failures++;
    console.log(`  FAIL  ${table.padEnd(22)} ${rows} rows readable — LEAK`);
  } else {
    console.log(
      `  ok    ${table.padEnd(22)} 0 rows${error ? ` (${error.code})` : ""}`,
    );
  }
}

console.log("\nAnonymous writes (must be rejected):\n");

const { error: insertErr } = await supabase
  .from("organizations")
  .insert({ name: "Attacker Corp", slug: "attacker-corp" });

if (insertErr) {
  console.log(`  ok    insert organizations   rejected (${insertErr.code})`);
} else {
  failures++;
  console.log("  FAIL  insert organizations   ALLOWED — LEAK");
}

const { error: rpcErr } = await supabase.rpc("create_organization", {
  p_name: "Attacker Corp",
  p_slug: "attacker-corp",
});

if (rpcErr) {
  console.log(`  ok    create_organization()  rejected`);
} else {
  failures++;
  console.log("  FAIL  create_organization()  ALLOWED — LEAK");
}

console.log(
  failures === 0
    ? "\nAll checks passed. Anonymous access is fully denied."
    : `\n${failures} FAILURE(S). Fix the policies before continuing.`,
);

process.exit(failures === 0 ? 0 : 1);

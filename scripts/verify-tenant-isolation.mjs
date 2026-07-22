/**
 * Phase 1 checkpoint: prove tenant isolation.
 *
 * Two users, two organizations, and a battery of attacks confirming neither can
 * see or touch the other's data. This is the test the whole phase exists to pass.
 *
 * How it works, and why it is trustworthy:
 *
 *   - The SECRET key is used ONLY to seed two confirmed users and to delete them
 *     afterwards. The secret key bypasses RLS entirely — that is what makes it
 *     the right tool for setup, and the wrong tool for the actual test.
 *
 *   - Every attack runs through the PUBLISHABLE key plus a real login session,
 *     exactly like a browser. These clients ARE subject to RLS. If isolation is
 *     broken, they will see rows they should not, and the test fails.
 *
 * So the secret key never proves anything here — it only builds the fixture.
 * The verdict comes entirely from RLS-bound clients.
 *
 * Run:  node scripts/verify-tenant-isolation.mjs
 * Requires SUPABASE_SECRET_KEY in .env (or .env.local).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const envFile = [".env.local", ".env"]
  .map((f) => join(root, f))
  .find((p) => existsSync(p));

const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

if (!SECRET) {
  console.error(
    "\nSUPABASE_SECRET_KEY is not set.\n\n" +
      "Add it to your .env file (never paste it into chat):\n" +
      "  SUPABASE_SECRET_KEY=sb_secret_xxxxxxxx\n\n" +
      "Find it in the Supabase dashboard: Project Settings -> API Keys -> secret key.\n" +
      "It is only used to create and delete two throwaway test users.\n",
  );
  process.exit(1);
}

// Admin client — bypasses RLS. Used strictly for fixture setup and teardown.
const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Synthetic addresses, plus-addressed and timestamped so runs never collide.
// No email is ever sent (email_confirm: true), and both users are deleted at
// the end. Override the base with TEST_EMAIL_BASE in .env if this domain is
// rejected by your project's email validation.
const stamp = Date.now();
const base = env.TEST_EMAIL_BASE ?? "smart.inventory.rls@gmail.com";
const [local, domain] = base.split("@");
const mkEmail = (tag) => `${local}+rls_${tag}_${stamp}@${domain}`;

const PASSWORD = "Test-isolation-123";

let results = [];
const record = (name, passed, detail = "") =>
  results.push({ name, passed, detail });

const created = [];

/** Create a confirmed user and return an RLS-bound client already signed in. */
async function seedUser(tag) {
  const email = mkEmail(tag);

  const { data: createData, error: createErr } = await admin.auth.admin.createUser(
    { email, password: PASSWORD, email_confirm: true },
  );
  if (createErr) throw new Error(`createUser(${tag}): ${createErr.message}`);
  created.push(createData.user.id);

  // A fresh anon client, signed in as this user — subject to RLS.
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) throw new Error(`signIn(${tag}): ${signInErr.message}`);

  return { id: createData.user.id, email, client };
}

async function main() {
  console.log("Seeding two users in two organizations...\n");

  const a = await seedUser("a");
  const b = await seedUser("b");

  // Each user creates their own organization (as super admin).
  const { data: orgA, error: orgAErr } = await a.client.rpc(
    "create_organization",
    { p_name: "Alpha Traders", p_slug: `alpha-${stamp}` },
  );
  const { data: orgB, error: orgBErr } = await b.client.rpc(
    "create_organization",
    { p_name: "Beta Supplies", p_slug: `beta-${stamp}` },
  );
  if (orgAErr || orgBErr)
    throw new Error(`create_organization: ${orgAErr?.message ?? orgBErr?.message}`);

  console.log(`  A -> org ${orgA.id} (Alpha Traders)`);
  console.log(`  B -> org ${orgB.id} (Beta Supplies)\n`);
  console.log("Running isolation attacks (A must never touch B, and vice versa):\n");

  // 1. Each sees exactly their own org, and only it.
  {
    const { data } = await a.client.from("organizations").select("id");
    const ids = (data ?? []).map((r) => r.id);
    record(
      "A lists organizations -> only Alpha",
      ids.length === 1 && ids[0] === orgA.id,
      `saw ${ids.length}`,
    );
  }
  {
    const { data } = await b.client.from("organizations").select("id");
    const ids = (data ?? []).map((r) => r.id);
    record(
      "B lists organizations -> only Beta",
      ids.length === 1 && ids[0] === orgB.id,
      `saw ${ids.length}`,
    );
  }

  // 2. Direct read of the other's org by id -> zero rows.
  {
    const { data } = await a.client
      .from("organizations")
      .select("id")
      .eq("id", orgB.id);
    record("A reads Beta by id -> 0 rows", (data ?? []).length === 0);
  }

  // 3. Membership rows of the other org -> invisible.
  {
    const { data } = await a.client
      .from("organization_members")
      .select("id")
      .eq("org_id", orgB.id);
    record("A reads Beta memberships -> 0 rows", (data ?? []).length === 0);
  }

  // 4. Privilege escalation: A tries to add itself to Beta as super admin.
  {
    const { error } = await a.client
      .from("organization_members")
      .insert({ org_id: orgB.id, user_id: a.id, role: "super_admin" });
    record("A cannot join Beta", Boolean(error), error ? `(${error.code})` : "INSERTED!");
  }

  // 5. Tampering: A tries to rename Beta.
  {
    const { data } = await a.client
      .from("organizations")
      .update({ name: "Hijacked" })
      .eq("id", orgB.id)
      .select("id");
    record("A cannot rename Beta", (data ?? []).length === 0);
  }

  // 6. A reads B's profile -> denied (they share no organization).
  {
    const { data } = await a.client
      .from("profiles")
      .select("id")
      .eq("id", b.id);
    record("A cannot read B's profile", (data ?? []).length === 0);
  }

  // 7. A still sees its OWN data (isolation must not mean "deny everything").
  {
    const { data } = await a.client
      .from("organizations")
      .select("id")
      .eq("id", orgA.id);
    record("A can still read its own org", (data ?? []).length === 1);
  }

  // 8. Symmetric spot check: B cannot read Alpha.
  {
    const { data } = await b.client
      .from("organizations")
      .select("id")
      .eq("id", orgA.id);
    record("B reads Alpha by id -> 0 rows", (data ?? []).length === 0);
  }

  // 9. Catalog tables: B seeds one row in each, A must not see or write it.
  //    This runs automatically for every table added to CATALOG_TABLES, so the
  //    same harness re-proves isolation as the schema grows.
  const CATALOG_TABLES = {
    categories: { name: "B-secret-category" },
    suppliers: { company_name: "B-secret-supplier" },
    warehouses: { name: "B-secret-warehouse" },
    products: { name: "B-secret-product", sku: `bsku-${stamp}` },
  };

  for (const [table, extra] of Object.entries(CATALOG_TABLES)) {
    // B creates a row in its own org.
    const { data: made, error: makeErr } = await b.client
      .from(table)
      .insert({ org_id: orgB.id, ...extra })
      .select("id")
      .single();

    if (makeErr || !made) {
      record(`B can create its own ${table}`, false, makeErr?.message ?? "no row");
      continue;
    }
    record(`B can create its own ${table}`, true);

    // A tries to read it -> denied.
    const { data: seen } = await a.client
      .from(table)
      .select("id")
      .eq("id", made.id);
    record(`A cannot read B's ${table}`, (seen ?? []).length === 0);

    // A tries to write into B's org -> denied by the write policy.
    const { error: writeErr } = await a.client
      .from(table)
      .insert({ org_id: orgB.id, ...extra });
    record(
      `A cannot create ${table} in Beta`,
      Boolean(writeErr),
      writeErr ? `(${writeErr.code})` : "INSERTED!",
    );
  }
}

try {
  await main();
} catch (err) {
  console.error(`\nSetup failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  // Teardown. organizations.created_by is ON DELETE RESTRICT, so a user cannot
  // be deleted while they still own an org. Delete their orgs first (cascading
  // members/products/etc.), then the users. The service key bypasses RLS.
  for (const id of created) {
    await admin.from("organizations").delete().eq("created_by", id);
  }
  let removed = 0;
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) removed++;
  }
  if (created.length) {
    console.log(`\nCleaned up ${removed}/${created.length} test user(s).`);
  }
}

if (results.length) {
  console.log("");
  let failures = 0;
  for (const r of results) {
    if (!r.passed) failures++;
    console.log(
      `  ${r.passed ? "ok  " : "FAIL"}  ${r.name}${r.detail ? `  ${r.detail}` : ""}`,
    );
  }
  console.log(
    failures === 0
      ? "\nTenant isolation holds. Neither organization can reach the other's data."
      : `\n${failures} FAILURE(S) — data is leaking across tenants. Do not proceed.`,
  );
  process.exitCode = failures === 0 ? process.exitCode ?? 0 : 1;
}

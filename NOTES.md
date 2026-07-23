# Smart Inventory — Study Notes

A reference for the theory and syntax behind this project. Written to be read
*after* building, to consolidate what the code was doing and why.

Versions this was written against: **Next.js 16.2.10**, React 19.2.4,
`@supabase/ssr` 0.12.3, Tailwind CSS v4, shadcn/ui 4.13.1, Node 24, npm 11.

---

## Table of contents

1. [The big picture](#1-the-big-picture)
2. [The stack, and what each piece does](#2-the-stack-and-what-each-piece-does)
3. [Next.js App Router](#3-nextjs-app-router)
4. [Server vs Client Components](#4-server-vs-client-components)
5. [Next.js 16 breaking changes](#5-nextjs-16-breaking-changes)
6. [TypeScript you actually need](#6-typescript-you-actually-need)
7. [Tailwind v4 and shadcn/ui](#7-tailwind-v4-and-shadcnui)
8. [Supabase: the three clients](#8-supabase-the-three-clients)
9. [SQL for this project](#9-sql-for-this-project)
10. [Row Level Security](#10-row-level-security)
11. [Migrations](#11-migrations)
12. [Git](#12-git)
13. [Roadmap and the concepts in each phase](#13-roadmap-and-the-concepts-in-each-phase)
14. [Command reference](#14-command-reference)
15. [Gotchas we actually hit](#15-gotchas-we-actually-hit)

---

## 1. The big picture

We are building a multi-tenant SaaS. "Multi-tenant" means many separate
businesses (tenants) share one database and one deployment, while being unable
to see each other's data.

Request flow:

```
Browser
  ↓
Vercel (runs Next.js)
  ↓  proxy.ts refreshes the auth session
  ↓  Server Component runs
  ↓
Supabase Postgres
  ↓  Row Level Security filters rows by organization
  ↓
back up as finished HTML
```

The critical idea: **security lives in the database, not the application.** If a
page forgets to filter by organization, RLS still refuses to return other
tenants' rows. The app is a convenience layer; Postgres is the enforcement layer.

---

## 2. The stack, and what each piece does

| Piece | Job |
|---|---|
| **Next.js** | React framework. Routing, server rendering, bundling, API endpoints. |
| **React** | Builds the UI out of components. |
| **TypeScript** | JavaScript with type checking. Catches errors before runtime. |
| **Tailwind CSS** | Styling via utility classes in markup instead of separate CSS files. |
| **shadcn/ui** | Pre-built accessible components, copied into your repo (not installed as a dependency). |
| **Supabase** | Hosted Postgres + auth + file storage + realtime, all behind one SDK. |
| **PostgreSQL** | The actual database. Relational, transactional, extremely capable. |
| **Vercel** | Hosting. Watches GitHub and redeploys on push. |
| **Gemini** | The LLM for the assistant and forecast explanations (Phase 6). |

---

## 3. Next.js App Router

### Routing is the folder structure

There is no route config file. A folder under `src/app/` with a `page.tsx`
becomes a URL.

```
src/app/page.tsx                    →  /
src/app/products/page.tsx           →  /products
src/app/products/[id]/page.tsx      →  /products/123    (dynamic segment)
src/app/(dashboard)/settings/page.tsx →  /settings      (route group)
```

### Special filenames

| File | Purpose |
|---|---|
| `page.tsx` | The page at this URL. **Required** for the route to exist. |
| `layout.tsx` | Wraps this route and everything under it. Persists across navigation — does **not** re-render. |
| `loading.tsx` | Shown automatically while the page's data loads. |
| `error.tsx` | Catches errors in this segment. Must be a Client Component. |
| `not-found.tsx` | Rendered by `notFound()`. |
| `route.ts` | An API endpoint instead of a page. Cannot coexist with `page.tsx` in the same folder. |

`layout.tsx` not re-rendering is why your sidebar will not flicker when
navigating between pages.

### Dynamic segments

Folder named `[id]`. In **Next.js 16, `params` is a Promise** and must be awaited:

```tsx
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params     // ← the await is mandatory in 16
  return <h1>Product {id}</h1>
}
```

### Route groups

A folder in parentheses organises files **without** adding a URL segment:

```
src/app/(auth)/login/page.tsx      →  /login      (not /auth/login)
src/app/(dashboard)/products/...   →  /products
```

Useful for giving the authenticated area a different `layout.tsx` than the
login pages.

### Navigation

```tsx
import Link from "next/link"

<Link href="/products">Products</Link>       // preferred: prefetches
```

```tsx
"use client"
import { useRouter } from "next/navigation"  // note: next/navigation, not next/router

const router = useRouter()
router.push("/products")
```

---

## 4. Server vs Client Components

**The single most important concept in this framework.**

Everything under `src/app/` is a **Server Component by default**. It runs on the
server, never ships to the browser, and can talk to the database directly.

```tsx
// Server Component — the default, no directive needed
export default async function ProductsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from("products").select("*")
  return <ProductTable data={data} />
}
```

No API route. No `useEffect`. No loading spinner. No exposed credentials.

Add `"use client"` **only** when you need browser features:

```tsx
"use client"                      // must be the first line in the file
import { useState } from "react"

export function QuantityInput() {
  const [qty, setQty] = useState(0)
  return <input value={qty} onChange={(e) => setQty(+e.target.value)} />
}
```

### When you need which

| Need | Type |
|---|---|
| `useState`, `useEffect`, custom hooks | Client |
| `onClick`, `onChange`, any event handler | Client |
| `window`, `localStorage`, camera, geolocation | Client |
| React Context providers | Client |
| Reading the database | Server |
| Using secrets / API keys | Server |
| Sending less JavaScript to the browser | Server |

### The rule that actually matters

`"use client"` is a **boundary**, not a label. Everything a client file imports
also gets pulled into the browser bundle. So mark the small interactive widget,
never the page that contains it.

```tsx
// GOOD: layout stays a Server Component, only Search ships to the browser
export default function Layout({ children }) {
  return (
    <nav>
      <Logo />        {/* Server */}
      <Search />      {/* Client — "use client" is inside search.tsx */}
    </nav>
  )
}
```

### Passing Server Components into Client Components

Children passed as props are **not** pulled into the client bundle. They render
on the server and arrive as finished output:

```tsx
// modal.tsx is "use client"
<Modal>
  <Cart />     {/* Cart stays a Server Component */}
</Modal>
```

Props crossing the boundary must be **serializable** — no functions, no class
instances, no `Date` methods surviving. Plain objects, arrays, strings, numbers.

---

## 5. Next.js 16 breaking changes

Most tutorials online predate these. If you copy code that doesn't match, this
is usually why.

**1. `middleware.ts` is now `proxy.ts`**, and the exported function is `proxy`:

```ts
// src/proxy.ts
export async function proxy(request: NextRequest) { ... }
```

Runtime is Node.js only; `edge` is not supported in `proxy`.

**2. Request APIs are async.** These all return Promises now:

```ts
const cookieStore = await cookies()
const headerList  = await headers()
const { id }      = await params
const query       = await searchParams
```

Forgetting an `await` here is the most common error you'll hit.

**3. `next lint` was removed.** `package.json` uses `"lint": "eslint"`.

**4. Turbopack is the default** for both `next dev` and `next build`.

**5. `revalidateTag` takes a second argument:**

```ts
revalidateTag("products", "max")   // 16
updateTag("products")              // new: read-your-writes, Server Actions only
```

> The complete docs ship inside the package at `node_modules/next/dist/docs/`.
> That is the authoritative source — more current than most blog posts.

---

## 6. TypeScript you actually need

You do not need advanced TypeScript for this project. This covers ~95% of it.

```ts
// Basic annotations
const name: string = "Widget"
const price: number = 9.99
const active: boolean = true
const tags: string[] = ["a", "b"]

// Object shapes
type Product = {
  id: string
  name: string
  price: number
  description?: string      // ? = optional
  supplierId: string | null // union: this or null
}

// Functions
function total(qty: number, price: number): number {
  return qty * price
}

// Generics — "an array of Product"
const products: Array<Product> = []

// The non-null assertion: "trust me, this isn't null"
process.env.NEXT_PUBLIC_SUPABASE_URL!
```

That last one appears in our Supabase clients. `process.env.X` is typed
`string | undefined`; the `!` tells TypeScript it will be set. It suppresses the
type error but does **not** make the value exist at runtime — which is exactly
why the app crashed until `.env.local` was created.

### Types from your database

Once the schema exists you can generate types from it, so queries are checked
against real columns:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

Then a typo like `.select("nmae")` becomes a compile error.

---

## 7. Tailwind v4 and shadcn/ui

### Tailwind

Style with utility classes directly in markup:

```tsx
<div className="flex items-center gap-4 rounded-lg border p-4">
```

| Pattern | Meaning |
|---|---|
| `p-4` `px-6` `py-2` | padding: all / horizontal / vertical |
| `m-4` `mx-auto` | margin; `mx-auto` centres a block |
| `flex` `grid` | display mode |
| `gap-4` | space between flex/grid children |
| `text-sm` `font-medium` | type size and weight |
| `rounded-lg` `border` | radius and 1px border |
| `md:flex-row` | applies at ≥768px (mobile-first) |
| `dark:bg-black` | applies in dark mode |
| `hover:bg-muted` | on hover |

Tailwind v4 configures itself in CSS, not `tailwind.config.js`:

```css
@import "tailwindcss";

@theme inline {
  --color-primary: var(--primary);
  --font-sans: var(--font-geist-sans);
}
```

### Semantic colours

Use `bg-background`, `text-foreground`, `text-muted-foreground`,
`bg-primary`, `border-border` rather than `bg-white`/`text-black`. They're
defined once as CSS variables and automatically flip in dark mode.

### shadcn/ui

```bash
npx shadcn@latest add button card table dialog form input
```

This **copies source files into `src/components/ui/`**. They're yours — edit
them freely. Nothing to override, no theming API to fight. The tradeoff is that
you own updates.

### `cn()`

In `src/lib/utils.ts`. Merges class names and resolves Tailwind conflicts:

```tsx
cn("px-2 py-1", isLarge && "px-4")   // → "py-1 px-4"  (px-4 wins correctly)
```

---

## 8. Supabase: the three clients

Three environments need three clients. Using the wrong one is a common bug.

### Browser — `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
```

For Client Components. Runs in the browser, so only ever the publishable key.

### Server — `src/lib/supabase/server.ts`

```ts
export async function createClient() {
  const cookieStore = await cookies()   // async in Next 16
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        } catch {
          // Server Components can't write cookies — safe to ignore
          // *because* proxy.ts handles the refresh
        }
      },
    },
  })
}
```

For Server Components, Server Actions, Route Handlers. **Must be awaited:**

```ts
const supabase = await createClient()
```

### Proxy — `src/proxy.ts`

Refreshes the expiring access token on every request and writes the new cookie
to both the request (so the Server Component about to run sees it) and the
response (so the browser stores it).

Two rules that cause impossible-to-reproduce bugs if broken:

1. **Put no code between `createServerClient()` and `getClaims()`.** Anything in
   between can drop the session at random.
2. **Return the exact `supabaseResponse` object.** Building a fresh
   `NextResponse` discards the refreshed cookies.

### `getClaims()` vs `getSession()` vs `getUser()`

| Method | Verifies the JWT? | Use for |
|---|---|---|
| `getSession()` | ❌ trusts the cookie | never, for authorization |
| `getClaims()` | ✅ verifies signature locally | **server-side authorization** |
| `getUser()` | ✅ asks the auth server | when you need the full user record |

Cookies can be forged. `getSession()` believes them. **Never authorize on
`getSession()`.**

### Query syntax

```ts
// select
const { data, error } = await supabase
  .from("products")
  .select("id, name, price, categories(name)")   // join via foreign key
  .eq("org_id", orgId)
  .ilike("name", `%${term}%`)                    // case-insensitive contains
  .gte("price", 100)
  .order("created_at", { ascending: false })
  .range(0, 19)                                  // pagination: rows 0–19

// insert
await supabase.from("products").insert({ name: "Widget", price: 9.99 })

// update
await supabase.from("products").update({ price: 12.99 }).eq("id", id)

// delete
await supabase.from("products").delete().eq("id", id)

// count without fetching rows
const { count } = await supabase
  .from("products")
  .select("*", { count: "exact", head: true })
```

**`error` is returned, not thrown.** Always check it:

```ts
if (error) { /* handle */ }
```

### Supabase Realtime

Tables added to the `supabase_realtime` publication stream their row changes to
subscribed browsers over a websocket. Two rules we rely on:

- **Realtime enforces RLS per subscriber** — proven by test: a user from
  another org who subscribes to the same feed receives zero events.
- **Use events as a doorbell, not a payload.** On any event, call
  `router.refresh()` and let the Server Component refetch. Never patch client
  state from the event — then there is nothing to get out of sync.

```ts
supabase
  .channel(`stock-levels-${orgId}`)
  .on("postgres_changes",
    { event: "*", schema: "public", table: "stock_levels",
      filter: `org_id=eq.${orgId}` },
    () => router.refresh())
  .subscribe()
```

---

## 9. SQL for this project

### Creating tables

```sql
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  sku         text not null,
  price       numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),

  unique (org_id, sku)          -- SKU unique per organization, not globally
);
```

| Type | Use for |
|---|---|
| `uuid` | primary keys (unguessable, safe to expose in URLs) |
| `text` | all strings — no need for `varchar(n)` in Postgres |
| `numeric(12,2)` | **money** — never `float`, which loses precision |
| `integer` | quantities |
| `timestamptz` | timestamps — always this, never `timestamp` |
| `boolean` | flags |
| `jsonb` | unstructured data |

### Constraints

```sql
not null                                    -- required
unique (org_id, sku)                        -- unique combination
references organizations(id) on delete cascade  -- FK; delete children with parent
check (quantity >= 0)                       -- validity rule enforced by the DB
```

### Enums

```sql
create type order_status as enum ('draft','pending','approved','received','cancelled');
```

Better than `text` — the database rejects invalid values outright.

### Indexes

Add one for any column you filter or join on frequently:

```sql
create index products_org_id_idx on public.products (org_id);
create index products_name_trgm_idx on public.products using gin (name gin_trgm_ops);
```

Without indexes, queries scan every row. Fine at 100 products, painful at 100,000.

### Joins

```sql
select p.name, c.name as category, s.company_name as supplier
from products p
left join categories c on c.id = p.category_id
left join suppliers  s on s.id = p.supplier_id
where p.org_id = '...';
```

`inner join` drops rows with no match; `left join` keeps them with `null`.

### Aggregates

```sql
select category_id, count(*) as items, sum(price * quantity) as value
from products
group by category_id
having count(*) > 5;
```

`where` filters rows **before** grouping; `having` filters groups **after**.

### Recursive CTEs — nested categories (Phase 2)

A query that calls itself. This walks a category tree to any depth:

```sql
with recursive tree as (
  select id, name, parent_id, 1 as depth
  from categories
  where parent_id is null            -- anchor: the roots

  union all

  select c.id, c.name, c.parent_id, t.depth + 1
  from categories c
  join tree t on c.parent_id = t.id  -- recursive: children of what we found
)
select * from tree order by depth;
```

### Functions and triggers (Phase 3)

Triggers keep derived data correct no matter which code path writes:

```sql
create function update_stock_level()
returns trigger
language plpgsql
as $$
begin
  insert into stock_levels (product_id, warehouse_id, quantity)
  values (new.product_id, new.warehouse_id, new.quantity)
  on conflict (product_id, warehouse_id)
  do update set quantity = stock_levels.quantity + new.quantity;
  return new;
end;
$$;

create trigger on_stock_movement
  after insert on stock_movements
  for each row execute function update_stock_level();
```

Now *every* insert into `stock_movements` updates the level — including manual
SQL, imports, and code you write in six months.

### Transactions

Either all of it happens or none of it:

```sql
begin;
  insert into stock_movements (...) values (...);  -- out of warehouse A
  insert into stock_movements (...) values (...);  -- into warehouse B
commit;
```

Essential for transfers — a crash halfway must not destroy stock.

---

## 10. Row Level Security

**The most important topic in this project.**

RLS makes the *database* decide which rows a user may see. Even a buggy query
cannot leak another organization's data.

### Enabling it

```sql
alter table public.products enable row level security;
```

New tables have RLS **off**, meaning anyone with the publishable key can read
and write everything. Turning it on flips the default to **deny all**; policies
then grant access back.

**Every table gets this line. No exceptions.**

### Policy anatomy

```sql
create policy "members read their org's products"
  on public.products              -- table
  for select                      -- select | insert | update | delete | all
  to authenticated                -- which role
  using (org_id in (select ...)); -- row visibility test
```

- **`using`** — which existing rows are visible (SELECT/UPDATE/DELETE)
- **`with check`** — which new rows may be written (INSERT/UPDATE)

```sql
create policy "managers add products"
  on public.products
  for insert
  to authenticated
  with check (org_id in (select ...));   -- can't insert into someone else's org
```

### Useful helpers

```sql
auth.uid()    -- the logged-in user's id, from the verified JWT
auth.role()   -- 'authenticated' or 'anon'
auth.jwt()    -- full claims
```

### ⚠️ The infinite recursion trap

This looks right and will break everything:

```sql
-- DO NOT DO THIS
create policy "members see their memberships"
  on organization_members
  for select
  using (
    org_id in (select org_id from organization_members where user_id = auth.uid())
  );
```

To check the policy on `organization_members`, Postgres must query
`organization_members`, which triggers the policy, which queries the table…
`infinite recursion detected in policy`.

**The fix** — a `SECURITY DEFINER` function, which runs as its owner and so
bypasses RLS on the tables it touches:

```sql
create function public.user_org_ids()
returns setof uuid
language sql
security definer          -- runs as the function's owner, skipping RLS
stable                    -- same result within a query → Postgres caches it
set search_path = public  -- prevents search_path hijacking
as $$
  select org_id from organization_members where user_id = auth.uid();
$$;

create policy "members see their memberships"
  on organization_members
  for select
  using (org_id in (select public.user_org_ids()));
```

Then every other table reuses it:

```sql
create policy "org members read products"
  on products for select to authenticated
  using (org_id in (select public.user_org_ids()));
```

> `security definer` is powerful and easy to misuse. Always pin
> `set search_path`, and keep the function's body as narrow as possible.

### Testing RLS

Never assume — attack it:

```sql
-- impersonate a user in the SQL editor
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-uuid>"}';

select * from products;   -- must return ONLY that user's org rows
```

The Phase 1 checkpoint is exactly this: two accounts, two orgs, and proof that
neither can read the other.

---

## 11. Migrations

**Rule: schema changes are `.sql` files in git. Never clicks in the dashboard.**

Why: your schema becomes reviewable in diffs, revertible, and reproducible on a
fresh project. Dashboard clicking produces a database nobody can rebuild.

```bash
npx supabase migration new add_products   # creates a timestamped .sql file
# ...write the SQL...
npx supabase db push                      # apply to the cloud database
npx supabase migration list               # compare local vs remote
```

Filenames are `<timestamp>_<name>.sql` and apply **in timestamp order**. Never
edit a migration that has already been pushed — write a new one that alters it.

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

Run that after every schema change to keep TypeScript in sync with reality.

---

## 12. Git

```bash
git status                  # what changed
git add -A                  # stage everything
git commit -m "message"     # snapshot to LOCAL history
git push                    # upload to GitHub
git log --oneline           # history
git diff                    # unstaged changes
```

### Commit vs push — the distinction that confused us

| | What it does | Needs network? |
|---|---|---|
| **commit** | saves a snapshot in `.git` on your disk | no |
| **push** | uploads those commits to GitHub | **yes, and authentication** |

`git config user.name` sets the **name written on** a commit. It has nothing to
do with **permission to push**. If setting a name granted access, anyone could
set `user.name = torvalds` and push to the Linux kernel.

### Credentials

Never put tokens in commands or paste them into chats — they persist in shell
history and logs. Let Git Credential Manager do browser OAuth:

```bash
git push -u origin main     # opens a browser, remembers afterwards
```

If the wrong cached account is used, scope the remote to the right one:

```bash
git remote set-url origin https://USERNAME@github.com/USERNAME/repo.git
```

---

## 13. Roadmap and the concepts in each phase

| Phase | Building | Concepts to learn |
|---|---|---|
| **0** ✅ | Setup, deploy pipeline | App Router, Server/Client Components, env vars, migrations |
| **1** ✅ | Auth + organizations | **RLS**, policies, `security definer`, OAuth, JWT, triggers |
| **2** ✅ | Products, categories, warehouses, suppliers | CRUD pattern, Zod, React Hook Form, recursive CTEs, file storage |
| **3** ✅ | Inventory ledger | Append-only design, triggers, transactions, realtime, concurrency |
| **4** | Purchases + sales | State machines, order lifecycles, PDF generation |
| **5** | Dashboard, reports, search, notifications | Views, indexes, full-text search, charts, realtime |
| **6** | AI assistant + forecasting | Tool calling, moving averages, seasonality, RAG |
| **7** | Hardening | Monitoring, performance, accessibility, security review |

### Design decisions worth being able to defend

**Stock is a ledger, not a number.** Rather than `products.stock_quantity` with
`UPDATE ... SET stock = stock - 1`, every movement is a row in an append-only
`stock_movements` table, and `stock_levels` is maintained by a trigger.

- keeps full history (audit log nearly free)
- safe under concurrent orders — no lost updates
- gives forecasting real data to learn from
- lets you reconstruct stock at any past date

**The AI never writes SQL.** The assistant uses Gemini function calling against
a fixed set of parameterized queries that still run under RLS. LLM-generated SQL
is an injection risk and hallucinates column names.

**Forecasting is statistical; the LLM only explains it.** Moving averages and
seasonal decomposition compute the numbers. Language models are unreliable at
arithmetic extrapolation.

---

## 14. Command reference

```bash
# Dev
npm run dev                 # start dev server (localhost:3000)
npm run build               # production build — run before pushing
npx tsc --noEmit            # typecheck only
npm run lint                # eslint

# shadcn
npx shadcn@latest add <component>

# Supabase
npx supabase migration new <name>
npx supabase db push
npx supabase migration list
npx supabase gen types typescript --linked > src/lib/database.types.ts

# Git
git add -A && git commit -m "msg" && git push
```

### Environment variables

| Prefix | Visibility |
|---|---|
| `NEXT_PUBLIC_*` | **compiled into the browser bundle — public forever** |
| no prefix | server only |

`.env.local` is gitignored. `.env.example` is committed and documents what's
needed. Anything in Vercel must be added to **Production, Preview and
Development** separately.

**Publishable key** (`sb_publishable_…`) is meant to be public; RLS is what
protects your data. **Secret key** (`sb_secret_…`) bypasses RLS entirely —
server-only, never `NEXT_PUBLIC_`, never pasted anywhere.

---

## 15. Gotchas we actually hit

Each of these failed **silently** — no error, just wrong behaviour. That's the
category to watch for.

**1. Self-referential CSS variable.** shadcn's installer wrote
`--font-sans: var(--font-sans)`. A variable defined as itself resolves to
nothing, so the page rendered in Times New Roman with no warning.
→ *Verify what tools generate for you.*

**2. Wrong GitHub account on push.** Two accounts were cached in Windows
Credential Manager. Commits were authored correctly but the push used a
different identity, failing with a 403 only at the end.
→ *Identity and authentication are separate systems.*

**3. `.env*` also ignored `.env.example`.** The template documenting required
variables would never have been committed, so a fresh clone couldn't run.
→ *Negation rule: `!.env.example`.*

**4. Missing env vars crash every request.** `proxy.ts` calls
`createServerClient()` on every request; without env vars, **every route returns
500** — not a degraded page, a dead site.
→ *Set env vars in Vercel before pushing code that needs them.*

**5. Route silently became dynamic.** Adding a Supabase query flipped `/` from
`○ Static` to `ƒ Dynamic`, costing a server round-trip per visit. Correct here,
but watch it on pages that don't need per-user data.
→ *Read the route table in `next build` output.*

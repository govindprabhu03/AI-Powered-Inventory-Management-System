import Link from "next/link";

import { ProductRowActions } from "@/components/products/product-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getPrimaryImageUrls } from "@/lib/data/product-images";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Products · Smart Inventory" };

const PAGE_SIZE = 20;
const SORTABLE = new Set(["name", "sku", "selling_price", "created_at"]);

// PostgREST's .or() treats commas and parentheses as syntax, so strip anything
// that isn't a plain search character before interpolating user input.
function sanitize(term: string) {
  return term.replace(/[,()*\\%]/g, " ").trim().slice(0, 100);
}

function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
  }).format(n);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
    archived?: string;
  }>;
}) {
  const ctx = await requireContext();
  const canEdit = canEditCatalog(ctx.activeOrg.role);
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = SORTABLE.has(sp.sort ?? "") ? sp.sort! : "created_at";
  const ascending = sp.dir === "asc";
  const showArchived = sp.archived === "1";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Note: no org filter here — RLS restricts rows to the active org's tenant.
  // The join pulls category and supplier names in one round trip.
  let query = supabase
    .from("products")
    .select(
      "id, name, sku, selling_price, is_archived, categories(name), suppliers(company_name)",
      { count: "exact" },
    );

  if (!showArchived) query = query.eq("is_archived", false);

  if (q) {
    const safe = sanitize(q);
    if (safe) query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
  }

  const { data: products, count } = await query
    .order(sort, { ascending })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Primary-image thumbnails for the products on this page, batch-signed.
  const thumbs = await getPrimaryImageUrls((products ?? []).map((p) => p.id));

  // Preserve the current filters when building sort/pagination links.
  const qs = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sp.sort) params.set("sort", sp.sort);
    if (sp.dir) params.set("dir", sp.dir);
    if (showArchived) params.set("archived", "1");
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `?${params.toString()}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/products/labels">Print labels</Link>}
          />
          {/* Plain <a> download, not a Link — the Route Handler streams a file. */}
          <Button variant="outline" size="sm" nativeButton={false} render={<a href="/products/export">Export CSV</a>} />
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/products/import">Import CSV</Link>}
            />
          )}
          {canEdit && (
            <Button
              nativeButton={false}
              render={<Link href="/products/new">Add product</Link>}
            />
          )}
        </div>
      </div>

      {/* Plain GET form: search works without JavaScript, and the query lives
          in the URL so results are shareable and bookmarkable. */}
      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search name or SKU…"
          className="h-8 max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={showArchived}
          />
          Include archived
        </label>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {(q || showArchived) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/products">Clear</Link>}
          />
        )}
      </form>

      {products && products.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead>
                    <Link href={qs({ sort: "name", dir: ascending && sort === "name" ? "desc" : "asc" })}>
                      Name
                    </Link>
                  </TableHead>
                  <TableHead>
                    <Link href={qs({ sort: "sku", dir: ascending && sort === "sku" ? "desc" : "asc" })}>
                      SKU
                    </Link>
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">
                    <Link href={qs({ sort: "selling_price", dir: ascending && sort === "selling_price" ? "desc" : "asc" })}>
                      Price
                    </Link>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="size-9 overflow-hidden rounded border bg-muted">
                        {thumbs.get(p.id) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbs.get(p.id)}
                            alt=""
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.is_archived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.sku}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.categories?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.suppliers?.company_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(p.selling_price)}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <ProductRowActions
                          id={p.id}
                          archived={p.is_archived}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {/* A disabled <a> is still clickable, so at the bounds we render a
                  real disabled <button> instead of a link. */}
              {page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={qs({ page: String(page - 1) })}>Previous</Link>}
                />
              )}
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={qs({ page: String(page + 1) })}>Next</Link>}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {q ? "No products match your search." : "No products yet."}
          </p>
          {canEdit && !q && (
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/products/new">Add your first product</Link>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

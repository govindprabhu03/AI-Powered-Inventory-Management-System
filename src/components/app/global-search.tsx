"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Result = {
  kind: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
};

const KIND_LABEL: Record<string, string> = {
  product: "Product",
  supplier: "Supplier",
  customer: "Customer",
  purchase_order: "Purchase order",
  sales_order: "Sales order",
};

export function GlobalSearch({ orgId }: { orgId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // "/" focuses the search from anywhere (unless already typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search. A new keystroke cancels the pending one.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("global_search", {
        p_org_id: orgId,
        p_query: term,
      });
      setResults((data as Result[]) ?? []);
      setActive(0);
      setOpen(true);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, orgId]);

  const go = (r: Result) => {
    setOpen(false);
    setQuery("");
    router.push(r.url);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search products, orders, people…  (press /)"
          className="h-8 w-full rounded-lg border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-[28rem] max-w-[80vw] overflow-hidden rounded-lg border bg-popover shadow-md">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    onClick={() => go(r)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left",
                      i === active && "bg-accent text-accent-foreground",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      {r.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.subtitle}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

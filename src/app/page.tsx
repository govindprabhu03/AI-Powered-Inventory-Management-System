import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  LineChart,
  Package,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Warehouse,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Smart Inventory — AI-powered inventory management",
};

const FEATURES = [
  { icon: Boxes, tint: "chart-1", title: "Real-time stock", desc: "An append-only ledger across every warehouse. Stock can never go negative or drift — the database guarantees it." },
  { icon: ShoppingCart, tint: "chart-2", title: "Purchases & sales", desc: "Purchase and sales orders as real workflows: approve, receive, reserve, fulfil, return — with roles enforced." },
  { icon: LineChart, tint: "chart-3", title: "Demand forecasting", desc: "Moving-average demand and reorder suggestions computed from your own history. Statistics you can trust." },
  { icon: Sparkles, tint: "chart-5", title: "AI assistant", desc: "Ask what to reorder in plain English. Answers are grounded in your live data via safe, read-only tools." },
  { icon: Warehouse, tint: "chart-4", title: "Multi-warehouse", desc: "Transfer stock between locations atomically, track per-warehouse levels, and reserve against open orders." },
  { icon: BarChart3, tint: "chart-1", title: "Reports & analytics", desc: "Valuation, low & dead stock, best sellers, and a live dashboard — all exportable to CSV." },
];

const PILLARS = [
  { icon: ShieldCheck, label: "Multi-tenant, secured by Row Level Security" },
  { icon: Zap, label: "Real-time updates across every session" },
  { icon: ScanLine, label: "Mobile barcode & QR scanning" },
  { icon: Package, label: "Immutable audit log on every change" },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="size-4" />
            </span>
            Smart Inventory
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login">Sign in</Link>} />
            <Button size="sm" nativeButton={false} render={<Link href="/signup">Get started</Link>} />
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Decorative background: soft blobs + a faint grid. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] size-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-[-8rem] top-[6rem] size-[28rem] rounded-full bg-[var(--chart-5)]/15 blur-3xl" />
          <div className="absolute bottom-[-10rem] left-[-6rem] size-[26rem] rounded-full bg-[var(--chart-2)]/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(60%_50%_at_50%_35%,black,transparent)]"
            style={{
              backgroundImage:
                "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
        </div>

        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            AI-powered · built on Supabase &amp; Next.js
          </span>

          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Inventory that{" "}
            <span className="bg-gradient-to-r from-primary to-[var(--chart-5)] bg-clip-text text-transparent">
              runs itself
            </span>
          </h1>

          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            Track stock across warehouses in real time, run purchasing and sales
            with proper approvals, forecast demand, and ask an AI assistant what
            to reorder — for small and medium businesses.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" nativeButton={false} render={
              <Link href="/signup" className="gap-1.5">
                Get started free <ArrowRight className="size-4" />
              </Link>
            } />
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login">Live demo</Link>} />
          </div>

          <p className="text-xs text-muted-foreground">
            Try the demo — <span className="font-medium text-foreground">smartinventory.demo@gmail.com</span> /{" "}
            <span className="font-medium text-foreground">demo-inventory-2026</span>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, tint, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border bg-card/70 p-5 backdrop-blur-sm transition-colors hover:border-primary/40"
            >
              <span
                className="grid size-10 place-items-center rounded-xl"
                style={{ backgroundColor: `color-mix(in oklch, var(--${tint}) 18%, transparent)` }}
              >
                <Icon className="size-5" style={{ color: `var(--${tint})` }} />
              </span>
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Engineering pillars */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-3 rounded-2xl border bg-card/50 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-[var(--chart-5)]/10 p-10 text-center sm:p-16">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to get your inventory organized?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Create an organization in seconds, or explore the live demo. No card
            required.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" nativeButton={false} render={
              <Link href="/signup" className="gap-1.5">
                Start free <ArrowRight className="size-4" />
              </Link>
            } />
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login">Sign in</Link>} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <Boxes className="size-4 text-primary" /> Smart Inventory
          </span>
          <span>Next.js · Supabase · Gemini — a portfolio project</span>
        </div>
      </footer>
    </div>
  );
}

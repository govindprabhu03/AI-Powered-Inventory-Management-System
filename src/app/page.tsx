import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Smart Inventory
        </h1>
        <p className="text-lg text-muted-foreground">
          Track stock across warehouses, manage suppliers and orders, and get
          AI-powered forecasts — built for small and medium businesses.
        </p>
      </div>

      {/*
        `render` swaps the underlying element (Base UI's equivalent of Radix's
        `asChild`). Because the result is an <a>, not a <button>, we must also
        set nativeButton={false} — otherwise Base UI warns that native button
        semantics have been removed, which breaks keyboard and screen reader
        behaviour.
      */}
      <div className="flex gap-3">
        <Button
          nativeButton={false}
          render={<Link href="/signup">Get started</Link>}
        />
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/login">Sign in</Link>}
        />
      </div>
    </main>
  );
}

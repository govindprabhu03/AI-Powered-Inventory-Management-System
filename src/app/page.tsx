import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Phase 0 · Setup</p>
        <h1 className="text-3xl font-semibold tracking-tight">Smart Inventory</h1>
        <p className="text-muted-foreground">
          AI-powered inventory management for small and medium businesses.
        </p>
      </div>

      <div className="flex gap-2">
        <Button>Primary action</Button>
        <Button variant="outline">Secondary action</Button>
      </div>
    </main>
  );
}

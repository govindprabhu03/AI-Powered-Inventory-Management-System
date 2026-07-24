import { AssistantChat } from "@/components/assistant/chat";
import { requireContext } from "@/lib/auth/context";

export const metadata = { title: "Assistant · Smart Inventory" };

export default async function AssistantPage() {
  await requireContext();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Grounded in your live inventory — it answers only from real data via a
          fixed set of read-only tools.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}

"use server";

import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { runAssistant, type ChatMessage } from "@/lib/ai/gemini";
import { tools, toolsByName } from "@/lib/ai/tools";

export type AssistantResult =
  | { ok: true; answer: string; toolsUsed: string[] }
  | { ok: false; error: string };

/**
 * Ask the inventory assistant. The tools run under the RLS-bound server client
 * scoped to the active org, so the model can only ever read the user's own
 * data — and it can only call the fixed tools, never write SQL.
 */
export async function askAssistant(
  history: ChatMessage[],
): Promise<AssistantResult> {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Keep the last few turns to bound token use.
  const messages = history.slice(-8);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { ok: false, error: "Ask a question." };
  }

  const systemPrompt = [
    `You are the inventory assistant for "${ctx.activeOrg.name}", an inventory management system.`,
    "Answer questions about their stock, products, orders, suppliers and customers by calling the provided tools.",
    "Only state facts that come from tool results. If the tools return nothing relevant, say you don't have that information — never guess numbers.",
    "Amounts are in Indian Rupees (₹). Be concise and practical; use short lists where helpful.",
    "When asked what to reorder, use get_reorder_suggestions and explain briefly why (demand, days of cover).",
  ].join(" ");

  try {
    const { text, toolsUsed } = await runAssistant({
      messages,
      systemPrompt,
      toolDeclarations: tools.map((t) => t.declaration),
      executeTool: (name, args) => {
        const tool = toolsByName[name];
        if (!tool) return Promise.resolve({ error: `Unknown tool ${name}` });
        return tool.execute(args, { supabase, orgId: ctx.activeOrg.orgId });
      },
    });
    return { ok: true, answer: text, toolsUsed: [...new Set(toolsUsed)] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The assistant failed." };
  }
}

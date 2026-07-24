import "server-only";

/**
 * Minimal Gemini client with a function-calling loop, over the REST API (no
 * SDK dependency). The loop: send the conversation + tool declarations; if the
 * model asks to call tools, run them, feed the results back, and repeat until
 * it produces a final text answer (capped to avoid runaway loops).
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const endpoint = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export type ChatMessage = { role: "user" | "model"; text: string };

type ToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type Part =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: unknown } };

type Content = { role: string; parts: Part[] };

export async function runAssistant({
  messages,
  systemPrompt,
  toolDeclarations,
  executeTool,
}: {
  messages: ChatMessage[];
  systemPrompt: string;
  toolDeclarations: ToolDeclaration[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ text: string; toolsUsed: string[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      text: "The AI assistant isn't configured yet. Add GEMINI_API_KEY to the environment to enable it.",
      toolsUsed: [],
    };
  }

  const contents: Content[] = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
  const toolsUsed: string[] = [];

  for (let step = 0; step < 5; step++) {
    const res = await fetch(`${endpoint(MODEL)}?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: [{ functionDeclarations: toolDeclarations }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    const modelContent = data.candidates?.[0]?.content;
    const parts: Part[] = modelContent?.parts ?? [];
    const calls = parts.filter(
      (p): p is { functionCall: { name: string; args?: Record<string, unknown> } } =>
        "functionCall" in p,
    );

    if (calls.length === 0) {
      const text = parts
        .map((p) => ("text" in p ? p.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      return { text: text || "I couldn't find an answer to that.", toolsUsed };
    }

    // Record the model's tool-call turn, then run each tool and feed results back.
    contents.push(modelContent);
    const responseParts: Part[] = [];
    for (const c of calls) {
      const { name, args } = c.functionCall;
      toolsUsed.push(name);
      let result: unknown;
      try {
        result = await executeTool(name, args ?? {});
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "tool failed" };
      }
      responseParts.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { text: "I wasn't able to complete that request in time.", toolsUsed };
}

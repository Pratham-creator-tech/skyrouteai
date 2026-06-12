import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = { messages?: unknown; threadId?: string };

const SYSTEM_PROMPT = `You are SkyRoute AI, an autonomous logistics assistant embedded in a fleet command center.

You have read-only access to live data injected into each turn under "LIVE DATA SNAPSHOT". Use ONLY this data to ground your answers — never invent vehicle plates, delivery IDs, costs, or coordinates.

You help dispatchers and ops managers answer questions like:
- Which route is cheapest / most expensive?
- Which vehicle is overloaded or under-utilised?
- Which delivery is delayed or at risk?
- How can fuel costs and CO₂ be reduced?

Style:
- Lead with the direct answer (1 sentence), then a short bulleted breakdown with the specific IDs / numbers from the snapshot.
- Use markdown tables for comparisons.
- End with one concrete "Recommended action".
- If the snapshot lacks the data, say so plainly and suggest what to capture next.
- Keep responses concise and operational — no fluff.`;

async function buildSnapshot(authHeader: string | null) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon || !authHeader) return "No live data available (not authenticated).";

  const sb = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [d, v, r, w, a] = await Promise.all([
    sb.from("deliveries").select("*").limit(80),
    sb.from("vehicles").select("*").limit(60),
    sb.from("routes").select("*").limit(60),
    sb.from("warehouses").select("*").limit(40),
    sb.from("ai_decisions").select("agent_name,decision,reasoning,created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const trim = (rows: any[] | null) =>
    (rows ?? []).map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(row)) {
        if (val == null) continue;
        if (k === "id" && typeof val === "string") out[k] = val.slice(0, 8);
        else out[k] = val;
      }
      return out;
    });

  return JSON.stringify({
    deliveries: trim(d.data),
    vehicles: trim(v.data),
    routes: trim(r.data),
    warehouses: trim(w.data),
    recent_ai_decisions: trim(a.data),
    generated_at: new Date().toISOString(),
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as Body;
        if (!Array.isArray(messages)) return new Response("messages required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        const snapshot = await buildSnapshot(authHeader);

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: `${SYSTEM_PROMPT}\n\nLIVE DATA SNAPSHOT (JSON):\n${snapshot}`,
          messages: convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});

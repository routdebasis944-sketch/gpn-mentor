import { createFileRoute } from "@tanstack/react-router";

/**
 * Streaming chat endpoint for Gpn AI.
 *
 * Proxies the conversation to the Lovable AI Gateway and streams the
 * server-sent events straight back to the browser. The system prompt
 * (the Gpn AI persona) is injected server-side so it never reaches the
 * client bundle, and the gateway API key stays server-only.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI gateway not configured", { status: 503 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        const messages = (payload as { messages?: unknown } | null)?.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages array is required", { status: 400 });
        }

        const upstream = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages,
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Gateway error", {
            status: upstream.status || 502,
          });
        }

        // Pass the SSE stream through unchanged.
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});

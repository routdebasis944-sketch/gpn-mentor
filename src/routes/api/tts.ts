import { createFileRoute } from "@tanstack/react-router";

/**
 * Text-to-speech endpoint for Gpn AI.
 *
 * Calls the Lovable AI Gateway's /v1/audio/speech endpoint server-side
 * (the API key never reaches the browser) and returns an MP3 file.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";
const MODEL = "openai/gpt-4o-mini-tts";

export const Route = createFileRoute("/api/tts")({
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

        const text = (payload as { text?: unknown } | null)?.text;
        if (typeof text !== "string" || !text.trim()) {
          return new Response("text is required", { status: 400 });
        }

        const upstream = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            input: text.slice(0, 2000),
            voice: "alloy",
            response_format: "mp3",
          }),
        });

        if (!upstream.ok) {
          const errText = await upstream.text().catch(() => "");
          return new Response(errText || "TTS failed", {
            status: upstream.status || 502,
          });
        }

        const audio = await upstream.arrayBuffer();
        return new Response(audio, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});

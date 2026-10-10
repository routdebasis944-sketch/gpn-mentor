// Server-only helper: one streamed Lovable AI Gateway Responses call, accumulated into JSON.
const URL_ = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function askJSON<T>(system: string, user: string, schema: { name: string; schema: object }): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(503, "AI is not configured");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: system,
      input: user,
      text: { format: { type: "json_schema", name: schema.name, strict: true, schema: schema.schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let msg = "AI request failed";
    try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg; } catch { /* keep default */ }
    if (res.status === 429) msg = "Too many requests right now — please try again in a minute.";
    if (res.status === 402) msg = "AI credits are used up for this workspace.";
    throw new AiError(res.status, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (ev.type === "response.output_text.delta") out += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new AiError(502, ev.response?.error?.message ?? ev.message ?? "AI failed");
      } catch (e) { if (e instanceof AiError) throw e; }
    }
  }
  try { return JSON.parse(out) as T; } catch { throw new AiError(502, "AI returned an unreadable answer, please retry."); }
}

export const errResponse = (e: unknown) =>
  Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: e instanceof AiError ? e.status : 500 });

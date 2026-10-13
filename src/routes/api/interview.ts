import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { askJSON, errResponse } from "@/lib/ai.server";

const S = { type: "string" };
const Body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("questions"), branch: z.string().min(1).max(80) }),
  z.object({ step: z.literal("intro"), branch: z.string().min(1).max(80), lang: z.enum(["en", "hi"]).default("en"), text: z.string().max(3000) }),
  z.object({
    step: z.literal("evaluate"), branch: z.string().min(1).max(80),
    lang: z.enum(["en", "hi"]).default("en"),
    qa: z.array(z.object({
      q: z.string().max(600), a: z.string().max(3000),
      delivery: z.object({
        wpm: z.number(), fillers: z.number(), fillerWords: z.array(z.string()).max(50), longPauses: z.number(),
        longestPause: z.number(), startDelay: z.number(), confidence: z.number(), clarity: z.number(), hesitation: z.boolean(),
      }).nullable().optional(),
    })).length(3),
  }),
]);

export const Route = createFileRoute("/api/interview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const p = Body.safeParse(await request.json().catch(() => null));
        if (!p.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const d = p.data;
        try {
          if (d.step === "intro") {
            const r = await askJSON<{ name: string; college: string; branch: string; ack: string }>(
              `You are Debasis, a warm technical interviewer. The student just introduced themselves. Extract their name, college and branch (empty string if not mentioned; never invent). Then write "ack": 1-2 short spoken sentences that politely thank them by name, mention their college and branch if given, and say you'll now ask 3 technical questions. Write "ack" ${d.lang === "hi" ? "in simple Hindi (Devanagari)" : "in simple English"}. Do not include the questions.`,
              `Selected branch: ${d.branch}\nIntroduction: ${d.text || "(no introduction)"}`,
              { name: "intro", schema: { type: "object", additionalProperties: false, required: ["name", "college", "branch", "ack"], properties: { name: S, college: S, branch: S, ack: S } } },
            );
            return Response.json(r);
          }
          if (d.step === "questions") {
            const r = await askJSON<{ questions: string[] }>(
              "You are a technical interviewer hiring Diploma (polytechnic) engineers in India for jobs like SSC JE, RRB JE, PSU technician and private companies (L&T, Tata, Maruti). Ask exactly 3 short technical questions for the given branch based on the SCTE&VT Odisha diploma syllabus: one easy, one medium, one practical/applied. Each question must be answerable in 2-4 sentences.",
              `Branch: ${d.branch}. Vary topics; random seed ${Math.random().toString(36).slice(2, 8)}.`,
              { name: "questions", schema: { type: "object", additionalProperties: false, required: ["questions"], properties: { questions: { type: "array", items: S } } } },
            );
            return Response.json({ questions: r.questions.slice(0, 3) });
          }
          const r = await askJSON(
            `You are Debasis, a fair, encouraging technical interviewer for diploma engineering students. Evaluate each answer for technical correctness and clarity. Score each 0-10. Give short constructive feedback and the key points of an ideal answer. Empty or irrelevant answers score 0.
For "delivery" give direct, kind coaching on HOW the student spoke, using the measured delivery metrics (words per minute, filler words, long pauses, start delay, confidence %, clarity %). Example style: "आपका जवाब सही था, लेकिन आपकी आवाज़ में हिचकिचाहट थी। अगली बार बिना अटके बोलें।" If an answer was typed (no metrics), say it was typed and suggest practising it aloud. "deliverySummary" sums up their overall speaking style in 1-2 sentences.
Write ALL text fields ${d.lang === "hi" ? "in simple Hindi (Devanagari)" : "in simple English"}.`,
            `Branch: ${d.branch}\n` + d.qa.map((x, i) => `Q${i + 1}: ${x.q}\nAnswer: ${x.a || "(no answer)"}\nDelivery metrics: ${x.delivery ? JSON.stringify(x.delivery) : "typed answer, no voice"}`).join("\n\n"),
            { name: "evaluation", schema: {
              type: "object", additionalProperties: false, required: ["items", "overall", "deliverySummary", "tips"],
              properties: {
                items: { type: "array", items: { type: "object", additionalProperties: false, required: ["score", "feedback", "ideal", "delivery"], properties: { score: { type: "number" }, feedback: S, ideal: S, delivery: S } } },
                overall: S, deliverySummary: S, tips: { type: "array", items: S },
              },
            } },
          );
          return Response.json(r);
        } catch (e) { return errResponse(e); }
      },
    },
  },
});

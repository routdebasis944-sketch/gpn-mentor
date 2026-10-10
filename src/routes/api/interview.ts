import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { askJSON, errResponse } from "@/lib/ai.server";

const S = { type: "string" };
const Body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("questions"), branch: z.string().min(1).max(80) }),
  z.object({
    step: z.literal("evaluate"), branch: z.string().min(1).max(80),
    qa: z.array(z.object({ q: z.string().max(600), a: z.string().max(3000) })).length(3),
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
          if (d.step === "questions") {
            const r = await askJSON<{ questions: string[] }>(
              "You are a technical interviewer hiring Diploma (polytechnic) engineers in India for jobs like SSC JE, RRB JE, PSU technician and private companies (L&T, Tata, Maruti). Ask exactly 3 short technical questions for the given branch based on the SCTE&VT Odisha diploma syllabus: one easy, one medium, one practical/applied. Each question must be answerable in 2-4 sentences.",
              `Branch: ${d.branch}. Vary topics; random seed ${Math.random().toString(36).slice(2, 8)}.`,
              { name: "questions", schema: { type: "object", additionalProperties: false, required: ["questions"], properties: { questions: { type: "array", items: S } } } },
            );
            return Response.json({ questions: r.questions.slice(0, 3) });
          }
          const r = await askJSON(
            "You are a fair, encouraging technical interviewer for diploma engineering students. Evaluate each answer for technical correctness and clarity. Score each 0-10. Give short constructive feedback and the key points of an ideal answer. Write in simple English (Hinglish allowed). Empty or irrelevant answers score 0.",
            `Branch: ${d.branch}\n` + d.qa.map((x, i) => `Q${i + 1}: ${x.q}\nAnswer: ${x.a || "(no answer)"}`).join("\n\n"),
            { name: "evaluation", schema: {
              type: "object", additionalProperties: false, required: ["items", "overall", "tips"],
              properties: {
                items: { type: "array", items: { type: "object", additionalProperties: false, required: ["score", "feedback", "ideal"], properties: { score: { type: "number" }, feedback: S, ideal: S } } },
                overall: S, tips: { type: "array", items: S },
              },
            } },
          );
          return Response.json(r);
        } catch (e) { return errResponse(e); }
      },
    },
  },
});

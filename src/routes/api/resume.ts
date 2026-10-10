import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { askJSON, errResponse } from "@/lib/ai.server";

const Input = z.object({
  name: z.string().min(1).max(100), email: z.string().max(120), phone: z.string().max(30),
  location: z.string().max(100), branch: z.string().min(1).max(80), college: z.string().max(150),
  year: z.string().max(20), percentage: z.string().max(20), skills: z.string().max(1000),
  projects: z.string().max(2000), experience: z.string().max(2000), extra: z.string().max(1000),
});

const S = { type: "string" };
const arr = (items: object) => ({ type: "array", items });
const schema = {
  type: "object", additionalProperties: false,
  required: ["headline", "summary", "skills", "projects", "experience", "achievements"],
  properties: {
    headline: S, summary: S,
    skills: arr({ type: "object", additionalProperties: false, required: ["group", "items"], properties: { group: S, items: arr(S) } }),
    projects: arr({ type: "object", additionalProperties: false, required: ["title", "points"], properties: { title: S, points: arr(S) } }),
    experience: arr({ type: "object", additionalProperties: false, required: ["role", "org", "points"], properties: { role: S, org: S, points: arr(S) } }),
    achievements: arr(S),
  },
};

export const Route = createFileRoute("/api/resume")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Please fill your name and branch." }, { status: 400 });
        try {
          const content = await askJSON(
            "You are a resume layout assistant for Indian polytechnic diploma students. Turn raw details into a concise, ATS-friendly one-page resume. Use strong action verbs, keep bullets under 20 words, never invent employers, marks, certificates or numbers that were not given. Group skills sensibly (Technical, Software/Tools, Soft skills). Return empty arrays when there is no data.",
            JSON.stringify(parsed.data),
            { name: "resume", schema },
          );
          return Response.json(content);
        } catch (e) { return errResponse(e); }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Sparkles as _unused, Wand2 } from "lucide-react";
import { ModuleShell } from "@/components/ModuleShell";

void _unused;

export const Route = createFileRoute("/career")({
  head: () => ({
    meta: [
      { title: "AI Resume Builder for Diploma Students — Gpn AI" },
      { name: "description", content: "Enter your academic details, branch and skills to generate a clean, downloadable polytechnic resume with an AI layout assistant." },
      { property: "og:title", content: "AI Resume Builder — Gpn AI" },
      { property: "og:description", content: "Industry-ready resumes for Government Polytechnic students, generated in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Career,
});

type Form = Record<"name" | "email" | "phone" | "location" | "branch" | "college" | "year" | "percentage" | "skills" | "projects" | "experience" | "extra", string>;
type Resume = {
  headline: string; summary: string;
  skills: { group: string; items: string[] }[];
  projects: { title: string; points: string[] }[];
  experience: { role: string; org: string; points: string[] }[];
  achievements: string[];
};

const EMPTY: Form = { name: "", email: "", phone: "", location: "", branch: "", college: "", year: "", percentage: "", skills: "", projects: "", experience: "", extra: "" };
const FIELDS: { k: keyof Form; label: string; area?: boolean; ph?: string }[] = [
  { k: "name", label: "Full name *" }, { k: "email", label: "Email" }, { k: "phone", label: "Phone" }, { k: "location", label: "City, State" },
  { k: "branch", label: "Diploma branch *", ph: "e.g. Mechanical Engineering" }, { k: "college", label: "College", ph: "Government Polytechnic, Nuapada" },
  { k: "year", label: "Passing year" }, { k: "percentage", label: "CGPA / %" },
  { k: "skills", label: "Skills", area: true, ph: "AutoCAD, MS Excel, welding, PLC basics, teamwork…" },
  { k: "projects", label: "Projects", area: true, ph: "Final-year project, mini projects…" },
  { k: "experience", label: "Internship / training", area: true, ph: "Industrial training at …" },
  { k: "extra", label: "Certificates & achievements", area: true },
];

function Career() {
  const [f, setF] = useState<Form>(EMPTY);
  const [r, setR] = useState<Resume | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setR(j);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  return (
    <ModuleShell title="AI Resume Builder" subtitle="Career section · Industry readiness">
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={generate} className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((x) => (
              <label key={x.k} className={x.area ? "sm:col-span-2" : ""}>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">{x.label}</span>
                {x.area ? (
                  <textarea rows={3} value={f[x.k]} placeholder={x.ph} onChange={(e) => setF({ ...f, [x.k]: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron" />
                ) : (
                  <input value={f[x.k]} placeholder={x.ph} onChange={(e) => setF({ ...f, [x.k]: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron" />
                )}
              </label>
            ))}
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button type="submit" disabled={busy || !f.name.trim() || !f.branch.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-saffron py-3 font-bold text-accent-foreground disabled:opacity-50">
            <Wand2 className="h-4 w-4" /> {busy ? "Designing your resume…" : "Generate resume"}
          </button>
        </form>

        <div className="space-y-3">
          {r ? (
            <>
              <button type="button" onClick={() => window.print()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground print:hidden">
                <Download className="h-4 w-4" /> Download as PDF
              </button>
              <article id="resume-print" className="rounded-2xl border border-border bg-card p-6 text-[13px] leading-relaxed shadow-sm print:border-0 print:shadow-none">
                <header className="border-b-2 border-primary pb-3">
                  <h2 className="text-2xl font-extrabold text-primary">{f.name}</h2>
                  <p className="font-semibold">{r.headline}</p>
                  <p className="text-xs text-muted-foreground">{[f.email, f.phone, f.location].filter(Boolean).join(" · ")}</p>
                </header>
                <Sec t="Profile"><p>{r.summary}</p></Sec>
                <Sec t="Education">
                  <p className="font-semibold">Diploma in {f.branch}{f.year && ` — ${f.year}`}</p>
                  <p>{f.college}{f.percentage && ` · ${f.percentage}`}</p>
                </Sec>
                {r.skills.length > 0 && <Sec t="Skills">{r.skills.map((s) => <p key={s.group}><b>{s.group}:</b> {s.items.join(", ")}</p>)}</Sec>}
                {r.projects.length > 0 && <Sec t="Projects">{r.projects.map((p) => <div key={p.title} className="mb-1.5"><p className="font-semibold">{p.title}</p><ul className="list-disc pl-5">{p.points.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</Sec>}
                {r.experience.length > 0 && <Sec t="Training & Experience">{r.experience.map((p) => <div key={p.role + p.org} className="mb-1.5"><p className="font-semibold">{p.role} — {p.org}</p><ul className="list-disc pl-5">{p.points.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</Sec>}
                {r.achievements.length > 0 && <Sec t="Achievements"><ul className="list-disc pl-5">{r.achievements.map((x) => <li key={x}>{x}</li>)}</ul></Sec>}
              </article>
            </>
          ) : (
            <div className="flex h-full min-h-60 items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground print:hidden">
              Fill in your details and press “Generate resume”. Your formatted resume will appear here, ready to download.
            </div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

function Sec({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">{t}</h3>
      {children}
    </section>
  );
}

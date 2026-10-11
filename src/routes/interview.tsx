import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw, UserRound } from "lucide-react";
import debasisAvatar from "@/assets/debasis-avatar.png";
import { ModuleShell } from "@/components/ModuleShell";
import { INTERVIEW_BRANCHES } from "@/lib/syllabus";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Mock AI Technical Interview — Gpn AI" },
      { name: "description", content: "Practice a branch-specific technical interview: answer 3 questions from an AI interviewer and get constructive feedback." },
      { property: "og:title", content: "Mock AI Interview Simulator — Gpn AI" },
      { property: "og:description", content: "Interview practice for Diploma students in CSE, Mechanical, Electrical, Electronics and Civil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Interview,
});

type Msg = { from: "ai" | "me"; text: string };
type Evaluation = { items: { score: number; feedback: string; ideal: string }[]; overall: string; tips: string[] };

async function call(body: object) {
  const res = await fetch("/api/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "Failed");
  return j;
}

function Interview() {
  const [branch, setBranch] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs, result]);

  const start = async (b: string) => {
    setBranch(b); setBusy(true); setErr(null); setAnswers([]); setResult(null);
    setMsgs([{ from: "ai", text: `Namaste! I'm Debasis, your technical interviewer for ${b}. I'll ask you 3 questions, one by one. Answer in your own words.` }]);
    try {
      const { questions: q } = await call({ step: "questions", branch: b });
      setQuestions(q);
      setMsgs((m) => [...m, { from: "ai", text: `Question 1 of 3: ${q[0]}` }]);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = input.trim();
    if (!a || busy || answers.length >= 3) return;
    setInput("");
    const next = [...answers, a];
    setAnswers(next);
    setMsgs((m) => [...m, { from: "me", text: a }]);
    if (next.length < 3) {
      setMsgs((m) => [...m, { from: "ai", text: `Question ${next.length + 1} of 3: ${questions[next.length]}` }]);
      return;
    }
    setMsgs((m) => [...m, { from: "ai", text: "Thank you! Let me evaluate your answers…" }]);
    setBusy(true); setErr(null);
    try {
      setResult(await call({ step: "evaluate", branch, qa: questions.map((q, i) => ({ q, a: next[i] ?? "" })) }));
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const total = result ? Math.round(result.items.reduce((s, x) => s + x.score, 0) / 3 * 10) : 0;

  return (
    <ModuleShell title="Mock AI Interview" subtitle="Branch-specific technical interview practice">
      {!branch ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Choose your branch to begin</h2>
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_BRANCHES.map((b) => (
              <button key={b} type="button" onClick={() => start(b)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:border-saffron hover:bg-brand-soft">{b}</button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
          <div className="max-h-[60dvh] min-h-80 space-y-3 overflow-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.from === "me" ? "flex-row-reverse" : ""}`}>
                {m.from === "ai"
                  ? <img src={debasisAvatar} alt="Debasis" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4" /></span>}
                <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.from === "me" ? "bg-primary text-primary-foreground" : "bg-brand-soft"}`}>{m.text}</p>
              </div>
            ))}
            {busy && <p className="pl-10 text-xs text-muted-foreground">Debasis is thinking…</p>}
            {err && <p className="pl-10 text-sm text-destructive">{err}</p>}
            {result && (
              <div className="rounded-2xl border border-saffron bg-brand-soft/50 p-4">
                <p className="text-3xl font-extrabold">{total}%</p>
                <p className="mb-3 text-sm">{result.overall}</p>
                <ol className="space-y-3">
                  {result.items.map((x, i) => (
                    <li key={i} className="rounded-xl bg-card p-3 text-sm">
                      <p className="font-semibold">Q{i + 1}: {questions[i]} <span className="text-saffron">({x.score}/10)</span></p>
                      <p className="mt-1"><b>Feedback:</b> {x.feedback}</p>
                      <p className="mt-1 text-muted-foreground"><b>Ideal answer:</b> {x.ideal}</p>
                    </li>
                  ))}
                </ol>
                {result.tips.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{result.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
              </div>
            )}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
            <button type="button" onClick={() => setBranch(null)} aria-label="Restart" className="rounded-xl border border-border px-3"><RotateCcw className="h-4 w-4" /></button>
            <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy || answers.length >= 3 || !questions.length}
              placeholder={answers.length >= 3 ? "Interview finished" : "Type your answer…"} aria-label="Your answer"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron disabled:opacity-60" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="rounded-xl bg-saffron px-4 text-accent-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </section>
      )}
    </ModuleShell>
  );
}

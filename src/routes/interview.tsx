import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw, UserRound, Mic, Square, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import debasisAvatar from "@/assets/debasis-avatar.png";
import { ModuleShell } from "@/components/ModuleShell";
import { INTERVIEW_BRANCHES } from "@/lib/syllabus";
import { clarityLabel, type Delivery } from "@/lib/delivery";
import { useVoiceAnswer } from "@/hooks/use-voice-answer";
import { speakAsDebasis, stopSpeaking } from "@/lib/voice";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Mock AI Technical Interview — Gpn AI" },
      { name: "description", content: "Practice a branch-specific technical interview by voice or text and get feedback on your answers, confidence and speech delivery." },
      { property: "og:title", content: "Mock AI Interview Simulator — Gpn AI" },
      { property: "og:description", content: "Interview practice for Diploma students with confidence, hesitation and clarity analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Interview,
});

type Lang = "en" | "hi";
type Msg = { from: "ai" | "me"; text: string; delivery?: Delivery | null };
type Evaluation = {
  items: { score: number; feedback: string; ideal: string; delivery: string }[];
  overall: string; deliverySummary: string; tips: string[];
};

async function call(body: object) {
  const res = await fetch("/api/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "Failed");
  return j;
}

const T = {
  en: { hi: (_b: string) => "Namaste! Welcome to your mock interview. I'm Debasis. Please introduce yourself and tell me your name, college, and branch.", q: "Question", of: "of", eval: "Thank you! Let me evaluate your answers…" },
  hi: { hi: (_b: string) => "नमस्ते! आपके मॉक इंटरव्यू में आपका स्वागत है। मैं देबाशीष हूँ। कृपया अपना परिचय दीजिए — अपना नाम, कॉलेज और ब्रांच बताइए।", q: "सवाल", of: "/", eval: "धन्यवाद! अब मैं आपके जवाबों का मूल्यांकन कर रहा हूँ…" },
};

function Meter({ label, value, tone }: { label: string; value: number; tone: "good" | "mid" | "bad" }) {
  const color = tone === "good" ? "bg-saffron" : tone === "mid" ? "bg-primary" : "bg-destructive";
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] font-medium"><span>{label}</span><span>{value}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DeliveryPanel({ d, lang }: { d: Delivery; lang: Lang }) {
  const tone = (v: number): "good" | "mid" | "bad" => (v >= 75 ? "good" : v >= 50 ? "mid" : "bad");
  return (
    <div className="mt-2 w-full max-w-[80%] self-end rounded-2xl border border-border bg-card p-3 text-xs shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Gauge className="h-4 w-4 text-saffron" /> Delivery Analytics</p>
      <div className="space-y-2">
        <Meter label="Confidence" value={d.confidence} tone={tone(d.confidence)} />
        <Meter label={`Pronunciation & clarity · ${clarityLabel(d.clarity)}`} value={d.clarity} tone={tone(d.clarity)} />
      </div>
      <div className={`mt-2 flex items-start gap-1.5 rounded-lg p-2 ${d.hesitation ? "bg-destructive/10 text-destructive" : "bg-brand-soft"}`}>
        {d.hesitation ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron" />}
        <span>
          {d.hesitation
            ? (lang === "hi" ? "हिचकिचाहट मिली — " : "Hesitation detected — ") + [d.fillers ? `${d.fillers} filler${d.fillers > 1 ? "s" : ""} (${[...new Set(d.fillerWords)].join(", ")})` : "", d.longPauses ? `${d.longPauses} long pause${d.longPauses > 1 ? "s" : ""} (max ${d.longestPause}s)` : "", d.startDelay > 4 ? `slow start (${d.startDelay}s)` : ""].filter(Boolean).join(" · ")
            : lang === "hi" ? "बिना अटके, सहज बोले।" : "Smooth delivery, no fumbling detected."}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat k="Words/min" v={String(d.wpm)} />
        <Stat k="Start delay" v={`${d.startDelay}s`} />
        <Stat k="Steadiness" v={`${Math.round(d.volumeSteadiness * 100)}%`} />
      </div>
    </div>
  );
}
const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="rounded-lg bg-muted px-1 py-1.5"><p className="text-[10px] text-muted-foreground">{k}</p><p className="font-mono font-bold">{v}</p></div>
);

function Interview() {
  const [lang, setLang] = useState<Lang>("en");
  const [branch, setBranch] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<{ a: string; delivery: Delivery | null }[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pendingDelivery, setPendingDelivery] = useState<Delivery | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const qPromise = useRef<Promise<string[]> | null>(null);
  const say = (text: string) => { void speakAsDebasis(text, lang); };
  useEffect(() => () => stopSpeaking(), []);
  const voice = useVoiceAnswer(lang === "hi" ? "hi-IN" : "en-IN");
  const listRef = useRef<HTMLDivElement>(null);
  const t = T[lang];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, result, busy]);

  useEffect(() => {
    if (voice.recording) setInput(voice.transcript);
  }, [voice.recording, voice.transcript]);

  const start = (b: string) => {
    setBranch(b); setErr(null); setAnswers([]); setResult(null); setInput(""); setPendingDelivery(null);
    setIntroDone(false); setQuestions([]);
    const greet = t.hi(b);
    setMsgs([{ from: "ai", text: greet }]);
    say(greet);
    const p = call({ step: "questions", branch: b }).then((r: { questions: string[] }) => r.questions);
    p.catch(() => undefined);
    qPromise.current = p;
  };

  const submitIntro = async (text: string) => {
    setMsgs((m) => [...m, { from: "me", text }]);
    setBusy(true); setErr(null);
    try {
      const [ack, q] = await Promise.all([
        call({ step: "intro", branch, lang, text }).then((r: { ack: string }) => r.ack).catch(() => (lang === "hi" ? "परिचय के लिए धन्यवाद! अब मैं आपसे 3 तकनीकी सवाल पूछूँगा।" : "Thank you for the introduction! Now I'll ask you 3 technical questions.")),
        qPromise.current ?? Promise.reject(new Error("Failed")),
      ]);
      setQuestions(q); setIntroDone(true);
      const q1 = `${t.q} 1 ${t.of} 3: ${q[0]}`;
      setMsgs((m) => [...m, { from: "ai", text: ack }, { from: "ai", text: q1 }]);
      say(`${ack} ${q1}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const toggleMic = async () => {
    if (voice.recording) {
      const r = voice.stop();
      if (r) { setInput(r.text); setPendingDelivery(r.text ? r.delivery : null); }
    } else {
      setPendingDelivery(null);
      await voice.start();
    }
  };

  const submitAnswer = async () => {
    if (voice.recording) {
      const r = voice.stop();
      if (r) { setInput(r.text); setPendingDelivery(r.text ? r.delivery : null); }
      return; // let the student review the transcript first
    }
    const a = input.trim();
    if (!introDone) {
      if (!a || busy) return;
      setInput(""); setPendingDelivery(null);
      await submitIntro(a);
      return;
    }
    if (!a || busy || answers.length >= 3) return;
    const delivery = pendingDelivery;
    setInput(""); setPendingDelivery(null);
    const next = [...answers, { a, delivery }];
    setAnswers(next);
    setMsgs((m) => [...m, { from: "me", text: a, delivery }]);
    if (next.length < 3) {
      const qn = `${t.q} ${next.length + 1} ${t.of} 3: ${questions[next.length]}`;
      setMsgs((m) => [...m, { from: "ai", text: qn }]);
      say(qn);
      return;
    }
    setMsgs((m) => [...m, { from: "ai", text: t.eval }]);
    say(t.eval);
    setBusy(true); setErr(null);
    try {
      const ev: Evaluation = await call({
        step: "evaluate", branch, lang,
        qa: questions.map((q, i) => {
          const x = next[i];
          const d = x?.delivery;
          return {
            q, a: x?.a ?? "",
            delivery: d ? { wpm: d.wpm, fillers: d.fillers, fillerWords: d.fillerWords, longPauses: d.longPauses, longestPause: d.longestPause, startDelay: d.startDelay, confidence: d.confidence, clarity: d.clarity, hesitation: d.hesitation } : null,
          };
        }),
      });
      setResult(ev);
      say(`${ev.overall} ${ev.deliverySummary}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const total = result ? Math.round((result.items.reduce((s, x) => s + x.score, 0) / 3) * 10) : 0;
  const spoken = answers.map((x) => x.delivery).filter((d): d is Delivery => !!d);
  const avgConf = spoken.length ? Math.round(spoken.reduce((s, d) => s + d.confidence, 0) / spoken.length) : null;
  const finished = answers.length >= 3;

  return (
    <ModuleShell title="Mock AI Interview" subtitle="Technical questions + voice confidence analytics">
      {!branch ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Feedback language</h2>
            <div className="flex gap-2">
              {([["en", "English"], ["hi", "हिन्दी"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setLang(k)}
                  className={`rounded-xl border px-4 py-2 text-sm ${lang === k ? "border-saffron bg-brand-soft font-semibold" : "border-border"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Choose your branch to begin</h2>
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_BRANCHES.map((b) => (
                <button key={b} type="button" onClick={() => start(b)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:border-saffron hover:bg-brand-soft">{b}</button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Tip: use Chrome or Edge and allow the microphone to get confidence, hesitation and clarity analytics. You can also type your answers.</p>
        </section>
      ) : (
        <section className="flex flex-col rounded-2xl border border-border bg-card shadow-sm">
          <div ref={listRef} className="flex max-h-[60dvh] min-h-80 flex-col gap-3 overflow-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className="flex flex-col">
                <div className={`flex gap-2 ${m.from === "me" ? "flex-row-reverse" : ""}`}>
                  {m.from === "ai"
                    ? <img src={debasisAvatar} alt="Debasis" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="h-4 w-4" /></span>}
                  <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.from === "me" ? "bg-primary text-primary-foreground" : "bg-brand-soft"}`}>
                    {m.from === "me" && m.delivery && <Mic className="mr-1 inline h-3 w-3 opacity-70" />}{m.text}
                  </p>
                </div>
                {m.from === "me" && m.delivery && <DeliveryPanel d={m.delivery} lang={lang} />}
              </div>
            ))}
            {busy && <p className="pl-10 text-xs text-muted-foreground">Debasis is thinking…</p>}
            {err && <p className="pl-10 text-sm text-destructive">{err}</p>}
            {result && (
              <div className="rounded-2xl border border-saffron bg-brand-soft/50 p-4">
                <div className="flex flex-wrap items-end gap-6">
                  <div><p className="text-3xl font-extrabold">{total}%</p><p className="text-xs text-muted-foreground">Technical score</p></div>
                  {avgConf !== null && <div><p className="text-3xl font-extrabold">{avgConf}%</p><p className="text-xs text-muted-foreground">Avg. confidence</p></div>}
                </div>
                <p className="mt-3 text-sm">{result.overall}</p>
                <p className="mt-2 rounded-xl bg-card p-3 text-sm"><b>🎙 {lang === "hi" ? "बोलने का तरीका" : "Speech delivery"}:</b> {result.deliverySummary}</p>
                <ol className="mt-3 space-y-3">
                  {result.items.map((x, i) => (
                    <li key={i} className="rounded-xl bg-card p-3 text-sm">
                      <p className="font-semibold">Q{i + 1}: {questions[i]} <span className="text-saffron">({x.score}/10)</span></p>
                      <p className="mt-1"><b>Feedback:</b> {x.feedback}</p>
                      <p className="mt-1"><b>Delivery:</b> {x.delivery}</p>
                      <p className="mt-1 text-muted-foreground"><b>Ideal answer:</b> {x.ideal}</p>
                    </li>
                  ))}
                </ol>
                {result.tips.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{result.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
              </div>
            )}
          </div>

          {(voice.error || (voice.recording)) && (
            <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs">
              {voice.recording && (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                  <span>Listening… speak your answer, then tap stop.</span>
                  <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-saffron transition-all" style={{ width: `${Math.round(voice.level * 100)}%` }} /></span>
                </>
              )}
              {voice.error && <span className="text-destructive">{voice.error}</span>}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); void submitAnswer(); }} className="flex gap-2 border-t border-border p-3">
            <button type="button" onClick={() => { if (voice.recording) voice.stop(); stopSpeaking(); setBranch(null); }} aria-label="Restart" className="rounded-xl border border-border px-3"><RotateCcw className="h-4 w-4" /></button>
            {voice.supported && (
              <button type="button" onClick={() => void toggleMic()} disabled={busy || finished}
                aria-label={voice.recording ? "Stop recording" : "Answer by voice"}
                className={`rounded-xl px-3 disabled:opacity-50 ${voice.recording ? "bg-destructive text-destructive-foreground" : "border border-saffron text-foreground"}`}>
                {voice.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <input value={input} onChange={(e) => { setInput(e.target.value); }} disabled={busy || finished || voice.recording}
              placeholder={finished ? "Interview finished" : voice.recording ? "Listening…" : !introDone ? "Introduce yourself: name, college, branch…" : "Speak or type your answer…"} aria-label="Your answer"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron disabled:opacity-60" />
            <button type="submit" disabled={busy || (!input.trim() && !voice.recording)} aria-label="Send" className="rounded-xl bg-saffron px-4 text-accent-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </section>
      )}
    </ModuleShell>
  );
}

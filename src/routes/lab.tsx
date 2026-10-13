import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Video, Link2, RotateCcw, RefreshCw, FileText,
  Volume2, CheckCircle2, AlertTriangle, LogIn, LogOut, ClipboardList, X,
} from "lucide-react";
import debasisAvatar from "@/assets/debasis-avatar.png";
import { supabase } from "@/integrations/supabase/client";
import { syncLabsNow } from "@/lib/lab.functions";
import {
  type SimType, type Reading, type AnySim, type EvalResult, SP_R1, SP_R2, WB_P, WB_Q, MAX_SAFE_CURRENT,
  computeCurrent, evaluate, wheatstoneDeflection, resolveSim, stepsFor, SIM_TITLES,
} from "@/lib/lab-eval";
import { AnswerInput, BenchCard, RangeInput, ReadingBox } from "@/components/lab/ui";
import VernierBench from "@/components/lab/VernierBench";
import SlumpBench from "@/components/lab/SlumpBench";
import CodeBench from "@/components/lab/CodeBench";

const CircuitScene = lazy(() => import("@/components/lab/CircuitScene"));

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "SCTE&VT 3D Virtual Practical Lab — Gpn AI" },
      { name: "description", content: "Choose your branch and semester, perform SCTE&VT polytechnic practicals in 3D with instructor Debasis, and get an instant score with Hindi feedback." },
      { property: "og:title", content: "SCTE&VT 3D Virtual Practical Lab — Gpn AI" },
      { property: "og:description", content: "Interactive 3D polytechnic practicals with auto-synced official lab list and smart evaluation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VirtualLab,
});

type Module = {
  id: string; branch: string; semester: number; title: string; description: string | null;
  source_url: string | null; sim_type: string | null; is_official: boolean;
};

const BRANCHES = ["Common (1st Year)", "Electrical", "Electronics", "Mechanical", "Civil", "Computer Science"];

function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return userId;
}

function VirtualLab() {
  const userId = useSession();
  const [branch, setBranch] = useState<string | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [active, setActive] = useState<Module | null>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="gpn-header-gradient text-primary-foreground shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => (active ? setActive(null) : window.history.length > 1 ? window.history.back() : undefined)}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/30">
            <img src={debasisAvatar} alt="Debasis" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">SCTE&amp;VT 3D Virtual Lab</h1>
            <p className="truncate text-xs text-white/70">
              {active ? `${active.branch} · Sem ${active.semester} · ${active.title}` : "Practicals with Debasis"}
            </p>
          </div>
          <Link to="/" className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20 hover:bg-white/20 sm:inline-flex">
            Chat
          </Link>
          {userId ? (
            <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sign out"
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/20 hover:bg-white/20">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          ) : (
            <Link to="/auth" className="inline-flex items-center gap-1 rounded-full bg-saffron px-3 py-1.5 text-xs font-semibold text-accent-foreground">
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </header>

      {active ? (
        <Workspace key={active.id} module={active} sim={resolveSim(active.branch, active.semester, active.sim_type)} userId={userId} />
      ) : (
        <Selector
          branch={branch} semester={semester} setBranch={setBranch} setSemester={setSemester}
          onOpen={setActive} userId={userId}
        />
      )}
    </div>
  );
}

function Selector({
  branch, semester, setBranch, setSemester, onOpen, userId,
}: {
  branch: string | null; semester: number | null;
  setBranch: (b: string) => void; setSemester: (s: number) => void;
  onOpen: (m: Module) => void; userId: string | null;
}) {
  const qc = useQueryClient();
  const sync = useServerFn(syncLabsNow);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const modulesQ = useQuery({
    queryKey: ["lab_modules", branch, semester],
    enabled: !!branch && semester !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_modules")
        .select("*")
        .eq("branch", branch!)
        .in("semester", [semester!, 0])
        .order("sim_type", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Module[];
    },
  });

  const syncQ = useQuery({
    queryKey: ["lab_sync_state"],
    queryFn: async () => (await supabase.from("lab_sync_state").select("*").eq("id", 1).single()).data,
  });

  const runSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await sync();
      if (!r.ok) setSyncMsg(`Sync failed: ${"error" in r ? r.error : ""}`);
      else if ("skipped" in r && r.skipped) setSyncMsg(`${r.skipped} — list is up to date.`);
      else setSyncMsg(`Synced — ${r.added} new module(s) added.`);
      qc.invalidateQueries({ queryKey: ["lab_modules"] });
      qc.invalidateQueries({ queryKey: ["lab_sync_state"] });
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    }
    setSyncing(false);
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 p-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">1. Choose your branch</h2>
        <div className="flex flex-wrap gap-2">
          {BRANCHES.map((b) => (
            <button key={b} type="button" onClick={() => setBranch(b)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${branch === b ? "border-saffron bg-brand-soft font-semibold" : "border-border hover:bg-brand-soft/60"}`}>
              {b}
            </button>
          ))}
        </div>
        <h2 className="mb-3 mt-5 text-sm font-semibold">2. Choose your semester</h2>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <button key={s} type="button" onClick={() => setSemester(s)}
              className={`h-10 w-12 rounded-xl border text-sm transition ${semester === s ? "border-saffron bg-brand-soft font-bold" : "border-border hover:bg-brand-soft/60"}`}>
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">3. Pick a practical</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {syncQ.data?.last_run_at && <span>Last synced {new Date(syncQ.data.last_run_at).toLocaleString()}</span>}
            {userId && (
              <button type="button" onClick={runSync} disabled={syncing}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-medium hover:bg-brand-soft disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync official list
              </button>
            )}
          </div>
        </div>
        {syncMsg && <p className="mb-3 text-xs text-muted-foreground">{syncMsg}</p>}
        {!branch || semester === null ? (
          <p className="text-sm text-muted-foreground">Select a branch and semester to see practicals.</p>
        ) : modulesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : modulesQ.data?.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {modulesQ.data.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onOpen(m)}
                  className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-border p-3 text-left transition hover:border-saffron hover:bg-brand-soft/60">
                  <span className="rounded-full bg-saffron px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                    {m.sim_type ? "Interactive practical" : "Official syllabus · Interactive lab"}
                  </span>
                  <span className="text-sm font-semibold leading-snug">{m.sim_type ? m.title : SIM_TITLES[resolveSim(m.branch, m.semester, m.sim_type)]}</span>
                  {!m.sim_type && <span className="text-[11px] text-muted-foreground">Syllabus: {m.title}</span>}
                  {m.description && <span className="line-clamp-2 text-xs text-muted-foreground">{m.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No practicals yet for this selection. New official modules appear here automatically after each sync.</p>
        )}
      </section>
    </main>
  );
}

function speakHindi(text: string) {
  void speakAsDebasis(text, "hi");
}

type EvalFn = () => EvalResult | Promise<EvalResult>;

function Workspace({ module, sim, userId }: { module: Module; sim: AnySim; userId: string | null }) {
  const evalRef = useRef<EvalFn | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; mistakes: string[]; saved?: string } | null>(null);
  const steps = stepsFor(sim);

  const submit = async () => {
    if (!evalRef.current || busy) return;
    setBusy(true);
    const r = await evalRef.current();
    setResult(r);
    setBusy(false);
    if (r.score === 100) speakHindi("बहुत बढ़िया! आपका प्रैक्टिकल सही है।");
    else speakHindi(`आपका स्कोर ${r.score} प्रतिशत है। ${r.mistakes[0] ?? ""}`);
    if (userId) {
      const { error } = await supabase.from("lab_attempts").insert({
        user_id: userId, module_id: module.id, score: r.score, mistakes: r.mistakes,
      });
      setResult({ ...r, saved: error ? `Could not save: ${error.message}` : "Score saved to your history." });
    }
  };

  const historyQ = useQuery({
    queryKey: ["lab_attempts", module.id, userId, result?.saved],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("lab_attempts").select("score, created_at")
        .eq("module_id", module.id).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 pb-0 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <VideoPanel />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Practical: {SIM_TITLES[sim]}</h2>
          {!module.sim_type && (
            <p className="mt-1 text-xs text-muted-foreground">
              Based on official syllabus: {module.title}
              {module.source_url && <> · <a href={module.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline"><FileText className="h-3 w-3" /> PDF</a></>}
            </p>
          )}
          <ol className="mt-3 space-y-2">
            {steps.map((st, i) => (
              <li key={st.en}>
                <div className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-sm transition ${i === step ? "border-saffron bg-brand-soft" : "border-transparent"}`}>
                  <button type="button" onClick={() => setStep(i)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === step ? "bg-saffron text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </button>
                  <button type="button" onClick={() => setStep(i)} className="flex-1 text-left leading-snug">{st.en}</button>
                  <button type="button" aria-label="Listen in Hindi" onClick={() => { setStep(i); speakHindi(st.hi); }}
                    className="shrink-0 rounded-full p-1 text-primary hover:bg-brand-soft">
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {userId && historyQ.data && historyQ.data.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Recent scores: {historyQ.data.map((h) => `${h.score}%`).join(" · ")}</p>
          )}
        </div>
      </section>

      <section key={resetKey} className="flex flex-col gap-3">
        {sim === "vernier" ? <VernierBench evalRef={evalRef} />
          : sim === "slump" ? <SlumpBench evalRef={evalRef} />
          : sim === "code" ? <CodeBench semester={module.semester} evalRef={evalRef} />
          : <CircuitBench sim={sim} evalRef={evalRef} />}
      </section>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:col-span-2">
        <div className="mx-auto flex max-w-6xl gap-2">
          <button type="button" onClick={() => { setResetKey((k) => k + 1); setResult(null); setStep(0); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm hover:bg-brand-soft">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button type="button" onClick={submit} disabled={busy}
            className="flex-1 rounded-xl bg-saffron py-3 text-base font-extrabold text-accent-foreground shadow-md hover:opacity-90 disabled:opacity-60">
            {busy ? "Checking…" : "Submit Practical"}
          </button>
        </div>
      </div>

      {result && <ResultDialog result={result} userId={userId} onClose={() => setResult(null)} />}
    </main>
  );
}

function CircuitBench({ sim, evalRef }: { sim: SimType; evalRef: React.MutableRefObject<EvalFn | null> }) {
  const [closed, setClosed] = useState(false);
  const [voltage, setVoltage] = useState(6);
  const [resistance, setResistance] = useState(10);
  const [arrangement, setArrangement] = useState<"series" | "parallel">("series");
  const [s, setS] = useState(15);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [overloaded, setOverloaded] = useState(false);
  const [answers, setAnswers] = useState<{ r?: string | undefined; series?: string | undefined; parallel?: string | undefined; x?: string | undefined }>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const current = closed ? computeCurrent(sim, voltage, resistance, arrangement, s) : 0;
  const deflection = wheatstoneDeflection(s);
  useEffect(() => { if (closed && current > MAX_SAFE_CURRENT) setOverloaded(true); }, [closed, current]);

  evalRef.current = () => evaluate({ sim, closed, resistance, readings, overloaded, answers });

  return (
    <BenchCard title="3D Simulation Bench" hint="Drag to orbit · click the switch">
      <div className="relative h-[20rem] w-full sm:h-[24rem]">
        {mounted ? (
          <Suspense fallback={<SceneLoading />}>
            <CircuitScene closed={closed} onToggle={() => setClosed((c) => !c)} current={current}
              mode={sim} arrangement={arrangement} deflection={deflection} />
          </Suspense>
        ) : <SceneLoading />}
      </div>
      <div className="p-4">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <ReadingBox label="Voltage" value={`${voltage} V`} />
          <ReadingBox label={sim === "wheatstone" ? "S" : sim === "series_parallel" ? "Mode" : "Resistance"}
            value={sim === "wheatstone" ? `${s} Ω` : sim === "series_parallel" ? arrangement : `${resistance} Ω`} />
          <ReadingBox label="Current" value={`${current.toFixed(2)} A`} highlight warn={current > MAX_SAFE_CURRENT} />
        </div>
        <RangeInput label="Supply voltage (V)" min={1} max={24} value={voltage} onChange={setVoltage} />
        {sim === "ohms_law" && <RangeInput label="Resistance R (Ω)" min={1} max={48} value={resistance} onChange={setResistance} />}
        {sim === "series_parallel" && (
          <div className="mb-3 flex gap-2">
            {(["series", "parallel"] as const).map((a) => (
              <button key={a} type="button" onClick={() => setArrangement(a)}
                className={`flex-1 rounded-xl border py-2 text-sm capitalize ${arrangement === a ? "border-saffron bg-brand-soft font-semibold" : "border-border"}`}>
                {a} (R1={SP_R1}Ω, R2={SP_R2}Ω)
              </button>
            ))}
          </div>
        )}
        {sim === "wheatstone" && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">P = {WB_P} Ω, Q = {WB_Q} Ω. Needle: {Math.abs(deflection) < 0.05 ? "balanced (zero)" : deflection > 0 ? "right" : "left"}</p>
            <RangeInput label="Variable resistance S (Ω)" min={1} max={60} value={s} onChange={setS} />
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setClosed((c) => !c)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {closed ? "Open the switch" : "Close the switch"}
          </button>
          <button type="button" onClick={() => setReadings((r) => [...r, { v: voltage, i: current, closed, arrangement, s }])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-saffron px-4 py-2 text-sm font-semibold hover:bg-brand-soft">
            <ClipboardList className="h-4 w-4" /> रीडिंग नोट करें
          </button>
        </div>
        {readings.length > 0 && (
          <div className="mt-3 max-h-32 overflow-auto rounded-xl border border-border text-xs">
            <table className="w-full">
              <thead className="bg-muted"><tr><th className="p-1.5">#</th><th>V</th><th>I (A)</th><th>{sim === "wheatstone" ? "S" : sim === "series_parallel" ? "Mode" : "Switch"}</th></tr></thead>
              <tbody>
                {readings.map((r, i) => (
                  <tr key={i} className="text-center">
                    <td className="p-1">{i + 1}</td><td>{r.v}</td><td>{r.i.toFixed(2)}</td>
                    <td>{sim === "wheatstone" ? r.s : sim === "series_parallel" ? r.arrangement : r.closed ? "closed" : "open"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {sim === "ohms_law" && <AnswerInput label="Your R = V / I (Ω)" value={answers.r} onChange={(v) => setAnswers({ ...answers, r: v })} />}
          {sim === "series_parallel" && (
            <>
              <AnswerInput label="Series R (Ω)" value={answers.series} onChange={(v) => setAnswers({ ...answers, series: v })} />
              <AnswerInput label="Parallel R (Ω)" value={answers.parallel} onChange={(v) => setAnswers({ ...answers, parallel: v })} />
            </>
          )}
          {sim === "wheatstone" && <AnswerInput label="Unknown X (Ω)" value={answers.x} onChange={(v) => setAnswers({ ...answers, x: v })} />}
        </div>
      </div>
    </BenchCard>
  );
}

function ResultDialog({ result, userId, onClose }: { result: { score: number; mistakes: string[]; saved?: string }; userId: string | null; onClose: () => void }) {
  const perfect = result.score === 100;
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 9) * 0.12, dur: 1.8 + (i % 5) * 0.3, color: i % 3,
  })), []);
  return (
    <div role="dialog" aria-modal="true" aria-label="Practical result" className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-3 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`relative max-h-[85dvh] w-full max-w-lg overflow-auto rounded-2xl border bg-card p-5 shadow-2xl ${perfect ? "gpn-success border-saffron" : "border-border"}`}>
        {perfect && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {pieces.map((p, i) => (
              <span key={i} className="gpn-confetti" style={{
                left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
                background: p.color === 0 ? "var(--saffron)" : p.color === 1 ? "var(--primary)" : "var(--accent)",
              }} />
            ))}
          </div>
        )}
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        <div className="flex flex-col items-center text-center">
          {perfect ? <CheckCircle2 className="gpn-pop h-14 w-14 text-saffron" /> : <AlertTriangle className="h-12 w-12 text-destructive" />}
          <p className="mt-2 text-4xl font-extrabold">{result.score}%</p>
          <p className="text-xs text-muted-foreground">Performance score</p>
          {perfect && <p className="gpn-pop mt-3 text-xl font-bold">Complete your practical</p>}
        </div>
        {!perfect && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-bold">आपकी गलतियाँ और उन्हें कैसे सुधारें:</h3>
            <ol className="space-y-2">
              {result.mistakes.map((m, i) => (
                <li key={m} className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-sm leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">{i + 1}</span>
                  <span>{m}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {result.saved ?? (userId ? "Saving…" : <>Your score was not saved. <Link to="/auth" className="underline">Sign in</Link> to keep your history.</>)}
        </p>
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
          {perfect ? "Done" : "Try again"}
        </button>
      </div>
    </div>
  );
}


function SceneLoading() {
  return <div className="flex h-full w-full items-center justify-center bg-primary text-sm text-primary-foreground/70">Loading 3D lab…</div>;
}

function VideoPanel() {
  const [videoUrl, setVideoUrl] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("gpn-lab-video");
    if (saved) { setVideoUrl(saved); setDraftUrl(saved); }
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Video className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">AI Instructor — Debasis</h2>
      </div>
      <div className="relative aspect-video w-full bg-foreground/90">
        {videoUrl ? (
          isEmbeddable(videoUrl) ? (
            <iframe src={toEmbed(videoUrl)} title="Debasis AI avatar instructor" className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />
          ) : (
            <video key={videoUrl} src={videoUrl} controls playsInline className="absolute inset-0 h-full w-full object-contain" />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <img src={debasisAvatar} alt="Debasis" className="h-20 w-20 rounded-full object-cover ring-2 ring-saffron/60" />
            <p className="text-sm font-medium text-background">Paste your HeyGen talking-avatar video link below</p>
            <p className="text-xs text-background/60">Tap the speaker icon on any step to hear Debasis in Hindi</p>
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const u = draftUrl.trim(); setVideoUrl(u); localStorage.setItem("gpn-lab-video", u); }}
        className="flex items-center gap-2 border-t border-border p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary"><Link2 className="h-4 w-4" /></span>
        <input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="https://app.heygen.com/share/…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron" />
        <button type="submit" className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">Load</button>
      </form>
    </div>
  );
}
function isEmbeddable(url: string) {
  return !/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

function toEmbed(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
    }
    return url;
  } catch {
    return url;
  }
}

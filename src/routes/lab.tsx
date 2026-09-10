import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { ArrowLeft, Video, Link2, RotateCcw, Zap, MousePointerClick } from "lucide-react";
import debasisAvatar from "@/assets/debasis-avatar.png";

const CircuitScene = lazy(() => import("@/components/lab/CircuitScene"));

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "3D Virtual Lab — Gpn AI Polytechnic Practicals" },
      {
        name: "description",
        content:
          "Perform polytechnic practicals in 3D while your AI instructor Debasis explains each step — interactive Ohm's law circuit simulation inside Gpn AI.",
      },
      { property: "og:title", content: "3D Virtual Lab — Gpn AI Polytechnic Practicals" },
      {
        property: "og:description",
        content:
          "Watch the AI avatar instructor and perform the electrical practical in an interactive 3D lab bench.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VirtualLab,
});

// Paste your HeyGen talking-avatar video URL here (or in the field in the UI).
const PLACEHOLDER_VIDEO_URL = "";

const STEPS = [
  "Check the apparatus: battery, switch, resistor and lamp on the bench.",
  "Note the supply voltage and the resistance value shown on the parts.",
  "Click the orange switch lever in 3D to close the circuit.",
  "Observe electron flow and read the current I = V / R on the board.",
  "Change V and R with the sliders and record how the lamp brightness changes.",
];

function VirtualLab() {
  const [videoUrl, setVideoUrl] = useState(PLACEHOLDER_VIDEO_URL);
  const [draftUrl, setDraftUrl] = useState(PLACEHOLDER_VIDEO_URL);
  const [closed, setClosed] = useState(false);
  const [voltage, setVoltage] = useState(9);
  const [resistance, setResistance] = useState(10);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = closed ? voltage / Math.max(resistance, 1) : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="gpn-header-gradient text-primary-foreground shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            aria-label="Back to chat"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/30">
            <img src={debasisAvatar} alt="Debasis" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">3D Virtual Lab</h1>
            <p className="truncate text-xs text-white/70">
              Practicals with Debasis — watch &amp; perform together
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 lg:grid-cols-2">
        {/* Left — AI avatar instructor */}
        <section className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Video className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">AI Avatar Instructor</h2>
            </div>
            <div className="relative aspect-video w-full bg-foreground/90">
              {videoUrl ? (
                isEmbeddable(videoUrl) ? (
                  <iframe
                    src={toEmbed(videoUrl)}
                    title="Debasis AI avatar instructor"
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    playsInline
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <img
                    src={debasisAvatar}
                    alt="Debasis"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-saffron/60"
                  />
                  <p className="text-sm font-medium text-white">
                    Paste your HeyGen talking-avatar video link below
                  </p>
                  <p className="text-xs text-white/60">
                    Supports HeyGen share links, YouTube links or a direct .mp4 file
                  </p>
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setVideoUrl(draftUrl.trim());
              }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                <Link2 className="h-4 w-4" />
              </span>
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="https://app.heygen.com/share/…  (paste video URL)"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron focus:ring-2 focus:ring-saffron/30"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Load
              </button>
            </form>
          </div>

          {/* Steps */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">
              Practical: Verification of Ohm&apos;s Law
            </h2>
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left text-sm transition ${
                      i === step
                        ? "border-saffron bg-brand-soft"
                        : "border-transparent hover:bg-brand-soft/60"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        i === step
                          ? "bg-saffron text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="leading-snug">{s}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Right — 3D simulation */}
        <section className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-saffron" />
                <h2 className="text-sm font-semibold">3D Simulation Bench</h2>
              </div>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                <MousePointerClick className="h-3.5 w-3.5" />
                Drag to orbit · click the switch
              </span>
            </div>
            <div className="relative h-[22rem] w-full sm:h-[26rem] lg:h-[30rem]">
              {mounted ? (
                <Suspense
                  fallback={
                    <div className="flex h-full w-full items-center justify-center bg-[#0d1626] text-sm text-white/70">
                      Loading 3D lab…
                    </div>
                  }
                >
                  <CircuitScene
                    closed={closed}
                    onToggle={() => setClosed((c) => !c)}
                    voltage={voltage}
                    resistance={resistance}
                  />
                </Suspense>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0d1626] text-sm text-white/70">
                  Loading 3D lab…
                </div>
              )}
            </div>
          </div>

          {/* Controls + readings */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Reading label="Voltage" value={`${voltage.toFixed(0)} V`} />
              <Reading label="Resistance" value={`${resistance.toFixed(0)} Ω`} />
              <Reading label="Current" value={`${current.toFixed(2)} A`} highlight />
            </div>

            <Slider
              label="Supply voltage (V)"
              min={1}
              max={24}
              step={1}
              value={voltage}
              onChange={setVoltage}
            />
            <Slider
              label="Resistance (Ω)"
              min={1}
              max={48}
              step={1}
              value={resistance}
              onChange={setResistance}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setClosed((c) => !c)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                {closed ? "Open the switch" : "Close the switch"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setClosed(false);
                  setVoltage(9);
                  setResistance(10);
                  setStep(0);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-brand-soft"
              >
                <RotateCcw className="h-4 w-4" />
                Reset experiment
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Reading({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlight ? "border-saffron bg-brand-soft" : "border-border bg-background"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-bold">{value}</p>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-saffron"
      />
    </label>
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
    // HeyGen share links embed directly.
    return url;
  } catch {
    return url;
  }
}

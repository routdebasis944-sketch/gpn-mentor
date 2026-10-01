import type { ReactNode } from "react";

export function ReadingBox({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${warn ? "border-destructive bg-destructive/10" : highlight ? "border-saffron bg-brand-soft" : "border-border bg-background"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-bold capitalize">{value}</p>
    </div>
  );
}

export function RangeInput({ label, min, max, value, onChange, step = 1, disabled }: {
  label: string; min: number; max: number; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean;
}) {
  return (
    <label className={`mb-3 block ${disabled ? "opacity-50" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}: {value}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-saffron disabled:cursor-not-allowed" />
    </label>
  );
}

export function AnswerInput({ label, value, onChange }: { label: string; value?: string | undefined; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron" />
    </label>
  );
}

export function ToolButton({ onClick, children, active, disabled }: { onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${active ? "border-saffron bg-brand-soft" : "border-border hover:bg-brand-soft"}`}>
      {children}
    </button>
  );
}

export function BenchCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="hidden text-xs text-muted-foreground sm:inline">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

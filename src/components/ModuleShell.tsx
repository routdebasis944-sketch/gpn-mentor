import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import debasisAvatar from "@/assets/debasis-avatar.png";

const NAV = [
  { to: "/tracker", label: "Syllabus Tracker" },
  { to: "/career", label: "Resume Builder" },
  { to: "/interview", label: "Mock Interview" },
  { to: "/lab", label: "3D Lab" },
] as const;

export function SecureNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-saffron/50 bg-brand-soft px-3 py-2 text-xs font-medium">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
      <span>
        All analytical and profile data is processed and stored securely on Lovable Cloud servers (Asia-Pacific region),
        protected by encrypted connections and per-student access rules. Resume and interview text is sent to the AI only to generate your result and is not saved.
      </span>
    </p>
  );
}

export function ModuleShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="gpn-header-gradient text-primary-foreground shadow-lg print:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" aria-label="Back to chat" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <img src={debasisAvatar} alt="Debasis" className="h-10 w-10 rounded-full object-cover ring-2 ring-white/30" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
            <p className="truncate text-xs text-white/70">{subtitle}</p>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1.5 overflow-x-auto px-4 pb-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeProps={{ className: "bg-saffron text-accent-foreground" }}
              inactiveProps={{ className: "bg-white/10 ring-1 ring-white/20" }}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
        <div className="print:hidden"><SecureNote /></div>
        {children}
      </main>
    </div>
  );
}

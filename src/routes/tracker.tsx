import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, PlayCircle, FlaskConical, LogIn } from "lucide-react";
import { ModuleShell } from "@/components/ModuleShell";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session";
import { TRACK_BRANCHES, subjectsFor, topicKey, videoSearchUrl } from "@/lib/syllabus";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [
      { title: "SCTE&VT Syllabus Tracker — Gpn AI" },
      { name: "description", content: "Track video lectures watched and 3D practical labs completed against the Odisha SCTE&VT polytechnic syllabus." },
      { property: "og:title", content: "SCTE&VT Syllabus Tracker — Gpn AI" },
      { property: "og:description", content: "Learning analytics dashboard for polytechnic students: lecture and lab progress by semester." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tracker,
});

function Bar({ label, value, total, icon }: { label: string; value: number; total: number; icon: React.ReactNode }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-2">{icon}{label}</span>
        <span className="text-2xl font-extrabold">{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-saffron transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{value} of {total} completed</p>
    </div>
  );
}

function Tracker() {
  const { userId, ready } = useSessionUser();
  const [branch, setBranch] = useState("Electrical");
  const qc = useQueryClient();
  const subjects = subjectsFor(branch);
  const allKeys = subjects.flatMap((s) => s.topics.map((t) => topicKey(branch, s, t)));

  const videosQ = useQuery({
    queryKey: ["video_progress", userId],
    enabled: !!userId,
    queryFn: async () => new Set(((await supabase.from("video_progress").select("item_key")).data ?? []).map((r) => r.item_key)),
  });
  const labsQ = useQuery({
    queryKey: ["tracker_labs", branch, userId],
    queryFn: async () => {
      const mods = (await supabase.from("lab_modules").select("id, title, semester, sim_type").in("branch", [branch, "Common (1st Year)"]).order("semester")).data ?? [];
      const done = userId
        ? new Set(((await supabase.from("lab_attempts").select("module_id").eq("score", 100)).data ?? []).map((r) => r.module_id))
        : new Set<string>();
      return { mods, done };
    },
  });

  const watched = videosQ.data ?? new Set<string>();
  const watchedCount = allKeys.filter((k) => watched.has(k)).length;
  const toggle = async (key: string) => {
    if (!userId) return;
    if (watched.has(key)) await supabase.from("video_progress").delete().eq("item_key", key);
    else await supabase.from("video_progress").insert({ user_id: userId, item_key: key });
    qc.invalidateQueries({ queryKey: ["video_progress"] });
  };
  const mods = labsQ.data?.mods ?? [];
  const labsDone = mods.filter((m) => labsQ.data?.done.has(m.id)).length;

  return (
    <ModuleShell title="SCTE&VT Syllabus Tracker" subtitle="Learning analytics · Odisha Polytechnic syllabus">
      <div className="flex flex-wrap gap-2">
        {TRACK_BRANCHES.map((b) => (
          <button key={b} type="button" onClick={() => setBranch(b)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${branch === b ? "border-saffron bg-brand-soft font-semibold" : "border-border"}`}>{b}</button>
        ))}
      </div>

      {ready && !userId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <span>Sign in to save your progress and see completed labs.</span>
          <Link to="/auth" className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground"><LogIn className="h-4 w-4" /> Sign in</Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Bar label="Video lectures watched" value={watchedCount} total={allKeys.length} icon={<PlayCircle className="h-4 w-4 text-primary" />} />
        <Bar label="3D practical labs completed" value={labsDone} total={mods.length} icon={<FlaskConical className="h-4 w-4 text-primary" />} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Subjects &amp; video lectures</h2>
        {subjects.map((s) => {
          const keys = s.topics.map((t) => topicKey(branch, s, t));
          const done = keys.filter((k) => watched.has(k)).length;
          return (
            <div key={s.name} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Sem {s.sem} · {s.name}</p>
                <span className="text-xs text-muted-foreground">{Math.round((done / keys.length) * 100)}%</span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${(done / keys.length) * 100}%` }} /></div>
              <ul className="space-y-1.5">
                {s.topics.map((t) => {
                  const k = topicKey(branch, s, t);
                  const on = watched.has(k);
                  return (
                    <li key={t} className="flex items-center gap-2 text-sm">
                      <button type="button" onClick={() => toggle(k)} disabled={!userId} aria-label={on ? `Mark ${t} unwatched` : `Mark ${t} watched`} className="disabled:opacity-40">
                        {on ? <CheckCircle2 className="h-5 w-5 text-saffron" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <span className={`flex-1 ${on ? "line-through opacity-70" : ""}`}>{t}</span>
                      <a href={videoSearchUrl(s, t)} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline">Watch</a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">3D practical labs</h2>
        <ul className="space-y-1.5 text-sm">
          {mods.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              {labsQ.data?.done.has(m.id) ? <CheckCircle2 className="h-4 w-4 text-saffron" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className="flex-1 truncate">Sem {m.semester || "all"} · {m.title}</span>
            </li>
          ))}
        </ul>
        <Link to="/lab" className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open 3D Lab</Link>
        <p className="mt-2 text-xs text-muted-foreground">A lab counts as completed when you score 100%.</p>
      </section>
    </ModuleShell>
  );
}

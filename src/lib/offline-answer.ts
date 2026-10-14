// Offline backup answers used only when the AI service can't be reached.
// Uses real official portals only — no invented vacancies, dates or links.
import { subjectsFor, TRACK_BRANCHES, videoSearchUrl } from "@/lib/syllabus";

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

function pickBranch(t: string) {
  const s = t.toLowerCase();
  if (/(cse|computer|it\b|coding|python)/.test(s)) return "Computer Science";
  if (/mech/.test(s)) return "Mechanical";
  if (/civil/.test(s)) return "Civil";
  if (/(etc|electronic)/.test(s)) return "Electronics";
  if (/electric/.test(s)) return "Electrical";
  return null;
}

function courses(t: string) {
  const b = pickBranch(t) ?? "Electrical";
  const subs = subjectsFor(b);
  return `### 📘 ${b} — SCTE&VT Odisha syllabus timeline\n\n` +
    [1, 2, 3, 4, 5, 6].map((sem) => {
      const list = subs.filter((x) => x.sem === sem);
      if (!list.length) return "";
      return `**Semester ${sem}**\n` + list.map((x) => `- **${x.name}** — ${x.topics.join(", ")}`).join("\n");
    }).filter(Boolean).join("\n\n") +
    `\n\n📥 **Notes & official syllabus PDFs:** [sctevt.odisha.gov.in](https://sctevt.odisha.gov.in) · practicals in the **3D Lab**.\n\n_Other branches: ${TRACK_BRANCHES.join(", ")} — just name one._`;
}

function videos(t: string) {
  const b = pickBranch(t);
  const branches = b ? [b] : ["Electrical", "Mechanical", "Civil", "Computer Science"];
  return `### 🎬 Video lectures\n\n` + branches.map((br) => {
    const subs = subjectsFor(br).filter((s) => s.sem >= 3).slice(0, 3);
    return `**${br}**\n` + subs.map((s) => `- ${s.name}: [${s.topics[0]}](${videoSearchUrl(s, s.topics[0]!)})`).join("\n");
  }).join("\n\n") + `\n\n▶️ Trusted channels: [NPTEL](https://www.youtube.com/@iit), [Neso Academy](${yt("Neso Academy")}), [Gate Smashers](${yt("Gate Smashers")}).`;
}

const JOBS = `### 💼 Jobs for Diploma holders — official portals

**Government**
- **SSC JE** (Civil/Mechanical/Electrical) — [ssc.gov.in](https://ssc.gov.in)
- **RRB JE** (all engineering diplomas) — [rrbapply.gov.in](https://www.rrbapply.gov.in)
- **OSSC / OSSSC JE** (Odisha) — [ossc.gov.in](https://www.ossc.gov.in) · [osssc.gov.in](https://www.osssc.gov.in)
- **PSUs** (BHEL, NTPC, IOCL, NALCO technician/diploma trainee) — [bhel.com/careers](https://careers.bhel.in) · [ntpc.co.in](https://careers.ntpc.co.in) · [iocl.com](https://iocl.com/latest-job-opening)

**Private**
- **L&T** — [larsentoubro.com/careers](https://www.larsentoubro.com/corporate/careers/)
- **Tata Power** — [tatapower.com/careers](https://www.tatapower.com/careers)
- **Maruti Suzuki** — [marutisuzuki.com/careers](https://www.marutisuzuki.com/corporate/careers)

⚠️ Always check the latest notification PDF and last date on the official site before applying.`;

export function offlineAnswer(text: string) {
  const s = text.toLowerCase();
  const note = "\n\n---\n_⚡ Debasis is in offline mode right now — showing saved information. Full AI answers will return automatically._";
  if (/(job|vacanc|recruit|naukri|ssc|rrb|psu|alert)/.test(s)) return JOBS + note;
  if (/(video|lecture|tutorial|watch|youtube)/.test(s)) return videos(text) + note;
  if (/(course|syllabus|note|subject|semester|branch|detail)/.test(s)) return courses(text) + note;
  return `I can help with **course details & notes**, **video lectures**, and **job alerts**. Try: _"Mechanical syllabus"_, _"Electrical video lectures"_ or _"latest diploma jobs"_.` + note;
}

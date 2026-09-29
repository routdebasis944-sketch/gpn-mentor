// Server-only: syncs official SCTE&VT Odisha practical/lab documents into lab_modules.
const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // at most one real sync every 6 hours

const BRANCH_QUERIES: { branch: string; query: string; match: RegExp }[] = [
  { branch: "Electrical", query: "electrical practical syllabus", match: /electrical/i },
  { branch: "Electronics", query: "electronics telecommunication practical", match: /electronic|etc|e&tc/i },
  { branch: "Mechanical", query: "mechanical engineering lab practical", match: /mechanical|automobile/i },
  { branch: "Civil", query: "civil engineering lab practical", match: /civil/i },
  { branch: "Computer Science", query: "computer science CSE list of practicals", match: /cse|computer/i },
  { branch: "Common (1st Year)", query: "1st year common lab manual physics chemistry", match: /1st|first|common|physics|chemistry/i },
];

function guessSemester(text: string): number {
  const m = /(\d)\s*(?:st|nd|rd|th)?[\s_-]*sem/i.exec(text);
  if (m) return Math.min(6, Math.max(1, Number(m[1])));
  if (/1st year|first year|common/i.test(text)) return 1;
  return 0; // unknown
}

function cleanTitle(t: string) {
  return t.replace(/^\[PDF\]\s*/i, "").replace(/\s*-\s*sctevt$/i, "").trim().slice(0, 160);
}

type SearchHit = { url: string; title?: string; description?: string };

async function search(query: string): Promise<SearchHit[]> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const fc = process.env["FIRECRAWL_API_KEY"];
  if (!lovable || !fc) throw new Error("Scraper is not configured");
  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": fc,
    },
    body: JSON.stringify({ query: `site:sctevt.odisha.gov.in ${query}`, limit: 10 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Scraper request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: { web?: SearchHit[] } | SearchHit[] };
  const d = json.data;
  return Array.isArray(d) ? d : (d?.web ?? []);
}

export async function runLabSync(force = false): Promise<{ added: number; skipped?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();

  const { data: state } = await supabaseAdmin
    .from("lab_sync_state")
    .select("*")
    .eq("id", 1)
    .single();
  if (state?.locked_until && new Date(state.locked_until) > now) {
    return { added: 0, skipped: "Sync already running" };
  }
  if (!force && state?.last_run_at && now.getTime() - new Date(state.last_run_at).getTime() < MIN_INTERVAL_MS) {
    return { added: 0, skipped: "Synced recently" };
  }
  await supabaseAdmin
    .from("lab_sync_state")
    .update({ locked_until: new Date(now.getTime() + 5 * 60 * 1000).toISOString() })
    .eq("id", 1);

  let added = 0;
  try {
    for (const { branch, query, match } of BRANCH_QUERIES) {
      const hits = await search(query);
      const rows = hits
        .filter((h) => h.url?.includes("sctevt.odisha.gov.in") && /\.pdf/i.test(h.url))
        .filter((h) => match.test(`${h.url} ${h.title ?? ""}`) || branch === "Common (1st Year)")
        .map((h) => ({
          branch,
          semester: guessSemester(`${decodeURIComponent(h.url)} ${h.title ?? ""}`),
          title: cleanTitle(h.title || "Official practical document"),
          description: (h.description ?? "").slice(0, 400),
          source_url: h.url,
          is_official: true,
          updated_at: now.toISOString(),
        }));
      if (!rows.length) continue;
      const { data: existing } = await supabaseAdmin
        .from("lab_modules")
        .select("source_url")
        .in("source_url", rows.map((r) => r.source_url));
      const known = new Set((existing ?? []).map((e) => e.source_url));
      const fresh = rows.filter((r) => !known.has(r.source_url));
      if (fresh.length) {
        const { error } = await supabaseAdmin.from("lab_modules").insert(fresh);
        if (error) throw new Error(error.message);
        added += fresh.length;
      }
    }
    await supabaseAdmin
      .from("lab_sync_state")
      .update({ locked_until: null, last_run_at: now.toISOString(), last_added: added, last_error: null })
      .eq("id", 1);
    return { added };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Lab sync failed:", msg);
    await supabaseAdmin
      .from("lab_sync_state")
      .update({ locked_until: null, last_run_at: now.toISOString(), last_error: msg.slice(0, 500) })
      .eq("id", 1);
    throw e;
  }
}

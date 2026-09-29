<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Virtual lab list lives in `lab_modules`; official SCTE&VT docs are synced by `src/lib/lab-sync.server.ts` (Firecrawl search on sctevt.odisha.gov.in, 6h rate-limit + lock) via daily pg_cron → `/api/public/sync-labs`. Why: sctevt site is too slow to scrape directly.
- Practical scoring rules live in `src/lib/lab-eval.ts` (pure, Hindi mistake text); attempts saved to `lab_attempts` per user via RLS.

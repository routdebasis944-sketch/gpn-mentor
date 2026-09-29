import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { runLabSync } from "@/lib/lab-sync.server";

// Called daily by the scheduler. Accepts the cron secret or the project's public key;
// the sync itself is rate-limited (6h) and locked, and only reads public official documents.
export const Route = createFileRoute("/api/public/sync-labs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pub = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const apikey = request.headers.get("apikey");
        if (!(pub && apikey === pub)) {
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
        }
        try {
          const result = await runLabSync(false);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Sync failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});

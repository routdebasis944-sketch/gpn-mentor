import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncLabsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { runLabSync } = await import("./lab-sync.server");
    try {
      return { ok: true as const, ...(await runLabSync(false)) };
    } catch (e) {
      return { ok: false as const, added: 0, error: e instanceof Error ? e.message : "Sync failed" };
    }
  });

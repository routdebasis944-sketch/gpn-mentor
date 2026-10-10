import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSessionUser() {
  const [state, setState] = useState<{ userId: string | null; ready: boolean }>({ userId: null, ready: false });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ userId: data.session?.user.id ?? null, ready: true }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setState({ userId: s?.user.id ?? null, ready: true }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

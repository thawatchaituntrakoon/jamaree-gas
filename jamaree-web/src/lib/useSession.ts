import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/**
 * ใครกำลังใช้งานอยู่
 * ฐานข้อมูลเปิดให้เฉพาะคนที่ล็อกอินแล้วเท่านั้น (RLS) — ยังไม่ล็อกอิน = บันทึกอะไรไม่ได้เลย
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

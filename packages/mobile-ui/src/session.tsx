import AsyncStorage from "@react-native-async-storage/async-storage";
import { createApiClient, type SippyApi } from "@sippy/core/api";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";

/**
 * Only public values reach the app bundle: the Supabase URL and anon key (protected by RLS)
 * and the API base URL. They come from EAS environment variables at build time. Stripe keys
 * and the Supabase service-role key exist only on the server (apps/web) and never ship here.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const supabase: SupabaseClient = createClient(SUPABASE_URL || "http://localhost:54321", SUPABASE_ANON_KEY || "missing-anon-key", {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export const api: SippyApi = createApiClient({
  baseUrl: API_URL,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token,
});

interface Ctx {
  session: Session | null;
  ready: boolean;
}
const SessionContext = createContext<Ctx>({ session: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const value = useMemo(() => ({ session, ready }), [session, ready]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

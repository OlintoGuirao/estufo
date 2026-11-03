import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.trim() ?? "";
const publishableKey =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined)?.trim() ?? "";

export const isSupabaseConfigured = Boolean(url && publishableKey);

/**
 * Client do browser — só URL + publishable/anon key (nunca service role).
 * Igual ao padrão dos outros projetos Lovable/Vite.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env",
    );
  }
  return supabase;
}

export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  message: string;
  projectHost?: string;
}> {
  if (!supabase) {
    return {
      configured: false,
      connected: false,
      message: "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes.",
    };
  }
  try {
    // Ping leve na Auth API (não depende de tabelas ainda).
    const { error } = await supabase.auth.getSession();
    if (error) {
      return {
        configured: true,
        connected: false,
        message: error.message,
        projectHost: new URL(url).host,
      };
    }
    return {
      configured: true,
      connected: true,
      message: "Supabase client ok (Auth alcançável).",
      projectHost: new URL(url).host,
    };
  } catch (e) {
    const host = url ? new URL(url).host : "";
    return {
      configured: true,
      connected: false,
      message: e instanceof Error ? e.message : String(e),
      ...(host ? { projectHost: host } : {}),
    };
  }
}

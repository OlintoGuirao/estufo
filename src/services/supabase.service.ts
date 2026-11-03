import { checkSupabaseConnection, isSupabaseConfigured, supabase } from "@/lib/supabase";

export const supabaseService = {
  isConfigured: () => isSupabaseConfigured,
  client: () => supabase,
  status: () => checkSupabaseConnection(),
};

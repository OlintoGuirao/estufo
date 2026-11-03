import { request, qs, upload } from "./api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getContestFromSupabase,
  listContestsFromSupabase,
} from "./supabase/catalog";
import type { Contest, User } from "@/types";

export const contestsService = {
  async list(f: { search?: string; board?: string; status?: string }): Promise<Contest[]> {
    if (isSupabaseConfigured) return listContestsFromSupabase(f);
    return request<Contest[]>("GET", `/contests${qs(f)}`);
  },

  async get(id: string): Promise<Contest> {
    if (isSupabaseConfigured) return getContestFromSupabase(id);
    return request<Contest>("GET", `/contests/${id}`);
  },

  /** Ativo do usuário ainda via mock/auth local. */
  setActive: (id: string) => request<User>("POST", `/contests/${id}/activate`),

  importNotice: (file: File, onProgress: (p: number) => void) =>
    upload<Contest>("/contests/import", file, onProgress),
};

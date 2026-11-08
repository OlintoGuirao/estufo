import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getStudyOwnerId, studyOwnerQueryIds } from "@/lib/study-owner";
import type { MindMap } from "@/types";

export const studyMindPackDb = {
  enabled(): boolean {
    return isSupabaseConfigured;
  },

  async upsert(map: MindMap): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb.from("study_mind_packs").upsert(
      {
        id: map.id,
        device_id: getStudyOwnerId(),
        title: map.title,
        subject: map.subject,
        material: map.material ?? "",
        summary: map.summary ?? "",
        pack: map,
        warnings: map.warnings ?? [],
        ai_generated: !!map.aiGenerated,
        mocked: !!map.mocked,
        // Mesma data da edição: o outro aparelho compara e só baixa o que mudou.
        updated_at: map.updatedAt || new Date().toISOString(),
        created_at: map.updatedAt || new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  },

  async list(): Promise<MindMap[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("study_mind_packs")
      .select("pack")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => r.pack as MindMap).filter(Boolean);
  },

  /** Só id + data (leve): para saber o que mudou sem baixar o material. */
  async listMeta(): Promise<{ id: string; updatedAt: string }[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("study_mind_packs")
      .select("id, updated_at")
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: String(r.id), updatedAt: String(r.updated_at) }));
  },

  async getMany(ids: string[]): Promise<MindMap[]> {
    if (!isSupabaseConfigured || !ids.length) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("study_mind_packs")
      .select("pack, updated_at")
      .in("id", ids);
    if (error) throw error;
    return (data ?? [])
      .map((r) => {
        const m = r.pack as MindMap | null;
        // Usa a data do banco: assim a próxima comparação bate e não baixa de novo.
        return m ? { ...m, updatedAt: String(r.updated_at) } : null;
      })
      .filter((m): m is MindMap => !!m);
  },

  async remove(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("study_mind_packs")
      .delete()
      .eq("id", id)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
  },
};

export function syncStudyMindPack(map: MindMap | null): void {
  if (!map || !isSupabaseConfigured) return;
  void studyMindPackDb.upsert(map).catch((err) => {
    console.warn("[study-mind-pack-db] sync falhou", err);
  });
}

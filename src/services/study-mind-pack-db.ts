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
        updated_at: new Date().toISOString(),
        created_at: map.updatedAt,
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

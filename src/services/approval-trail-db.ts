import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getStudyOwnerId, studyOwnerQueryIds } from "@/lib/study-owner";
import type { ApprovalTrail } from "@/types/approval-trail";
import type { TrailWeekLesson } from "@/types/trail-week-lesson";
import type { TrailWeekProgress } from "@/types/trail-progress";

type TrailRow = {
  id: string;
  device_id: string;
  file_name: string;
  contest_name: string;
  organ: string;
  role: string;
  board: string;
  exam_date: string | null;
  summary: string;
  source_text_chars: number;
  mocked: boolean;
  plan: ApprovalTrail;
  created_at: string;
  updated_at: string;
};

type LessonRow = {
  trail_id: string;
  week: number;
  device_id: string;
  lesson: TrailWeekLesson;
  mocked: boolean;
  created_at: string;
  updated_at: string;
};

type ProgressRow = {
  trail_id: string;
  week: number;
  device_id: string;
  status: TrailWeekProgress["status"];
  active_module_id: string | null;
  active_module_index?: number | null;
  completed_module_ids: string[];
  practice_answers: TrailWeekProgress["practiceAnswers"];
  chat: TrailWeekProgress["chat"];
  updated_at: string;
};

function trailToRow(trail: ApprovalTrail): TrailRow {
  return {
    id: trail.id,
    device_id: getStudyOwnerId(),
    file_name: trail.fileName,
    contest_name: trail.contestName,
    organ: trail.organ,
    role: trail.role,
    board: trail.board,
    exam_date: trail.examDate,
    summary: trail.summary,
    source_text_chars: trail.sourceTextChars,
    mocked: trail.mocked,
    plan: trail,
    created_at: trail.createdAt,
    updated_at: trail.updatedAt,
  };
}

/**
 * Coluna da migration 012. Só envia depois de um SELECT bem-sucedido;
 * por padrão NÃO manda (evita 400/PGRST204 no console).
 */
let progressSupportsActiveModuleIndex = false;
let progressIndexProbed = false;

function progressToRow(p: TrailWeekProgress): Omit<ProgressRow, "active_module_index"> & {
  topic_ids: string[];
  active_module_index?: number | null;
} {
  const row: Omit<ProgressRow, "active_module_index"> & {
    topic_ids: string[];
    active_module_index?: number | null;
  } = {
    trail_id: p.trailId,
    week: p.week,
    device_id: getStudyOwnerId(),
    status: p.status,
    active_module_id: p.activeModuleId,
    completed_module_ids: p.completedModuleIds,
    practice_answers: p.practiceAnswers,
    chat: p.chat,
    topic_ids: p.topicIds ?? [],
    updated_at: p.updatedAt,
  };
  if (progressSupportsActiveModuleIndex) {
    row.active_module_index = p.activeModuleIndex ?? null;
  }
  return row;
}

async function probeActiveModuleIndexColumn(): Promise<void> {
  if (progressIndexProbed || !isSupabaseConfigured) return;
  progressIndexProbed = true;
  try {
    const sb = requireSupabase();
    const { error } = await sb.from("trail_week_progress").select("active_module_index").limit(1);
    progressSupportsActiveModuleIndex = !error;
  } catch {
    progressSupportsActiveModuleIndex = false;
  }
}

function progressFromRow(row: ProgressRow & { topic_ids?: string[] | null }): TrailWeekProgress {
  return {
    trailId: row.trail_id,
    week: row.week,
    status: row.status,
    activeModuleId: row.active_module_id,
    activeModuleIndex:
      typeof row.active_module_index === "number" ? row.active_module_index : null,
    completedModuleIds: Array.isArray(row.completed_module_ids) ? row.completed_module_ids : [],
    practiceAnswers:
      row.practice_answers && typeof row.practice_answers === "object"
        ? row.practice_answers
        : {},
    chat: Array.isArray(row.chat) ? row.chat : [],
    topicIds: Array.isArray(row.topic_ids) ? row.topic_ids : [],
    updatedAt: row.updated_at,
  };
}

export const approvalTrailDb = {
  enabled(): boolean {
    return isSupabaseConfigured;
  },

  async upsertTrail(trail: ApprovalTrail): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb.from("approval_trails").upsert(trailToRow(trail), {
      onConflict: "id",
    });
    if (error) throw error;
  },

  /** Só id + data (sem o plano, que pode ter vários MB). */
  async loadLatestTrailMeta(): Promise<{ id: string; updatedAt: string } | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("approval_trails")
      .select("id, updated_at")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as { id?: string; updated_at?: string } | undefined;
    return row?.id && row.updated_at ? { id: row.id, updatedAt: row.updated_at } : null;
  },

  async loadLatestTrail(): Promise<ApprovalTrail | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("approval_trails")
      .select("plan")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const plan = data?.[0]?.plan;
    if (!plan) return null;
    return plan as ApprovalTrail;
  },

  async deleteTrail(trailId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("approval_trails")
      .delete()
      .eq("id", trailId)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
  },

  async upsertLesson(lesson: TrailWeekLesson): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const row: LessonRow = {
      trail_id: lesson.trailId,
      week: lesson.week,
      device_id: getStudyOwnerId(),
      lesson,
      mocked: lesson.mocked,
      created_at: lesson.createdAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("trail_week_lessons").upsert(row, {
      onConflict: "trail_id,week",
    });
    if (error) throw error;
  },

  async loadLesson(trailId: string, week: number): Promise<TrailWeekLesson | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("trail_week_lessons")
      .select("lesson, updated_at")
      // trail_id + week já é a chave da aula. Filtrar por device_id escondia a aula
      // gerada antes do login (ou em outro aparelho) e o app gerava de novo.
      .eq("trail_id", trailId)
      .eq("week", week)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row?.lesson) return null;
    return row.lesson as TrailWeekLesson;
  },

  async deleteLessonsForTrail(trailId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("trail_week_lessons")
      .delete()
      .eq("trail_id", trailId)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
  },

  async upsertProgress(progress: TrailWeekProgress): Promise<void> {
    if (!isSupabaseConfigured) return;
    await probeActiveModuleIndexColumn();
    const sb = requireSupabase();
    const { error } = await sb.from("trail_week_progress").upsert(progressToRow(progress), {
      onConflict: "trail_id,week,device_id",
    });
    if (
      error &&
      (error.code === "PGRST204" || /active_module_index/i.test(error.message ?? ""))
    ) {
      progressSupportsActiveModuleIndex = false;
      const { error: retryErr } = await sb
        .from("trail_week_progress")
        .upsert(progressToRow(progress), { onConflict: "trail_id,week,device_id" });
      if (retryErr) throw retryErr;
      return;
    }
    if (error) throw error;
  },

  async loadProgress(trailId: string, week: number): Promise<TrailWeekProgress | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("trail_week_progress")
      .select("*")
      .eq("trail_id", trailId)
      .eq("week", week)
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return progressFromRow(row as ProgressRow);
  },

  async loadAllProgress(trailId: string): Promise<TrailWeekProgress[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("trail_week_progress")
      .select("*")
      .eq("trail_id", trailId)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
    const byWeek = new Map<number, TrailWeekProgress>();
    for (const row of data ?? []) {
      const p = progressFromRow(row as ProgressRow);
      const cur = byWeek.get(p.week);
      if (!cur || new Date(p.updatedAt) > new Date(cur.updatedAt)) {
        byWeek.set(p.week, p);
      }
    }
    return [...byWeek.values()].sort((a, b) => a.week - b.week);
  },

  async deleteProgressForTrail(trailId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("trail_week_progress")
      .delete()
      .eq("trail_id", trailId)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
  },
};

let pendingTrail: ApprovalTrail | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Envia a trilha ao banco com atraso de 2 s, juntando várias gravações em uma.
 * A trilha tem vários MB; ao gerar material, cada lote disparava um upload
 * completo — dezenas de envios pesados competindo com as chamadas à IA.
 */
export function syncApprovalTrail(trail: ApprovalTrail | null): void {
  if (!trail || !isSupabaseConfigured) return;
  pendingTrail = trail;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    const t = pendingTrail;
    pendingTrail = null;
    pendingTimer = null;
    if (!t) return;
    void approvalTrailDb.upsertTrail(t).catch((err) => {
      console.warn("[approval-trail-db] falha ao sync trilha", err);
    });
  }, 2_000);
}

/** Aguarda persistência do plano (material gerado) no banco. */
export async function syncApprovalTrailNow(trail: ApprovalTrail | null): Promise<void> {
  if (!trail || !isSupabaseConfigured) return;
  // O envio imediato substitui qualquer envio atrasado pendente.
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  pendingTrail = null;
  await approvalTrailDb.upsertTrail(trail);
}

export function syncTrailLesson(lesson: TrailWeekLesson | null): void {
  if (!lesson || !isSupabaseConfigured) return;
  void approvalTrailDb.upsertLesson(lesson).catch((err) => {
    console.warn("[approval-trail-db] falha ao sync aula", err);
  });
}

export async function syncTrailLessonNow(lesson: TrailWeekLesson | null): Promise<void> {
  if (!lesson || !isSupabaseConfigured) return;
  await approvalTrailDb.upsertLesson(lesson);
}

export function syncTrailProgress(progress: TrailWeekProgress | null): void {
  if (!progress || !isSupabaseConfigured) return;
  void approvalTrailDb.upsertProgress(progress).catch((err) => {
    console.warn("[approval-trail-db] falha ao sync progresso", err);
  });
}

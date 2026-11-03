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

function progressToRow(p: TrailWeekProgress): ProgressRow & { topic_ids: string[] } {
  return {
    trail_id: p.trailId,
    week: p.week,
    device_id: getStudyOwnerId(),
    status: p.status,
    active_module_id: p.activeModuleId,
    active_module_index: p.activeModuleIndex ?? null,
    completed_module_ids: p.completedModuleIds,
    practice_answers: p.practiceAnswers,
    chat: p.chat,
    topic_ids: p.topicIds ?? [],
    updated_at: p.updatedAt,
  };
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
      .eq("trail_id", trailId)
      .eq("week", week)
      .in("device_id", studyOwnerQueryIds())
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
    const sb = requireSupabase();
    const { error } = await sb.from("trail_week_progress").upsert(progressToRow(progress), {
      onConflict: "trail_id,week,device_id",
    });
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

export function syncApprovalTrail(trail: ApprovalTrail | null): void {
  if (!trail || !isSupabaseConfigured) return;
  void approvalTrailDb.upsertTrail(trail).catch((err) => {
    console.warn("[approval-trail-db] falha ao sync trilha", err);
  });
}

/** Aguarda persistência do plano (material gerado) no banco. */
export async function syncApprovalTrailNow(trail: ApprovalTrail | null): Promise<void> {
  if (!trail || !isSupabaseConfigured) return;
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

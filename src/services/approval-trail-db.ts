import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/device-id";
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
    device_id: getDeviceId(),
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
    device_id: getDeviceId(),
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
      .eq("device_id", getDeviceId())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data?.plan) return null;
    return data.plan as ApprovalTrail;
  },

  async deleteTrail(trailId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("approval_trails")
      .delete()
      .eq("id", trailId)
      .eq("device_id", getDeviceId());
    if (error) throw error;
  },

  async upsertLesson(lesson: TrailWeekLesson): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const row: LessonRow = {
      trail_id: lesson.trailId,
      week: lesson.week,
      device_id: getDeviceId(),
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
      .select("lesson")
      .eq("trail_id", trailId)
      .eq("week", week)
      .eq("device_id", getDeviceId())
      .maybeSingle();
    if (error) throw error;
    if (!data?.lesson) return null;
    return data.lesson as TrailWeekLesson;
  },

  async deleteLessonsForTrail(trailId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("trail_week_lessons")
      .delete()
      .eq("trail_id", trailId)
      .eq("device_id", getDeviceId());
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
      .eq("device_id", getDeviceId())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return progressFromRow(data as ProgressRow);
  },

  async loadAllProgress(trailId: string): Promise<TrailWeekProgress[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("trail_week_progress")
      .select("*")
      .eq("trail_id", trailId)
      .eq("device_id", getDeviceId());
    if (error) throw error;
    return (data ?? []).map((row) => progressFromRow(row as ProgressRow));
  },

  async deleteProgressForTrail(trailId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("trail_week_progress")
      .delete()
      .eq("trail_id", trailId)
      .eq("device_id", getDeviceId());
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

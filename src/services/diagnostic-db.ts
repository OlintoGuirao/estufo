import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/device-id";
import type { DiagnosticAnalysis, DiagnosticItemResult } from "@/lib/study-plan-diagnostic";
import type { DiagnosticRun } from "@/types/diagnostic";
import type { Question } from "@/types";

type DbRunRow = {
  id: string;
  device_id: string;
  prova_id: number | null;
  prova_title: string | null;
  status: "running" | "finished";
  current_index: number;
  drafts: Record<string, string>;
  question_ids: string[];
  questions_snapshot: Question[];
  answers_snapshot: DiagnosticItemResult[];
  analysis: DiagnosticAnalysis | null;
  scheduled_focus_keys: string[];
  started_at: string;
  updated_at: string;
  finished_at: string | null;
};

function toRow(run: DiagnosticRun): DbRunRow {
  return {
    id: run.id,
    device_id: getDeviceId(),
    prova_id: run.provaId,
    prova_title: run.provaTitle,
    status: run.finishedAt ? "finished" : "running",
    current_index: run.currentIndex ?? 0,
    drafts: run.drafts ?? {},
    question_ids: run.questionIds,
    questions_snapshot: run.questions,
    answers_snapshot: run.answers,
    analysis: run.analysis,
    scheduled_focus_keys: run.scheduledFocusKeys ?? [],
    started_at: run.startedAt,
    updated_at: run.updatedAt ?? run.startedAt,
    finished_at: run.finishedAt,
  };
}

function fromRow(row: DbRunRow): DiagnosticRun {
  return {
    id: row.id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
    provaId: row.prova_id,
    provaTitle: row.prova_title,
    questionIds: Array.isArray(row.question_ids) ? row.question_ids : [],
    currentIndex: row.current_index ?? 0,
    drafts: row.drafts && typeof row.drafts === "object" ? row.drafts : {},
    questions: Array.isArray(row.questions_snapshot) ? row.questions_snapshot : [],
    answers: Array.isArray(row.answers_snapshot) ? row.answers_snapshot : [],
    analysis: row.analysis ?? null,
    scheduledFocusKeys: Array.isArray(row.scheduled_focus_keys) ? row.scheduled_focus_keys : [],
  };
}

async function upsertAnswers(run: DiagnosticRun) {
  const sb = requireSupabase();
  const rows = run.answers.map((a) => ({
    run_id: run.id,
    question_id: a.questionId,
    subject: a.subject,
    topic: a.topic,
    choice: a.choice,
    correct_key: a.correctKey,
    correct: a.correct,
    answered_at: a.answeredAt ?? new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await sb.from("diagnostic_answers").upsert(rows, {
    onConflict: "run_id,question_id",
  });
  if (error) throw error;
}

export const diagnosticDb = {
  enabled(): boolean {
    return isSupabaseConfigured;
  },

  async upsertRun(run: DiagnosticRun): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const row = toRow(run);
    const { error } = await sb.from("diagnostic_runs").upsert(row, { onConflict: "id" });
    if (error) throw error;
    if (run.answers.length) await upsertAnswers(run);
  },

  async loadRunning(): Promise<DiagnosticRun | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const deviceId = getDeviceId();
    const { data, error } = await sb
      .from("diagnostic_runs")
      .select("*")
      .eq("device_id", deviceId)
      .eq("status", "running")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return fromRow(data as DbRunRow);
  },

  async loadLatestFinished(): Promise<DiagnosticRun | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const deviceId = getDeviceId();
    const { data, error } = await sb
      .from("diagnostic_runs")
      .select("*")
      .eq("device_id", deviceId)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return fromRow(data as DbRunRow);
  },

  async deleteRun(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb.from("diagnostic_runs").delete().eq("id", id).eq("device_id", getDeviceId());
    if (error) throw error;
  },
};

/** Sync best-effort: não quebra o fluxo se o banco falhar. */
export function syncDiagnosticRun(run: DiagnosticRun | null): void {
  if (!run || !isSupabaseConfigured) return;
  void diagnosticDb.upsertRun(run).catch((err) => {
    console.warn("[diagnostic-db] falha ao sincronizar", err);
  });
}

import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getStudyOwnerId, studyOwnerQueryIds } from "@/lib/study-owner";
import type { ErrorNote, MockExam, MockExamResult, Review, StudySession } from "@/types";
import type { QuestPlayerState } from "@/types/tjsp-quest";
import type { QuestPhaseAiPayload } from "@/lib/tjsp-quest/ai-phase-content";
import type { LocalQuestionUserState } from "@/services/local-question-state";

export type StudyUserSnapshot = {
  errorNotes: ErrorNote[];
  exams: Array<MockExam & { result?: MockExamResult | null }>;
  reviews: Review[];
  sessions: StudySession[];
  questState: QuestPlayerState | null;
  questPhaseAi: Array<{
    phaseId: string;
    content: QuestPhaseAiPayload;
    model: string;
    mocked: boolean;
    savedAt: string;
  }>;
  questionLocalState: Record<string, LocalQuestionUserState>;
};

function nowIso() {
  return new Date().toISOString();
}

/** Sync best-effort do caderno, simulados, revisões, plano, Quest e estado de questões. */
export const studyUserDataDb = {
  enabled(): boolean {
    return isSupabaseConfigured;
  },

  async upsertErrorNotes(notes: ErrorNote[]): Promise<void> {
    if (!isSupabaseConfigured || !notes.length) return;
    const sb = requireSupabase();
    const deviceId = getStudyOwnerId();
    const rows = notes.map((n) => ({
      id: n.id,
      device_id: deviceId,
      payload: n,
      created_at: n.createdAt || nowIso(),
      updated_at: nowIso(),
    }));
    const { error } = await sb.from("user_error_notes").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  },

  async removeErrorNote(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("user_error_notes")
      .delete()
      .eq("id", id)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
  },

  async listErrorNotes(): Promise<ErrorNote[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_error_notes")
      .select("payload")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => r.payload as ErrorNote).filter(Boolean);
  },

  async upsertMockExams(
    exams: MockExam[],
    results: Record<string, MockExamResult>,
  ): Promise<void> {
    if (!isSupabaseConfigured || !exams.length) return;
    const sb = requireSupabase();
    const deviceId = getStudyOwnerId();
    const rows = exams.map((e) => ({
      id: e.id,
      device_id: deviceId,
      exam: e,
      result: results[e.id] ?? null,
      created_at: e.createdAt || nowIso(),
      updated_at: nowIso(),
    }));
    const { error } = await sb.from("user_mock_exams").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  },

  async listMockExams(): Promise<Array<MockExam & { result?: MockExamResult | null }>> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_mock_exams")
      .select("exam, result")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? [])
      .map((r) => {
        const exam = r.exam as MockExam;
        if (!exam?.id) return null;
        return { ...exam, result: (r.result as MockExamResult | null) ?? null };
      })
      .filter(Boolean) as Array<MockExam & { result?: MockExamResult | null }>;
  },

  async upsertReviews(reviews: Review[]): Promise<void> {
    if (!isSupabaseConfigured || !reviews.length) return;
    const sb = requireSupabase();
    const deviceId = getStudyOwnerId();
    const rows = reviews.map((r) => ({
      id: r.id,
      device_id: deviceId,
      payload: r,
      due_date: r.dueDate || null,
      updated_at: nowIso(),
    }));
    const { error } = await sb.from("user_reviews").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  },

  async listReviews(): Promise<Review[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_reviews")
      .select("payload")
      .in("device_id", studyOwnerQueryIds())
      .order("due_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => r.payload as Review).filter(Boolean);
  },

  async upsertSessions(sessions: StudySession[]): Promise<void> {
    if (!isSupabaseConfigured || !sessions.length) return;
    const sb = requireSupabase();
    const deviceId = getStudyOwnerId();
    const rows = sessions.map((s) => ({
      id: s.id,
      device_id: deviceId,
      payload: s,
      session_date: s.date || null,
      updated_at: nowIso(),
    }));
    const { error } = await sb.from("user_study_sessions").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  },

  async removeSession(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("user_study_sessions")
      .delete()
      .eq("id", id)
      .in("device_id", studyOwnerQueryIds());
    if (error) throw error;
  },

  async listSessions(): Promise<StudySession[]> {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_study_sessions")
      .select("payload")
      .in("device_id", studyOwnerQueryIds())
      .order("session_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => r.payload as StudySession).filter(Boolean);
  },

  async upsertQuestState(state: QuestPlayerState): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb.from("user_quest_state").upsert(
      {
        device_id: getStudyOwnerId(),
        payload: state,
        updated_at: state.updatedAt || nowIso(),
      },
      { onConflict: "device_id" },
    );
    if (error) throw error;
  },

  async loadQuestState(): Promise<QuestPlayerState | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_quest_state")
      .select("payload")
      .in("device_id", studyOwnerQueryIds())
      .limit(1);
    if (error) throw error;
    return (data?.[0]?.payload as QuestPlayerState) ?? null;
  },

  async upsertQuestPhaseAi(entry: {
    phaseId: string;
    content: QuestPhaseAiPayload;
    model: string;
    mocked: boolean;
    savedAt: string;
  }): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const deviceId = getStudyOwnerId();
    const id = `${deviceId}:${entry.phaseId}`;
    const { error } = await sb.from("user_quest_phase_ai").upsert(
      {
        id,
        device_id: deviceId,
        phase_id: entry.phaseId,
        payload: entry,
        model: entry.model,
        mocked: entry.mocked,
        updated_at: entry.savedAt || nowIso(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  },

  async removeQuestPhaseAi(phaseId: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb
      .from("user_quest_phase_ai")
      .delete()
      .in("device_id", studyOwnerQueryIds())
      .eq("phase_id", phaseId);
    if (error) throw error;
  },

  async getQuestPhaseAi(phaseId: string): Promise<{
    phaseId: string;
    content: QuestPhaseAiPayload;
    model: string;
    mocked: boolean;
    savedAt: string;
  } | null> {
    if (!isSupabaseConfigured) return null;
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_quest_phase_ai")
      .select("payload, updated_at")
      .in("device_id", studyOwnerQueryIds())
      .eq("phase_id", phaseId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row?.payload) return null;
    const p = row.payload as StudyUserSnapshot["questPhaseAi"][number];
    if (!p?.phaseId || !p?.content) return null;
    return {
      ...p,
      savedAt: p.savedAt || (row as { updated_at?: string }).updated_at || nowIso(),
    };
  },

  async listQuestPhaseAi(): Promise<
    Array<{
      phaseId: string;
      content: QuestPhaseAiPayload;
      model: string;
      mocked: boolean;
      savedAt: string;
    }>
  > {
    if (!isSupabaseConfigured) return [];
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_quest_phase_ai")
      .select("payload, updated_at")
      .in("device_id", studyOwnerQueryIds())
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const byPhase = new Map<string, StudyUserSnapshot["questPhaseAi"][number]>();
    for (const r of data ?? []) {
      const p = r.payload as StudyUserSnapshot["questPhaseAi"][number];
      if (!p?.phaseId || !p?.content) continue;
      if (byPhase.has(p.phaseId)) continue;
      byPhase.set(p.phaseId, {
        ...p,
        savedAt: p.savedAt || (r as { updated_at?: string }).updated_at || nowIso(),
      });
    }
    return Array.from(byPhase.values());
  },

  async upsertQuestionLocalState(payload: Record<string, LocalQuestionUserState>): Promise<void> {
    if (!isSupabaseConfigured) return;
    const sb = requireSupabase();
    const { error } = await sb.from("user_question_local_state").upsert(
      {
        device_id: getStudyOwnerId(),
        payload,
        updated_at: nowIso(),
      },
      { onConflict: "device_id" },
    );
    if (error) throw error;
  },

  async loadQuestionLocalState(): Promise<Record<string, LocalQuestionUserState>> {
    if (!isSupabaseConfigured) return {};
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("user_question_local_state")
      .select("payload")
      .in("device_id", studyOwnerQueryIds())
      .limit(1);
    if (error) throw error;
    const p = data?.[0]?.payload;
    return p && typeof p === "object" ? (p as Record<string, LocalQuestionUserState>) : {};
  },

  /** Carrega tudo do device atual (para hydrate). */
  async loadAll(): Promise<StudyUserSnapshot> {
    const [
      errorNotes,
      exams,
      reviews,
      sessions,
      questState,
      questPhaseAi,
      questionLocalState,
    ] = await Promise.all([
      this.listErrorNotes(),
      this.listMockExams(),
      this.listReviews(),
      this.listSessions(),
      this.loadQuestState(),
      this.listQuestPhaseAi(),
      this.loadQuestionLocalState(),
    ]);
    return {
      errorNotes,
      exams,
      reviews,
      sessions,
      questState,
      questPhaseAi,
      questionLocalState,
    };
  },
};

type MockDbSlice = {
  errorNotes: ErrorNote[];
  exams: MockExam[];
  examResults: Record<string, MockExamResult>;
  reviews: Review[];
  sessions: StudySession[];
};

/** Push do mockdb (erros/simulados/revisões/sessões) para o Supabase. */
export function syncStudyMockSlice(slice: MockDbSlice): void {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      await Promise.all([
        studyUserDataDb.upsertErrorNotes(slice.errorNotes ?? []),
        studyUserDataDb.upsertMockExams(slice.exams ?? [], slice.examResults ?? {}),
        studyUserDataDb.upsertReviews(slice.reviews ?? []),
        studyUserDataDb.upsertSessions(slice.sessions ?? []),
      ]);
    } catch (err) {
      console.warn("[study-user-data-db] sync mock slice falhou", err);
    }
  })();
}

export function syncQuestState(state: QuestPlayerState | null): void {
  if (!state || !isSupabaseConfigured) return;
  void studyUserDataDb.upsertQuestState(state).catch((err) => {
    console.warn("[study-user-data-db] sync quest state falhou", err);
  });
}

/** Preferir `questPhaseAiStore.set` (await). Mantido para compat. */
export function syncQuestPhaseAi(entry: {
  phaseId: string;
  content: QuestPhaseAiPayload;
  model: string;
  mocked: boolean;
  savedAt: string;
} | null): void {
  if (!entry || !isSupabaseConfigured) return;
  void studyUserDataDb.upsertQuestPhaseAi(entry).catch((err) => {
    console.warn("[study-user-data-db] sync quest phase ai falhou", err);
  });
}

export async function persistQuestPhaseAi(entry: {
  phaseId: string;
  content: QuestPhaseAiPayload;
  model: string;
  mocked: boolean;
  savedAt: string;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  await studyUserDataDb.upsertQuestPhaseAi(entry);
}

export function syncQuestionLocalState(payload: Record<string, LocalQuestionUserState>): void {
  if (!isSupabaseConfigured) return;
  void studyUserDataDb.upsertQuestionLocalState(payload).catch((err) => {
    console.warn("[study-user-data-db] sync question local state falhou", err);
  });
}

function byIdMerge<T extends { id: string }>(local: T[], remote: T[], pickNewer?: (a: T, b: T) => T): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const prev = map.get(item.id);
    if (!prev) map.set(item.id, item);
    else if (pickNewer) map.set(item.id, pickNewer(prev, item));
    else map.set(item.id, item);
  }
  return [...map.values()];
}

/** Mescla snapshot remoto no mockdb in-memory (local ganha se ambos existem, exceto exams vazios). */
export function mergeRemoteIntoMockDb(
  db: MockDbSlice,
  remote: StudyUserSnapshot,
  opts?: { preferRemoteExams?: boolean },
): void {
  const noteNewer = (a: ErrorNote, b: ErrorNote) =>
    (a.createdAt || "") >= (b.createdAt || "") ? a : b;
  db.errorNotes = byIdMerge(db.errorNotes ?? [], remote.errorNotes ?? [], noteNewer);

  const preferRemote = opts?.preferRemoteExams || !(db.exams?.length);
  if (preferRemote && remote.exams?.length) {
    db.exams = remote.exams.map(({ result: _r, ...exam }) => exam as MockExam);
    db.examResults = {};
    for (const e of remote.exams) {
      if (e.result) db.examResults[e.id] = e.result;
    }
  } else {
    const remoteOnly = (remote.exams ?? []).filter((e) => !(db.exams ?? []).some((x) => x.id === e.id));
    for (const e of remoteOnly) {
      const { result, ...exam } = e;
      db.exams.push(exam as MockExam);
      if (result) db.examResults[exam.id] = result;
    }
  }

  db.reviews = byIdMerge(db.reviews ?? [], remote.reviews ?? []);
  db.sessions = byIdMerge(db.sessions ?? [], remote.sessions ?? []);
}

import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import {
  claimDeviceStudyDataToAccount,
  getStudyOwnerId,
  getStudyOwnerUserId,
  setStudyOwnerUserId,
} from "@/lib/study-owner";

let inflight: Promise<void> | null = null;
let uploadInflight: Promise<void> | null = null;
let lastUserId: string | null = null;

const SYNC_MARK = "estufoo.study-sync.last";
/** Reenvio completo do material local no máximo a cada 6 h por aparelho. */
const FULL_UPLOAD_EVERY_MS = 6 * 60 * 60 * 1000;

function readSyncMark(userId: string): number {
  try {
    const raw = JSON.parse(localStorage.getItem(SYNC_MARK) || "{}") as Record<string, number>;
    return Number(raw[userId] ?? 0);
  } catch {
    return 0;
  }
}

function writeSyncMark(userId: string, at: number) {
  try {
    const raw = JSON.parse(localStorage.getItem(SYNC_MARK) || "{}") as Record<string, number>;
    raw[userId] = at;
    localStorage.setItem(SYNC_MARK, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

/** Executa tarefas com no máximo `limit` em paralelo. */
async function runLimited(tasks: (() => Promise<unknown>)[], limit = 4): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (i < tasks.length) {
      const task = tasks[i++]!;
      try {
        await task();
      } catch (err) {
        console.warn("[study-sync]", err);
      }
    }
  });
  await Promise.all(workers);
}

/**
 * No login / restore: associa o aparelho à conta e sobe o material local
 * para a chave `user_<id>` (o outro aparelho só lê essa chave).
 *
 * Desempenho: as páginas só esperam o "claim" (rápido). O upload do material
 * local roda em segundo plano, em paralelo, e só envia o que mudou desde o
 * último envio — antes cada carregamento do Painel esperava dezenas de
 * requisições em fila (trilha inteira + cada aula + cada progresso).
 */
export async function syncAccountStudyData(
  userId: string,
  opts?: {
    /** O chamador já vai recarregar/navegar a página (ex.: login). */
    willNavigate?: boolean;
  },
): Promise<void> {
  if (!userId || !isSupabaseConfigured || typeof window === "undefined") return;
  if (inflight && lastUserId === userId) return inflight;

  lastUserId = userId;
  inflight = (async () => {
    setStudyOwnerUserId(userId);

    // O cache do aparelho é de outra conta? Apaga antes de qualquer envio —
    // senão os dados da conta antiga iam parar na conta nova.
    const { ensureLocalDataBelongsTo } = await import("@/lib/local-study-data");
    const own = await ensureLocalDataBelongsTo(userId);
    if (own.switched) {
      writeSyncMark(userId, 0);
      if (!opts?.willNavigate) {
        // Recarrega para limpar o que ainda está na memória das telas.
        window.location.reload();
        return;
      }
      return; // nada local para enviar: a conta nova carrega do banco
    }

    // Só "adota" os dados criados sem login neste aparelho no 1º login dele.
    if (own.firstOwner) {
      try {
        await claimDeviceStudyDataToAccount(userId);
      } catch (err) {
        console.warn("[study-sync] claim falhou", err);
      }
    }
    const last = readSyncMark(userId);
    const startedAt = Date.now();
    uploadInflight = uploadLocalStudyPayloads(
      startedAt - last > FULL_UPLOAD_EVERY_MS ? 0 : last,
    )
      .then(() => writeSyncMark(userId, startedAt))
      .catch((err) => console.warn("[study-sync] upload local falhou", err));
  })();

  await inflight;
}

export function resetAccountStudySync(): void {
  inflight = null;
  uploadInflight = null;
  lastUserId = null;
}

/** Páginas esperam só o vínculo da conta (rápido) antes de hidratar remoto. */
export async function waitForAccountStudySync(): Promise<void> {
  const uid = getStudyOwnerUserId();
  if (uid) {
    await syncAccountStudyData(uid);
    return;
  }
  if (inflight) await inflight;
}

/**
 * Envia ao banco tudo que está só no aparelho (antes de sair da conta).
 * Espera no máximo `timeoutMs` para não travar o botão Sair.
 */
export async function flushAllStudyDataToCloud(timeoutMs = 8_000): Promise<void> {
  const uid = getStudyOwnerUserId();
  if (!uid || !isSupabaseConfigured || typeof window === "undefined") return;
  const work = (async () => {
    await uploadLocalStudyPayloads(0).catch(() => undefined);
    try {
      const { redacaoStore } = await import("@/services/redacao-store");
      await redacaoStore.syncDraftNow();
    } catch {
      /* ignore */
    }
  })();
  await Promise.race([work, new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** Para quem precisa do upload completo (ex.: trocar de aparelho manualmente). */
export async function waitForStudyUpload(): Promise<void> {
  await waitForAccountStudySync();
  if (uploadInflight) await uploadInflight;
}

async function uploadLocalStudyPayloads(changedSince: number): Promise<void> {
  const { approvalTrailStore } = await import("@/services/approval-trail-store");
  const { approvalTrailDb } = await import("@/services/approval-trail-db");
  const { trailProgressStore } = await import("@/services/trail-progress-store");
  const { trailWeekLessonStore } = await import("@/services/trail-week-lesson-store");
  const { studyScheduleStore } = await import("@/services/study-schedule-store");
  const { videoLessonProgressStore } = await import("@/services/video-lesson-progress-store");
  const { syncStudyMockSlice } = await import("@/services/study-user-data-db");

  const changed = (iso?: string | null) =>
    !changedSince || !iso || new Date(iso).getTime() > changedSince;

  const trail = approvalTrailStore.get();
  if (trail) {
    const tasks: (() => Promise<unknown>)[] = [];
    // Sobe a trilha sem mexer no updatedAt (antes saveNow "atualizava" a data
    // e forçava novo upload/download completo em toda visita).
    if (changed(trail.updatedAt)) tasks.push(() => approvalTrailDb.upsertTrail(trail));
    for (const p of trailProgressStore.listLocal(trail.id)) {
      if (changed(p.updatedAt)) tasks.push(() => approvalTrailDb.upsertProgress(p));
    }
    await trailWeekLessonStore.ready();
    for (const lesson of trailWeekLessonStore.listLocal(trail.id)) {
      const at = (lesson as { updatedAt?: string; createdAt?: string }).updatedAt ?? lesson.createdAt;
      if (changed(at))
        tasks.push(() =>
          approvalTrailDb
            .upsertLesson(lesson)
            .then(() => trailWeekLessonStore.markSynced(lesson.trailId, lesson.week)),
        );
    }
    await runLimited(tasks, 4);
  }

  try {
    const schedule = studyScheduleStore.get();
    studyScheduleStore.set({
      studyDays: schedule.studyDays,
      redacaoDays: schedule.redacaoDays,
      examDays: schedule.examDays,
    });
  } catch (err) {
    console.warn("[study-sync] agenda", err);
  }

  try {
    const bag = videoLessonProgressStore.all();
    if (Object.keys(bag).length) {
      const sb = requireSupabase();
      await sb.from("user_video_lesson_progress").upsert(
        {
          device_id: getStudyOwnerId(),
          payload: bag,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    }
  } catch (err) {
    console.warn("[study-sync] video progress", err);
  }

  try {
    const raw = localStorage.getItem("estufoo.mockdb");
    if (!raw) return;
    const db = JSON.parse(raw) as {
      errorNotes?: unknown[];
      exams?: unknown[];
      examResults?: Record<string, unknown>;
      reviews?: unknown[];
      sessions?: unknown[];
    };
    syncStudyMockSlice({
      errorNotes: (db.errorNotes as never) ?? [],
      exams: (db.exams as never) ?? [],
      examResults: (db.examResults as never) ?? {},
      reviews: (db.reviews as never) ?? [],
      sessions: (db.sessions as never) ?? [],
    });
  } catch (err) {
    console.warn("[study-sync] mockdb", err);
  }
}

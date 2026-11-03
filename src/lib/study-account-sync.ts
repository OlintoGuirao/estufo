import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import {
  claimDeviceStudyDataToAccount,
  getStudyOwnerId,
  getStudyOwnerUserId,
  setStudyOwnerUserId,
} from "@/lib/study-owner";

let inflight: Promise<void> | null = null;
let lastUserId: string | null = null;

/**
 * No login / restore: associa o aparelho à conta e sobe o material local
 * para a chave `user_<id>` (o outro aparelho só lê essa chave).
 */
export async function syncAccountStudyData(userId: string): Promise<void> {
  if (!userId || !isSupabaseConfigured || typeof window === "undefined") return;
  if (inflight && lastUserId === userId) return inflight;

  lastUserId = userId;
  inflight = (async () => {
    setStudyOwnerUserId(userId);
    try {
      await claimDeviceStudyDataToAccount(userId);
    } catch (err) {
      console.warn("[study-sync] claim falhou", err);
    }
    try {
      await uploadLocalStudyPayloads();
    } catch (err) {
      console.warn("[study-sync] upload local falhou", err);
    }
  })();

  await inflight;
}

export function resetAccountStudySync(): void {
  inflight = null;
  lastUserId = null;
}

/** Páginas esperam o sync da conta antes de hidratar remoto. */
export async function waitForAccountStudySync(): Promise<void> {
  const uid = getStudyOwnerUserId();
  if (uid) {
    await syncAccountStudyData(uid);
    return;
  }
  if (inflight) await inflight;
}

async function uploadLocalStudyPayloads(): Promise<void> {
  const { approvalTrailStore } = await import("@/services/approval-trail-store");
  const { approvalTrailDb } = await import("@/services/approval-trail-db");
  const { trailProgressStore } = await import("@/services/trail-progress-store");
  const { trailWeekLessonStore } = await import("@/services/trail-week-lesson-store");
  const { studyScheduleStore } = await import("@/services/study-schedule-store");
  const { videoLessonProgressStore } = await import("@/services/video-lesson-progress-store");
  const { syncStudyMockSlice } = await import("@/services/study-user-data-db");

  const trail = approvalTrailStore.get();
  if (trail) {
    await approvalTrailStore.saveNow(trail);
    for (const p of trailProgressStore.listLocal(trail.id)) {
      try {
        await approvalTrailDb.upsertProgress(p);
      } catch (err) {
        console.warn("[study-sync] progresso", p.week, err);
      }
    }
    for (const lesson of trailWeekLessonStore.listLocal(trail.id)) {
      try {
        await trailWeekLessonStore.saveNow(lesson);
      } catch (err) {
        console.warn("[study-sync] aula", lesson.week, err);
      }
    }
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

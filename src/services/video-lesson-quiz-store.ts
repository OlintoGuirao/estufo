import type { VideoLessonAnswer, VideoLessonQuizCache } from "@/types/video-lessons";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/device-id";

const QUIZ_KEY = "estufoo.video-lesson-quiz.v1";
const ANS_KEY = "estufoo.video-lesson-answers.v1";

function readQuiz(): Record<string, VideoLessonQuizCache> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(QUIZ_KEY) || "{}") as Record<string, VideoLessonQuizCache>;
  } catch {
    return {};
  }
}

function writeQuiz(bag: Record<string, VideoLessonQuizCache>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(bag));
  } catch {
    /* ignore */
  }
}

function readAnswers(): VideoLessonAnswer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(ANS_KEY) || "[]") as VideoLessonAnswer[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAnswers(rows: VideoLessonAnswer[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANS_KEY, JSON.stringify(rows.slice(-2000)));
  } catch {
    /* ignore */
  }
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const sb = requireSupabase();
      await sb.from("user_video_lesson_answers").upsert(
        {
          device_id: getDeviceId(),
          payload: rows.slice(-2000),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    } catch (err) {
      console.warn("[video-answers] sync falhou", err);
    }
  })();
}

export const videoLessonQuizStore = {
  getQuiz(lessonId: string): VideoLessonQuizCache | null {
    return readQuiz()[lessonId] ?? null;
  },
  setQuiz(entry: VideoLessonQuizCache): void {
    const bag = readQuiz();
    bag[entry.lessonId] = entry;
    writeQuiz(bag);
    if (!isSupabaseConfigured) return;
    void (async () => {
      try {
        const sb = requireSupabase();
        const deviceId = getDeviceId();
        await sb.from("user_video_lesson_quiz").upsert(
          {
            id: `${deviceId}:${entry.lessonId}`,
            device_id: deviceId,
            lesson_id: entry.lessonId,
            payload: entry,
            updated_at: entry.savedAt,
          },
          { onConflict: "id" },
        );
      } catch (err) {
        console.warn("[video-quiz] sync falhou", err);
      }
    })();
  },
  answersForLesson(lessonId: string): VideoLessonAnswer[] {
    return readAnswers().filter((a) => a.lessonId === lessonId);
  },
  allAnswers(): VideoLessonAnswer[] {
    return readAnswers();
  },
  recordAnswer(a: VideoLessonAnswer): void {
    const rows = readAnswers().filter(
      (x) => !(x.lessonId === a.lessonId && x.questionId === a.questionId),
    );
    rows.push(a);
    writeAnswers(rows);
  },
  async hydrate(): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const sb = requireSupabase();
      const deviceId = getDeviceId();
      if (!Object.keys(readQuiz()).length) {
        const { data } = await sb
          .from("user_video_lesson_quiz")
          .select("payload")
          .eq("device_id", deviceId);
        const bag: Record<string, VideoLessonQuizCache> = {};
        for (const row of data ?? []) {
          const p = row.payload as VideoLessonQuizCache;
          if (p?.lessonId) bag[p.lessonId] = p;
        }
        if (Object.keys(bag).length) writeQuiz(bag);
      }
      if (!readAnswers().length) {
        const { data } = await sb
          .from("user_video_lesson_answers")
          .select("payload")
          .eq("device_id", deviceId)
          .maybeSingle();
        const remote = data?.payload as VideoLessonAnswer[] | undefined;
        if (Array.isArray(remote) && remote.length) writeAnswers(remote);
      }
    } catch (err) {
      console.warn("[video-quiz] hydrate falhou", err);
    }
  },
};

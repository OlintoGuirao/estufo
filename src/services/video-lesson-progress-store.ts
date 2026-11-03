import type { VideoLessonProgress } from "@/types/video-lessons";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getDeviceId } from "@/lib/device-id";

const KEY = "estufoo.video-lesson-progress.v1";

function read(): Record<string, VideoLessonProgress> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, VideoLessonProgress>;
  } catch {
    return {};
  }
}

function writeLocal(bag: Record<string, VideoLessonProgress>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    /* ignore */
  }
}

function syncRemote(bag: Record<string, VideoLessonProgress>) {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const sb = requireSupabase();
      await sb.from("user_video_lesson_progress").upsert(
        {
          device_id: getDeviceId(),
          payload: bag,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    } catch (err) {
      console.warn("[video-progress] sync falhou", err);
    }
  })();
}

export const videoLessonProgressStore = {
  get(lessonId: string): VideoLessonProgress | null {
    return read()[lessonId] ?? null;
  },
  all(): Record<string, VideoLessonProgress> {
    return read();
  },
  save(partial: Omit<VideoLessonProgress, "updatedAt"> & { updatedAt?: string }): VideoLessonProgress {
    const bag = read();
    const prev = bag[partial.lessonId];
    const next: VideoLessonProgress = {
      ...prev,
      ...partial,
      subjectName: partial.subjectName ?? prev?.subjectName,
      lessonTitle: partial.lessonTitle ?? prev?.lessonTitle,
      lessonOrder: partial.lessonOrder ?? prev?.lessonOrder,
      updatedAt: partial.updatedAt ?? new Date().toISOString(),
    };
    bag[partial.lessonId] = next;
    writeLocal(bag);
    syncRemote(bag);
    return next;
  },

  /** Última aula em andamento (não concluída) para o card do painel. */
  getResumePoint(bag?: Record<string, VideoLessonProgress>): VideoLessonProgress | null {
    const all = Object.values(bag ?? read());
    const inProgress = all
      .filter((p) => !p.completed && p.currentTime >= 1)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return inProgress[0] ?? null;
  },

  async hydrate(): Promise<Record<string, VideoLessonProgress>> {
    const local = read();
    const hasLocal = Object.keys(local).length > 0;
    if (hasLocal || !isSupabaseConfigured) {
      if (hasLocal) syncRemote(local);
      return local;
    }
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("user_video_lesson_progress")
        .select("payload")
        .eq("device_id", getDeviceId())
        .maybeSingle();
      if (error) throw error;
      const remote = (data?.payload ?? {}) as Record<string, VideoLessonProgress>;
      if (remote && typeof remote === "object" && Object.keys(remote).length) {
        writeLocal(remote);
        return remote;
      }
    } catch (err) {
      console.warn("[video-progress] hydrate falhou", err);
    }
    return local;
  },
};

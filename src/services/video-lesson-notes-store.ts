import type { VideoLessonNote } from "@/types/video-lessons";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";
import { getStudyOwnerId, studyOwnerQueryIds } from "@/lib/study-owner";

const KEY = "estufoo.video-lesson-notes.v1";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `note_${Date.now().toString(36)}`;
}

function read(): VideoLessonNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as VideoLessonNote[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLocal(notes: VideoLessonNote[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* ignore */
  }
}

function syncRemote(notes: VideoLessonNote[]) {
  if (!isSupabaseConfigured) return;
  void (async () => {
    try {
      const sb = requireSupabase();
      const deviceId = getStudyOwnerId();
      const rows = notes.map((n) => ({
        id: n.id,
        device_id: deviceId,
        lesson_id: n.lessonId,
        payload: n,
        updated_at: n.updatedAt,
        created_at: n.createdAt,
      }));
      if (!rows.length) return;
      await sb.from("user_video_lesson_notes").upsert(rows, { onConflict: "id" });
    } catch (err) {
      console.warn("[video-notes] sync falhou", err);
    }
  })();
}

export const videoLessonNotesStore = {
  list(): VideoLessonNote[] {
    return [...read()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  listByLesson(lessonId: string): VideoLessonNote[] {
    return this.list().filter((n) => n.lessonId === lessonId);
  },
  save(input: {
    id?: string;
    lessonId: string;
    subjectId: string;
    subjectName: string;
    lessonTitle: string;
    title: string;
    body: string;
  }): VideoLessonNote {
    const title = input.title.trim();
    if (!title) throw new Error("O título da anotação é obrigatório.");
    const notes = read();
    const now = new Date().toISOString();
    const existing = input.id ? notes.find((n) => n.id === input.id) : undefined;
    const note: VideoLessonNote = {
      id: existing?.id ?? uid(),
      lessonId: input.lessonId,
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      lessonTitle: input.lessonTitle,
      title,
      body: input.body,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = existing
      ? notes.map((n) => (n.id === existing.id ? note : n))
      : [note, ...notes];
    writeLocal(next);
    syncRemote([note]);
    return note;
  },
  remove(id: string): void {
    const next = read().filter((n) => n.id !== id);
    writeLocal(next);
    if (!isSupabaseConfigured) return;
    void (async () => {
      try {
        const sb = requireSupabase();
        await sb.from("user_video_lesson_notes").delete().eq("id", id).in("device_id", studyOwnerQueryIds());
      } catch {
        /* ignore */
      }
    })();
  },
  async hydrate(): Promise<VideoLessonNote[]> {
    const local = read();
    if (local.length || !isSupabaseConfigured) return this.list();
    try {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("user_video_lesson_notes")
        .select("payload")
        .in("device_id", studyOwnerQueryIds())
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const remote = (data ?? []).map((r) => r.payload as VideoLessonNote).filter(Boolean);
      if (remote.length) {
        writeLocal(remote);
        return this.list();
      }
    } catch (err) {
      console.warn("[video-notes] hydrate falhou", err);
    }
    return this.list();
  },
};

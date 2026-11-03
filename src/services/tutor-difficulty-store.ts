import type { TutorDifficultyCode } from "@/lib/tutor/types";

const KEY = "estufoo.tutor-difficulties";

export type TutorDifficultyRecord = {
  id: string;
  subject: string;
  topic: string;
  code: TutorDifficultyCode;
  note?: string;
  questionId?: string;
  at: string;
};

function read(): TutorDifficultyRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as TutorDifficultyRecord[];
  } catch {
    return [];
  }
}

function write(rows: TutorDifficultyRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-300)));
}

export const tutorDifficultyStore = {
  list: () => read(),
  add: (row: Omit<TutorDifficultyRecord, "id" | "at"> & { at?: string }) => {
    const next: TutorDifficultyRecord = {
      id: Math.random().toString(36).slice(2, 10),
      subject: row.subject,
      topic: row.topic,
      code: row.code,
      at: row.at ?? new Date().toISOString(),
      ...(row.note ? { note: row.note } : {}),
      ...(row.questionId ? { questionId: row.questionId } : {}),
    };
    const all = read();
    all.push(next);
    write(all);
    return next;
  },
};

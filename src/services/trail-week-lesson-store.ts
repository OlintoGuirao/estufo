import type { TrailWeekLesson } from "@/types/trail-week-lesson";
import { approvalTrailDb, syncTrailLesson, syncTrailLessonNow } from "./approval-trail-db";

const KEY = "estufoo.trail-week-lessons.v2";

type Bag = Record<string, TrailWeekLesson>;

function lessonKey(trailId: string, week: number): string {
  return `${trailId}::${week}`;
}

let memory: Bag = {};

function read(): Bag {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory;
    return { ...memory, ...(JSON.parse(raw) as Bag) };
  } catch {
    return memory;
  }
}

function write(bag: Bag): void {
  memory = bag;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    /* quota */
  }
}

export const trailWeekLessonStore = {
  get(trailId: string, week: number): TrailWeekLesson | null {
    return read()[lessonKey(trailId, week)] ?? null;
  },
  save(lesson: TrailWeekLesson): TrailWeekLesson {
    const bag = read();
    bag[lessonKey(lesson.trailId, lesson.week)] = lesson;
    write(bag);
    syncTrailLesson(lesson);
    return lesson;
  },

  async saveNow(lesson: TrailWeekLesson): Promise<TrailWeekLesson> {
    const bag = read();
    bag[lessonKey(lesson.trailId, lesson.week)] = lesson;
    write(bag);
    try {
      await syncTrailLessonNow(lesson);
    } catch (err) {
      console.warn("[trail-week-lesson] sync imediato falhou", err);
    }
    return lesson;
  },
  clearTrail(trailId: string): void {
    const bag = read();
    for (const k of Object.keys(bag)) {
      if (k.startsWith(`${trailId}::`)) delete bag[k];
    }
    write(bag);
    void approvalTrailDb.deleteLessonsForTrail(trailId).catch(() => {});
  },

  async hydrate(trailId: string, week: number): Promise<TrailWeekLesson | null> {
    const local = trailWeekLessonStore.get(trailId, week);
    if (local?.modules?.length) {
      syncTrailLesson(local);
      return local;
    }
    try {
      const remote = await approvalTrailDb.loadLesson(trailId, week);
      if (remote?.modules?.length) {
        const bag = read();
        bag[lessonKey(trailId, week)] = remote;
        write(bag);
        return remote;
      }
    } catch (err) {
      console.warn("[trail-week-lesson] hydrate falhou", err);
    }
    return local;
  },
};

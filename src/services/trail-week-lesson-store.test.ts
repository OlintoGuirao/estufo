import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLesson = vi.fn();
vi.mock("./approval-trail-db", () => ({
  approvalTrailDb: { loadLesson: (...a: unknown[]) => loadLesson(...a), deleteLessonsForTrail: vi.fn(async () => {}) },
  syncTrailLesson: vi.fn(),
  syncTrailLessonNow: vi.fn(async () => {}),
}));

const lesson = (week: number) =>
  ({
    trailId: "trail_x",
    week,
    title: "Aula",
    objective: "",
    professorIntro: "",
    modules: [{ id: "m1", kind: "teoria", title: "Definição", body: "x", minutesSuggested: 10 }],
    warnings: [],
    mocked: false,
    createdAt: "2026-11-01T00:00:00.000Z",
  }) as never;

describe("trailWeekLessonStore", () => {
  beforeEach(() => {
    vi.resetModules();
    loadLesson.mockReset();
    localStorage.clear();
  });

  it("aula salva é reaproveitada (não gera de novo)", async () => {
    const { trailWeekLessonStore } = await import("./trail-week-lesson-store");
    await trailWeekLessonStore.saveNow(lesson(1));
    const got = await trailWeekLessonStore.hydrate("trail_x", 1);
    expect(got?.modules.length).toBe(1);
    expect(loadLesson).not.toHaveBeenCalled();
  });

  it("sem cópia local, busca no banco", async () => {
    loadLesson.mockResolvedValue(lesson(2));
    const { trailWeekLessonStore } = await import("./trail-week-lesson-store");
    const got = await trailWeekLessonStore.hydrate("trail_x", 2);
    expect(got?.week).toBe(2);
    expect(loadLesson).toHaveBeenCalledWith("trail_x", 2);
  });

  it("migra o formato antigo do localStorage", async () => {
    localStorage.setItem("estufoo.trail-week-lessons.v2", JSON.stringify({ "trail_x::3": lesson(3) }));
    const { trailWeekLessonStore } = await import("./trail-week-lesson-store");
    const got = await trailWeekLessonStore.hydrate("trail_x", 3);
    expect(got?.week).toBe(3);
    expect(loadLesson).not.toHaveBeenCalled();
  });

  it("guarda no aparelho só as últimas 5 aulas já salvas no banco", async () => {
    const { trailWeekLessonStore } = await import("./trail-week-lesson-store");
    for (let w = 1; w <= 8; w++) await trailWeekLessonStore.saveNow(lesson(w));
    expect(trailWeekLessonStore.listLocal("trail_x").length).toBeLessThanOrEqual(5);
    // a mais recente continua no aparelho
    expect(trailWeekLessonStore.get("trail_x", 8)).not.toBeNull();
  });
});

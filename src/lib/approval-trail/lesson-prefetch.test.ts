import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const ensureLesson = vi.fn(async (week: number) => ({ week, modules: [{ id: "m" }] }));
vi.mock("@/services/trail-week-lesson.service", () => ({
  trailWeekLessonService: {
    ensureLesson: (w: number) => ensureLesson(w),
    getCached: () => null,
  },
}));

import { prefetchUpcomingLessons } from "./lesson-prefetch";

const trail = {
  id: "t1",
  weeks: [1, 2, 3, 4, 5].map((week) => ({ week })),
} as never;

describe("prepara as próximas aulas em segundo plano", () => {
  it("gera só os próximos 2 dias, um de cada vez, na chave da tela", async () => {
    const qc = new QueryClient();
    prefetchUpcomingLessons(qc, trail, 2, { ahead: 2, delayMs: 0 });
    await vi.waitFor(() => expect(ensureLesson).toHaveBeenCalledTimes(2));
    expect(ensureLesson.mock.calls.map((c) => c[0])).toEqual([3, 4]);
    await vi.waitFor(() => expect(qc.getQueryData(["trail-week-lesson", "t1", 4])).toBeTruthy());
  });
});

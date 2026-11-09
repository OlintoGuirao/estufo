import { describe, expect, it } from "vitest";
import type { ApprovalTrail, TrailWeek } from "@/types/approval-trail";
import type { StudySchedule } from "@/types/study-schedule";
import {
  buildSessionDateMap,
  buildTodayTasks,
  dateKey,
  planStartDate,
  weekdayLabelFromDate,
} from "./study-calendar";

function session(partial: Partial<TrailWeek> & Pick<TrailWeek, "week" | "weekday" | "dayLabel">): TrailWeek {
  return {
    focus: `Foco ${partial.week}`,
    subjectNames: ["Português"],
    hoursSuggested: 2,
    activities: [],
    weekNumber: 1,
    ...partial,
  };
}

function trail(createdAt: string, weeks: TrailWeek[]): ApprovalTrail {
  return {
    id: "t1",
    createdAt,
    updatedAt: createdAt,
    fileName: "edital.pdf",
    contestName: "TJSP",
    organ: "TJSP",
    role: "Escrevente",
    board: "VUNESP",
    examDate: null,
    summary: "",
    subjects: [],
    weeks,
    warnings: [],
    sourceTextChars: 0,
    mocked: true,
    scheduleUnlocked: true,
  };
}

const schedule: StudySchedule = {
  studyDays: [1, 2, 3, 4, 5],
  redacaoDays: [],
  examDays: [],
  updatedAt: new Date().toISOString(),
};

describe("study-calendar dias", () => {
  it("rotula o dia civil correto (quarta ≠ terça)", () => {
    // Quarta-feira 4/nov/2026
    const wed = new Date(2026, 10, 4);
    expect(wed.getDay()).toBe(3);
    expect(weekdayLabelFromDate(wed)).toBe("Quarta");
  });

  it("agenda sessões em sequência a partir do 1º dia de estudo (sem deslocar rótulo)", () => {
    // Trilha criada na terça 3/nov/2026 → planStart = terça
    const created = new Date(2026, 10, 3, 12, 0, 0).toISOString();
    const weeks = [
      session({ week: 1, weekday: 1, dayLabel: "Segunda" }),
      session({ week: 2, weekday: 2, dayLabel: "Terça" }),
      session({ week: 3, weekday: 3, dayLabel: "Quarta" }),
    ];
    const t = trail(created, weeks);
    const start = planStartDate(t, schedule.studyDays);
    expect(start.getDay()).toBe(2); // terça
    expect(dateKey(start)).toBe("2026-11-03");

    const map = buildSessionDateMap(t, schedule.studyDays);
    // 1ª sessão cai na terça (início), 2ª na quarta, 3ª na quinta — ordem real.
    expect(map.get("2026-11-03")?.week).toBe(1);
    expect(map.get("2026-11-04")?.week).toBe(2);
    expect(map.get("2026-11-05")?.week).toBe(3);

    const tasks = buildTodayTasks({
      today: new Date(2026, 10, 4),
      trail: t,
      schedule,
      progressByWeek: new Map(),
    });
    const todayTask = tasks.find((x) => x.tone === "today");
    expect(todayTask?.title).toBe("Hoje · Quarta");
    const overdue = tasks.find((x) => x.tone === "overdue");
    expect(overdue?.title).toBe("Em atraso · Terça");
  });

  it("dia de hoje concluído aparece como concluído (verde), não como pendente", () => {
    const created = new Date(2026, 10, 3, 12, 0, 0).toISOString();
    const t = trail(created, [
      session({ week: 1, weekday: 1, dayLabel: "Segunda" }),
      session({ week: 2, weekday: 2, dayLabel: "Terça" }),
    ]);
    const tasks = buildTodayTasks({
      today: new Date(2026, 10, 3),
      trail: t,
      schedule,
      progressByWeek: new Map([
        [
          1,
          {
            trailId: "t1",
            week: 1,
            status: "concluida",
            activeModuleId: null,
            completedModuleIds: [],
            practiceAnswers: {},
            chat: [],
            updatedAt: created,
          },
        ],
      ]),
    });
    const today = tasks.find((x) => x.id === "today-1");
    expect(today?.tone).toBe("done");
    expect(today?.title).toBe("Hoje · Terça (concluído)");
  });
});

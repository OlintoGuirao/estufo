import { describe, expect, it } from "vitest";
import { getTrailStudySnapshotForSimulado } from "./studied-for-simulado";
import type { ApprovalTrail } from "@/types/approval-trail";
import type { TrailWeekProgress } from "@/types/trail-progress";

function trail(): ApprovalTrail {
  return {
    id: "t1",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    fileName: "edital.pdf",
    contestName: "TJSP",
    organ: "TJSP",
    role: "Escrevente",
    board: "Vunesp",
    examDate: null,
    summary: "",
    subjects: [
      {
        id: "s1",
        name: "Português",
        questionCountHint: null,
        order: 0,
        topics: [
          { id: "tp1", name: "Interpretação", weightHint: "alta", notes: "", status: "concluida" },
        ],
      },
      {
        id: "s2",
        name: "Direito Penal",
        questionCountHint: null,
        order: 1,
        topics: [
          { id: "tp2", name: "Crime", weightHint: "alta", notes: "", status: "concluida" },
        ],
      },
    ],
    weeks: [
      {
        week: 1,
        weekNumber: 1,
        dayLabel: "Segunda",
        focus: "Português",
        subjectNames: ["Português"],
        hoursSuggested: 2,
        activities: [],
        topicIds: ["tp1"],
      },
    ],
    warnings: [],
    sourceTextChars: 0,
    mocked: false,
    scheduleUnlocked: true,
  };
}

describe("getTrailStudySnapshotForSimulado", () => {
  it("usa só as matérias da semana concluída (Português)", () => {
    const progress: TrailWeekProgress[] = [
      {
        trailId: "t1",
        week: 1,
        status: "concluida",
        activeModuleId: null,
        completedModuleIds: [],
        practiceAnswers: {},
        chat: [],
        updatedAt: "2026-01-02",
      },
    ];
    const snap = getTrailStudySnapshotForSimulado(trail(), progress);
    expect(snap?.subjects).toEqual(["Português"]);
    expect(snap?.weekNumber).toBe(1);
  });
  it("ignora a próxima semana só aberta (em andamento sem estudo)", () => {
    const t = trail();
    t.weeks.push({
      week: 6,
      weekNumber: 2,
      dayLabel: "Segunda",
      focus: "Direito Penal",
      subjectNames: ["Direito Penal"],
      hoursSuggested: 2,
      activities: [],
      topicIds: ["tp2"],
    });
    const base = {
      trailId: "t1",
      activeModuleId: null,
      completedModuleIds: [] as string[],
      practiceAnswers: {},
      chat: [],
      updatedAt: "2026-01-02",
    };
    const progress: TrailWeekProgress[] = [
      { ...base, week: 1, status: "concluida" },
      { ...base, week: 6, status: "em-andamento", activeModuleId: "m1" },
    ];
    const snap = getTrailStudySnapshotForSimulado(t, progress);
    expect(snap?.weekNumber).toBe(1);
    expect(snap?.subjects).toEqual(["Português"]);
  });
});

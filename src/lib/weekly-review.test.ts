import { describe, expect, it } from "vitest";
import {
  buildWeeklyReviewBundle,
  subjectsForWeeklyReinforce,
} from "./weekly-review";
import type { ErrorNote, StudySession } from "@/types";

function note(partial: Partial<ErrorNote> & Pick<ErrorNote, "id" | "subject">): ErrorNote {
  return {
    questionId: "q1",
    topic: "t",
    statement: "enunciado",
    yourKey: "A",
    correctKey: "B",
    explanation: "",
    reasonCode: "nao-sabia",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("subjectsForWeeklyReinforce", () => {
  it("une matérias dos erros e das sessões sem duplicar", () => {
    const sessions: StudySession[] = [
      {
        id: "s1",
        date: new Date().toISOString().slice(0, 10),
        subject: "Português",
        topic: "Crase",
        activity: "teoria",
        durationMin: 30,
        priority: "media",
        status: "concluida",
      },
    ];
    const bundle = buildWeeklyReviewBundle({
      errorNotes: [
        note({ id: "n1", subject: "Português" }),
        note({ id: "n2", subject: "Direito Constitucional" }),
      ],
      sessions,
    });
    const subjects = subjectsForWeeklyReinforce(bundle);
    expect(subjects).toContain("Português");
    expect(subjects).toContain("Direito Constitucional");
    expect(new Set(subjects).size).toBe(subjects.length);
  });
});

import { describe, expect, it } from "vitest";
import { analyzeDiagnostic, focusesToSchedule } from "./study-plan-diagnostic";

describe("analyzeDiagnostic", () => {
  it("marca recorrente só com ≥2 erros no tópico", () => {
    const a = analyzeDiagnostic([
      { questionId: "1", subject: "Português", topic: "Crase", choice: "A", correctKey: "C", correct: false },
      { questionId: "2", subject: "Português", topic: "Crase", choice: "B", correctKey: "C", correct: false },
      { questionId: "3", subject: "Português", topic: "Concordância", choice: "A", correctKey: "D", correct: false },
      { questionId: "4", subject: "RLM", topic: "Probabilidade", choice: "C", correctKey: "C", correct: true },
    ]);
    expect(a.wrong).toBe(3);
    expect(a.focuses).toHaveLength(1);
    expect(a.focuses[0]!.topic).toBe("Crase");
    expect(a.focuses[0]!.recurring).toBe(true);
    expect(a.singleErrorTopics.some((t) => t.topic === "Concordância")).toBe(true);
  });

  it("sem recorrentes, agenda singles no topo", () => {
    const a = analyzeDiagnostic([
      { questionId: "1", subject: "A", topic: "T1", choice: "A", correctKey: "B", correct: false },
      { questionId: "2", subject: "B", topic: "T2", choice: "A", correctKey: "B", correct: false },
    ]);
    expect(a.focuses).toHaveLength(0);
    expect(focusesToSchedule(a)).toHaveLength(2);
  });
});

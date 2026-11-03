import { describe, expect, it } from "vitest";
import {
  mockVideoLessonQuiz,
  parseVideoLessonQuizJson,
  mockWrongApproach,
} from "./ai-quiz";

describe("video lesson ai quiz", () => {
  it("mock gera pelo menos 8 questões A–E", () => {
    const q = mockVideoLessonQuiz({
      lessonId: "portugues__001",
      subjectName: "Portugues",
      lessonTitle: "Fonética",
      count: 8,
    });
    expect(q.questions).toHaveLength(8);
    expect(q.questions[0]!.alternatives.map((a) => a.key)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("parser aceita JSON válido e completa com mock se faltar questões", () => {
    const parsed = parseVideoLessonQuizJson(
      JSON.stringify({
        questions: [
          {
            id: "1",
            statement: "Qual é a regra principal de acentuação neste contexto?",
            alternatives: [
              { key: "A", text: "a" },
              { key: "B", text: "b" },
              { key: "C", text: "c" },
              { key: "D", text: "d" },
              { key: "E", text: "e" },
            ],
            correctKey: "C",
            explanation: "C",
            topic: "Acentuação",
          },
        ],
      }),
      {
        lessonId: "x",
        subjectName: "Portugues",
        lessonTitle: "Acentuação",
        count: 8,
      },
    );
    expect(parsed.questions.length).toBeGreaterThanOrEqual(8);
  });

  it("dica de erro não cita gabarito literal", () => {
    const tip = mockWrongApproach("A");
    expect(tip.toLowerCase()).not.toContain("resposta é");
    expect(tip.length).toBeGreaterThan(40);
  });
});

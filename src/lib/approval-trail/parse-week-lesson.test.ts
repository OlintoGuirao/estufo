import { describe, expect, it } from "vitest";
import { buildWeekLessonFromAiText } from "./parse-week-lesson";

describe("buildWeekLessonFromAiText (modular)", () => {
  it("aceita modules do professor", () => {
    const lesson = buildWeekLessonFromAiText(
      JSON.stringify({
        title: "Semana 1",
        objective: "Aprender",
        professorIntro: "Oi, sou seu professor.",
        modules: [
          { kind: "abertura", title: "Olá", body: "Vamos começar." },
          {
            kind: "teoria",
            title: "Conceito",
            definition: "Definição do assunto.",
            mnemonic: "Macete curto.",
            example: "Exemplo de uso.",
            questions: [
              {
                statement: "Mem 1?",
                alternatives: [
                  { key: "A", text: "a" },
                  { key: "B", text: "b" },
                  { key: "C", text: "c" },
                  { key: "D", text: "d" },
                ],
                correctKey: "B",
                explanation: "porque B",
                legalBasis: "edital",
              },
            ],
          },
          {
            kind: "pratica",
            title: "Questões",
            body: "Pratique.",
            questions: [
              {
                statement: "Pergunta?",
                alternatives: [
                  { key: "A", text: "a" },
                  { key: "B", text: "b" },
                  { key: "C", text: "c" },
                  { key: "D", text: "d" },
                ],
                correctKey: "B",
                explanation: "porque B",
                legalBasis: "edital",
              },
            ],
          },
        ],
        warnings: [],
      }),
      { trailId: "t1", week: 1, mocked: false },
    );
    expect(lesson.professorIntro).toMatch(/professor/i);
    expect(lesson.modules.length).toBe(3);
    expect(lesson.modules[1]!.definition).toMatch(/Definição/i);
    expect(lesson.modules[1]!.minutesSuggested).toBeGreaterThan(0);
    const memQ = lesson.modules[1]!.questions?.[0];
    const pratQ = lesson.modules[2]!.questions?.[0];
    expect(memQ).toBeTruthy();
    expect(pratQ).toBeTruthy();
    // Gabarito pode ter sido remapeado (anti-vício), mas o texto correto permanece.
    expect(memQ!.alternatives.find((a) => a.key === memQ!.correctKey)?.text).toBe("b");
    expect(pratQ!.alternatives.find((a) => a.key === pratQ!.correctKey)?.text).toBe("b");
  });
});

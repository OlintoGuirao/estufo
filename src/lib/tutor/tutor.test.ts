import { describe, expect, it } from "vitest";
import { buildTipMessages, collectTipForbiddenTokens } from "./prompts";
import {
  tipLooksLikeAnswerReveal,
  parsePracticeQuestionJson,
  hidePracticeAnswer,
} from "./validate";
import { buildTutorAdvice, isRecurringDifficulty } from "./recommendations";

describe("dicas sem gabarito no prompt", () => {
  it("não inclui correctKey nem explanation no payload enviado ao modelo", () => {
    const messages = buildTipMessages({
      statement: "Qual é a regra da crase?",
      alternatives: [
        { key: "A", text: "Opção A" },
        { key: "B", text: "Opção B" },
        { key: "C", text: "Opção C" },
      ],
      studentChoice: "A",
      subject: "Português",
      topic: "Crase",
    });
    const blob = JSON.stringify(messages);
    // Instruções do system podem mencionar a palavra "gabarito" (para proibir revelar).
    // O que não pode existir é o valor do gabarito / campo correctKey / explicação oficial.
    expect(blob).not.toContain("correctKey");
    expect(blob).not.toMatch(/"correctKey"\s*:/);
    expect(blob).toContain("Opção A");
    expect(blob).not.toContain("Explicação oficial que não deve ir");
    expect(collectTipForbiddenTokens({ explanation: "Explicação secreta longa demais" })).toContain(
      "Explicação secreta longa demais",
    );
  });

  it("detecta dicas que revelam a letra", () => {
    expect(tipLooksLikeAnswerReveal("A resposta correta é B", "B")).toBe(true);
    expect(tipLooksLikeAnswerReveal("Marque a letra C", "C")).toBe(true);
    expect(tipLooksLikeAnswerReveal("Relia o enunciado e elimine extremos.", "B")).toBe(false);
  });
});

describe("questões geradas por IA", () => {
  it("marca como IA e oculta gabarito na versão pública", () => {
    const q = parsePracticeQuestionJson(
      JSON.stringify({
        statement: "Enunciado suficientemente longo para treino do conceito principal.",
        alternatives: [
          { key: "A", text: "um" },
          { key: "B", text: "dois" },
          { key: "C", text: "três" },
          { key: "D", text: "quatro" },
          { key: "E", text: "cinco" },
        ],
        correctKey: "B",
        explanation: "Porque B aplica a regra.",
      }),
      { subject: "X", topic: "Y" },
    );
    expect(q.aiGenerated).toBe(true);
    const pub = hidePracticeAnswer(q);
    expect(pub.label).toMatch(/Gerada por IA/i);
    expect(pub).not.toHaveProperty("correctKey");
    expect(pub).not.toHaveProperty("explanation");
  });
});

describe("diagnóstico de dificuldades", () => {
  it("não trata um único erro como recorrente", () => {
    const events = [
      { subject: "Português", topic: "Crase", code: "confundiu" as const, at: "2026-01-01" },
    ];
    expect(isRecurringDifficulty(events, "Português", "Crase", "confundiu")).toBe(false);
    const advice = buildTutorAdvice({
      wrongByTopic: [{ subject: "Português", topic: "Crase", wrongCount: 1 }],
      difficultyEvents: events,
      overdueReviews: [],
      lateSessionsCount: 0,
    });
    expect(advice.some((a) => a.title.includes("Crase") && a.kind === "errors")).toBe(false);
    expect(advice[0]?.provisional || advice[0]?.title.includes("poucos dados")).toBeTruthy();
  });

  it("recomendações trazem evidências", () => {
    const advice = buildTutorAdvice({
      wrongByTopic: [{ subject: "Português", topic: "Crase", wrongCount: 3 }],
      difficultyEvents: [
        { subject: "Português", topic: "Crase", code: "confundiu", at: "a" },
        { subject: "Português", topic: "Crase", code: "confundiu", at: "b" },
      ],
      overdueReviews: [{ subject: "RL", topic: "Probabilidade", dueDate: "2026-01-01" }],
      lateSessionsCount: 2,
    });
    for (const item of advice) {
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });
});

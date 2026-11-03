import { describe, expect, it } from "vitest";
import {
  mockAiQuestions,
  parseAiQuestionsJson,
} from "./ai-questions";
import type { StudyPackAi } from "@/lib/tutor/study-pack";

const pack: StudyPackAi = {
  summary: "t",
  centralTitle: "Fé pública",
  nodes: [
    {
      tempId: "a293",
      title: "Art. 293 CP",
      kind: "artigo",
      summary: "Falsificação de papéis públicos",
      keywords: ["Art. 293"],
      parentTempId: "faixa",
    },
    {
      tempId: "e293",
      title: "Falsificação",
      kind: "explicacao",
      summary: "Falsificar papéis públicos. Pena: reclusão de 2 a 8 anos.",
      keywords: ["Art. 293"],
      parentTempId: "a293",
    },
  ],
  links: [],
  flashcards: [
    { front: "q", back: "r", topic: "t", tags: [], nodeId: null },
    { front: "q2", back: "r2", topic: "t", tags: [], nodeId: null },
  ],
  warnings: [],
};

describe("parseAiQuestionsJson", () => {
  it("aceita questões A–E com gabarito", () => {
    const qs = parseAiQuestionsJson(
      JSON.stringify({
        questions: [
          {
            statement: "Sobre o Art. 293 do CP, assinale a correta:",
            alternatives: [
              { key: "A", text: "Falsificação de papéis públicos" },
              { key: "B", text: "Peculato" },
              { key: "C", text: "Concussão" },
              { key: "D", text: "Desacato" },
              { key: "E", text: "Prevaricação" },
            ],
            correctKey: "A",
            explanation: "O Art. 293 tipifica falsificação de papéis públicos.",
            topic: "Art. 293",
            nodeId: "a293",
          },
        ],
      }),
    );
    expect(qs).toHaveLength(1);
    expect(qs[0]!.correctKey).toBe("A");
    expect(qs[0]!.alternatives).toHaveLength(5);
  });

  it("rejeita item sem alternativas suficientes", () => {
    const qs = parseAiQuestionsJson(
      JSON.stringify({
        questions: [
          {
            statement: "Pergunta curta demais? Não — tem tamanho ok aqui.",
            alternatives: [
              { key: "A", text: "Só uma" },
              { key: "B", text: "Duas" },
            ],
            correctKey: "A",
            explanation: "x",
            topic: "t",
          },
        ],
      }),
    );
    expect(qs).toHaveLength(0);
  });
});

describe("mockAiQuestions", () => {
  it("gera pelo menos uma questão a partir dos arts", () => {
    const qs = mockAiQuestions(pack);
    expect(qs.length).toBeGreaterThanOrEqual(1);
    expect(qs[0]!.alternatives.length).toBe(5);
  });
});

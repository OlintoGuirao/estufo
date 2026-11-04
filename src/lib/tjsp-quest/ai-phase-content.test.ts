import { describe, expect, it } from "vitest";
import {
  mockQuestPhaseAiContent,
  parseQuestPhaseAiJson,
} from "./ai-phase-content";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";

describe("parseQuestPhaseAiJson", () => {
  it("exige 5 alternativas estilo VUNESP", () => {
    const raw = JSON.stringify({
      lessonBlocks: [
        { id: "b1", kind: "contexto", title: "Ctx", body: "Por que o tema existe no edital TJSP.", required: true },
        { id: "b2", kind: "explicacao", title: "Exp", body: "Explicação simples do conceito central da fase.", required: true },
        { id: "b3", kind: "base-legal", title: "Base", body: "CP arts. indicados no edital.", required: true },
        { id: "b4", kind: "traducao", title: "Trad", body: "Tradução prática do tipo penal.", required: true },
        { id: "b5", kind: "exemplo", title: "Ex", body: "Exemplo cotidiano aplicável.", required: true },
        { id: "b6", kind: "prova", title: "Prova", body: "Pegadinha clássica VUNESP.", required: true },
        { id: "b7", kind: "memorizar", title: "Memo", body: "Resumo curto para memorizar.", required: true },
        { id: "b8", kind: "mini-revisao", title: "Mini", body: "Perguntas rápidas de revisão.", required: false },
      ],
      questions: [
        {
          id: "q1",
          statement: "Acerca do tema, assinale a alternativa correta.",
          alternatives: [
            { key: "A", text: "Correta" },
            { key: "B", text: "Errada 1" },
            { key: "C", text: "Errada 2" },
            { key: "D", text: "Errada 3" },
            { key: "E", text: "Errada 4" },
          ],
          correctKey: "A",
          legalBasis: "CP",
          whyCorrect: "A espelha a regra.",
          whyWrong: { B: "Confunde", C: "Exagera", D: "Inverte", E: "Outro ramo" },
          difficulty: "media",
        },
        {
          id: "q2",
          statement: "No padrão VUNESP sobre o mesmo tema, é correto afirmar:",
          alternatives: [
            { key: "A", text: "Opção A genérica" },
            { key: "B", text: "Opção B genérica" },
            { key: "C", text: "Opção C correta" },
            { key: "D", text: "Opção D genérica" },
            { key: "E", text: "Opção E genérica" },
          ],
          correctKey: "C",
          legalBasis: "Edital",
          whyCorrect: "C.",
          whyWrong: {},
          difficulty: "facil",
        },
        {
          id: "q3",
          statement: "Em relação ao instituto cobrado, assinale a correta.",
          alternatives: [
            { key: "A", text: "Alternativa A" },
            { key: "B", text: "Alternativa B" },
            { key: "C", text: "Alternativa C" },
            { key: "D", text: "Alternativa D" },
            { key: "E", text: "Alternativa E" },
          ],
          correctKey: "E",
          legalBasis: "Lei",
          whyCorrect: "E.",
          whyWrong: {},
          difficulty: "dificil",
        },
      ],
      bossQuestions: [
        {
          id: "boss1",
          statement: "Chefão — análise avançada. Assinale a alternativa correta.",
          alternatives: [
            { key: "A", text: "Alternativa A" },
            { key: "B", text: "Alternativa B" },
            { key: "C", text: "Alternativa C" },
            { key: "D", text: "Alternativa D" },
            { key: "E", text: "Alternativa E" },
          ],
          correctKey: "B",
          legalBasis: "CP",
          whyCorrect: "B.",
          whyWrong: {},
          difficulty: "dificil",
        },
        {
          id: "boss2",
          statement: "Chefão 2 — pegadinha VUNESP. Assinale a alternativa correta.",
          alternatives: [
            { key: "A", text: "Alternativa A" },
            { key: "B", text: "Alternativa B" },
            { key: "C", text: "Alternativa C" },
            { key: "D", text: "Alternativa D" },
            { key: "E", text: "Alternativa E" },
          ],
          correctKey: "D",
          legalBasis: "CP",
          whyCorrect: "D.",
          whyWrong: {},
          difficulty: "dificil",
        },
      ],
    });

    const parsed = parseQuestPhaseAiJson(raw, "penal-1");
    expect(parsed.lessonBlocks.length).toBeLessThanOrEqual(3);
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.contentVersion).toBe(6);
    expect(parsed.questions[0]!.alternatives).toHaveLength(5);
    expect(parsed.questions[0]!.boardStyle).toBe("VUNESP");
    expect(parsed.bossQuestions[0]!.correctKey).toBe("B");
  });

  it("rejeita questão com menos de 5 alternativas", () => {
    expect(() =>
      parseQuestPhaseAiJson(
        JSON.stringify({
          lessonBlocks: [
            { id: "b1", kind: "contexto", title: "Ctx", body: "Texto longo o bastante aqui.", required: true },
            { id: "b2", kind: "explicacao", title: "Exp", body: "Texto longo o bastante aqui.", required: true },
            { id: "b3", kind: "base-legal", title: "Base", body: "Texto longo o bastante aqui.", required: true },
            { id: "b4", kind: "traducao", title: "Trad", body: "Texto longo o bastante aqui.", required: true },
            { id: "b5", kind: "exemplo", title: "Ex", body: "Texto longo o bastante aqui.", required: true },
          ],
          questions: [
            {
              id: "q1",
              statement: "Enunciado com tamanho suficiente para passar.",
              alternatives: [
                { key: "A", text: "a" },
                { key: "B", text: "b" },
                { key: "C", text: "c" },
                { key: "D", text: "d" },
              ],
              correctKey: "A",
              legalBasis: "x",
              whyCorrect: "y",
              whyWrong: {},
              difficulty: "media",
            },
          ],
          bossQuestions: [],
        }),
        "x",
      ),
    ).toThrow(/insuficientes/i);
  });
});

describe("mockQuestPhaseAiContent", () => {
  it("gera A–E a partir da fase do catálogo", () => {
    const phase = getQuestPhase("penal-1");
    expect(phase).toBeTruthy();
    const mock = mockQuestPhaseAiContent(phase!);
    expect(mock.questions[0]!.alternatives.map((a) => a.key)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(mock.questions.every((q) => q.boardStyle === "VUNESP")).toBe(true);
  });

  it("monta 50+10 questões por fase de português (10 trilhas × 5 + chefes)", () => {
    const phase = getQuestPhase("port-1");
    expect(phase).toBeTruthy();
    const mock = mockQuestPhaseAiContent(phase!);
    expect(mock.questions).toHaveLength(50);
    expect(mock.bossQuestions).toHaveLength(10);
  });
});

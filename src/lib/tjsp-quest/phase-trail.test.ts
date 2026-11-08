import { describe, expect, it } from "vitest";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";
import { mockQuestPhaseAiContent, mergePhaseWithAi } from "./ai-phase-content";
import {
  getTrailStageQuestions,
  missingForStage,
  phaseUsesInnerTrail,
  stageNeedsQuestions,
  trailStageCount,
} from "./phase-trail";
import type { QuestPhase } from "@/types/tjsp-quest";

describe("phase-trail", () => {
  it("divide português em 10 trilhas de 5 + chefe", () => {
    const base = getQuestPhase("port-1")!;
    const phase = mergePhaseWithAi(base, mockQuestPhaseAiContent(base));
    expect(phaseUsesInnerTrail(phase)).toBe(true);
    expect(trailStageCount(phase)).toBe(10);
    const s0 = getTrailStageQuestions(phase, 0);
    expect(s0.practice).toHaveLength(5);
    expect(s0.boss).toHaveLength(1);
    expect(s0.all).toHaveLength(6);
    const s9 = getTrailStageQuestions(phase, 9);
    expect(s9.practice).toHaveLength(5);
    expect(s9.boss[0]?.id).not.toBe(s0.boss[0]?.id);
  });
});


describe("trilha não para depois das 5 primeiras", () => {
  const phase = (q: number, b: number) =>
    ({
      id: "port-1",
      subjectId: "port",
      questions: Array.from({ length: q }, (_, i) => ({ id: `q${i}`, statement: `Q${i}` })),
      bossQuestions: Array.from({ length: b }, (_, i) => ({ id: `b${i}`, statement: `B${i}` })),
    }) as unknown as QuestPhase;

  it("fase com banco pequeno continua tendo 10 trilhas", () => {
    expect(trailStageCount(phase(8, 1))).toBe(10);
  });

  it("trilha 2 sem questões pede lote novo (trilha 2 e 3)", () => {
    const p = phase(5, 1);
    expect(stageNeedsQuestions(p, 0)).toBe(false);
    expect(stageNeedsQuestions(p, 1)).toBe(true);
    expect(missingForStage(p, 1)).toEqual({ desafio: 10, boss: 2 });
  });
});

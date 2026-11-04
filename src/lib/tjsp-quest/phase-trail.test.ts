import { describe, expect, it } from "vitest";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";
import { mockQuestPhaseAiContent, mergePhaseWithAi } from "./ai-phase-content";
import {
  getTrailStageQuestions,
  phaseUsesInnerTrail,
  trailStageCount,
} from "./phase-trail";

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

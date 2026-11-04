import { describe, expect, it } from "vitest";
import {
  applyXp,
  canStartChallenge,
  createInitialPlayerState,
  markLessonBlock,
  recordChefaoResult,
  xpToLevel,
} from "./progress";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";
import { QUEST_XP } from "@/types/tjsp-quest";

describe("tjsp-quest progress", () => {
  it("calcula nível a partir do XP", () => {
    expect(xpToLevel(0)).toBe(1);
    expect(xpToLevel(499)).toBe(1);
    expect(xpToLevel(500)).toBe(2);
  });

  it("respeita teto diário de XP", () => {
    let s = createInitialPlayerState();
    s = applyXp(s, QUEST_XP.dailyCap);
    const before = s.xp;
    s = applyXp(s, 500);
    expect(s.xp).toBe(before);
  });

  it("libera desafio sem exigir aula", () => {
    const phase = getQuestPhase("const-1")!;
    const s = createInitialPlayerState();
    expect(canStartChallenge(s, phase)).toBe(true);
  });

  it("desbloqueia fase seguinte ao passar no chefão", () => {
    const phase = getQuestPhase("const-1")!;
    let s = createInitialPlayerState();
    for (const b of phase.lessonBlocks.filter((x) => x.required)) {
      s = markLessonBlock(s, phase, b.id);
    }
    s = recordChefaoResult(s, phase, 100, 0);
    expect(s.phases[phase.id]?.completed).toBe(true);
    expect(s.phases["const-2"]?.unlocked).toBe(true);
  });
});

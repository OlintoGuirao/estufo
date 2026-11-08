import type { QuestPhase, QuestPhaseProgress, QuestQuestion } from "@/types/tjsp-quest";

/** Trilha interna da fase: 10 etapas × 5 questões + chefe ao fim de cada uma. */
export const PHASE_TRAIL = {
  stages: 10,
  questionsPerStage: 5,
  bossPerStage: 1,
  /** % mínima no chefe da etapa para liberar a próxima. */
  stagePassPct: 60,
} as const;

export function phaseUsesInnerTrail(phase: QuestPhase): boolean {
  const need =
    PHASE_TRAIL.stages * PHASE_TRAIL.questionsPerStage + PHASE_TRAIL.stages * PHASE_TRAIL.bossPerStage;
  const total = phase.questions.length + phase.bossQuestions.length;
  // Português / bancos grandes; ou qualquer fase com material suficiente.
  return phase.subjectId === "port" || total >= need * 0.8;
}

/**
 * Sempre 10 trilhas. Antes o número dependia do tamanho do banco: com 8
 * questões geradas a fase tinha UMA trilha e, depois das 5 primeiras,
 * parecia que não havia mais nada. Agora a etapa que ainda não tem questões
 * pede um lote novo à IA na hora (ver `stageNeedsQuestions`).
 */
export function trailStageCount(phase: QuestPhase): number {
  return phaseUsesInnerTrail(phase) ? PHASE_TRAIL.stages : 0;
}

/** A etapa ainda não tem as 5 questões + chefe no banco? */
export function stageNeedsQuestions(phase: QuestPhase, stageIndex: number): boolean {
  const needQ = (stageIndex + 1) * PHASE_TRAIL.questionsPerStage;
  const needB = (stageIndex + 1) * PHASE_TRAIL.bossPerStage;
  return phase.questions.length < needQ || phase.bossQuestions.length < needB;
}

/** Quantas faltam para cobrir esta etapa e a próxima (lote de 2 etapas por chamada). */
export function missingForStage(
  phase: QuestPhase,
  stageIndex: number,
): { desafio: number; boss: number } {
  const upTo = Math.min(PHASE_TRAIL.stages, stageIndex + 2);
  const desafio = Math.max(0, upTo * PHASE_TRAIL.questionsPerStage - phase.questions.length);
  const boss = Math.max(0, upTo * PHASE_TRAIL.bossPerStage - phase.bossQuestions.length);
  return { desafio: Math.min(15, desafio), boss: Math.min(4, boss) };
}

export function getTrailStageQuestions(
  phase: QuestPhase,
  stageIndex: number,
): { practice: QuestQuestion[]; boss: QuestQuestion[]; all: QuestQuestion[] } {
  const stages = trailStageCount(phase);
  const i = Math.max(0, Math.min(stageIndex, stages - 1));
  const start = i * PHASE_TRAIL.questionsPerStage;
  const practice = phase.questions.slice(start, start + PHASE_TRAIL.questionsPerStage);
  const bossStart = i * PHASE_TRAIL.bossPerStage;
  const boss = phase.bossQuestions.slice(bossStart, bossStart + PHASE_TRAIL.bossPerStage);
  const fallbackBoss =
    boss.length > 0
      ? boss
      : phase.bossQuestions.slice(0, 1).length
        ? phase.bossQuestions.slice(0, 1)
        : practice.slice(-1);
  return {
    practice,
    boss: fallbackBoss,
    all: [...practice, ...fallbackBoss],
  };
}

export function normalizeTrailProgress(prog: QuestPhaseProgress | undefined): {
  completedCount: number;
  bestPct: number[];
} {
  const completedCount = Math.max(0, prog?.trailCompletedCount ?? 0);
  const bestPct = Array.from({ length: PHASE_TRAIL.stages }, (_, i) =>
    Math.max(0, prog?.trailStageBestPct?.[i] ?? 0),
  );
  return { completedCount, bestPct };
}

export function isTrailStageUnlocked(
  prog: QuestPhaseProgress | undefined,
  stageIndex: number,
): boolean {
  if (!prog?.unlocked) return false;
  if (stageIndex <= 0) return true;
  const { completedCount } = normalizeTrailProgress(prog);
  return completedCount >= stageIndex;
}

export function isTrailStageCompleted(
  prog: QuestPhaseProgress | undefined,
  stageIndex: number,
): boolean {
  const { completedCount } = normalizeTrailProgress(prog);
  return completedCount > stageIndex;
}

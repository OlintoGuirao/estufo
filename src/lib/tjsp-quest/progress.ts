import { QUEST_SRS_INTERVALS, QUEST_XP, type QuestPlayerState, type QuestPhase, type QuestPhaseProgress, type QuestQuestion } from "@/types/tjsp-quest";
import { tjspQuestCatalog } from "@/data/tjsp-quest-catalog";

export function xpToLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / 500) + 1);
}

export function levelProgress(xp: number): { level: number; into: number; need: number; pct: number } {
  const level = xpToLevel(xp);
  const base = (level - 1) * 500;
  const into = xp - base;
  const need = 500;
  return { level, into, need, pct: Math.min(100, Math.round((into / need) * 100)) };
}

export function emptyPhaseProgress(phaseId: string, unlocked: boolean): QuestPhaseProgress {
  return {
    phaseId,
    lessonCompletedBlockIds: [],
    lessonDone: false,
    desafioBestPct: 0,
    chefaoBestPct: 0,
    unlocked,
    completed: false,
  };
}

export function createInitialPlayerState(): QuestPlayerState {
  const phases: Record<string, QuestPhaseProgress> = {};
  for (const p of tjspQuestCatalog.phases) {
    const unlocked = p.unlockRequiresPhaseIds.length === 0;
    phases[p.id] = emptyPhaseProgress(p.id, unlocked);
  }
  return {
    xp: 0,
    level: 1,
    streakDays: 0,
    lastStudyDate: null,
    dailyXp: 0,
    dailyXpDate: null,
    phases,
    attempts: [],
    reviews: [],
    achievements: [],
    updatedAt: new Date().toISOString(),
  };
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function touchStreak(state: QuestPlayerState, now = new Date()): QuestPlayerState {
  const today = todayKey(now);
  if (state.lastStudyDate === today) return state;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = todayKey(yesterday);
  const streakDays = state.lastStudyDate === yKey ? state.streakDays + 1 : 1;
  return { ...state, lastStudyDate: today, streakDays };
}

export function canAwardXp(state: QuestPlayerState, amount: number, now = new Date()): number {
  const today = todayKey(now);
  const dailyXp = state.dailyXpDate === today ? state.dailyXp : 0;
  const room = Math.max(0, QUEST_XP.dailyCap - dailyXp);
  return Math.min(amount, room);
}

export function applyXp(state: QuestPlayerState, amount: number, now = new Date()): QuestPlayerState {
  const today = todayKey(now);
  const awarded = canAwardXp(state, amount, now);
  if (awarded <= 0) return touchStreak(state, now);
  const dailyXp = (state.dailyXpDate === today ? state.dailyXp : 0) + awarded;
  const xp = state.xp + awarded;
  return {
    ...touchStreak(state, now),
    xp,
    level: xpToLevel(xp),
    dailyXp,
    dailyXpDate: today,
    updatedAt: now.toISOString(),
  };
}

export function xpForQuestion(q: QuestQuestion, streakCount: number): number {
  const base =
    q.difficulty === "facil"
      ? QUEST_XP.correctEasy
      : q.difficulty === "dificil"
        ? QUEST_XP.correctHard
        : QUEST_XP.correctMedium;
  const bonus = streakCount >= 3 ? QUEST_XP.streakBonus : 0;
  return base + bonus;
}

export function markLessonBlock(
  state: QuestPlayerState,
  phase: QuestPhase,
  blockId: string,
): QuestPlayerState {
  const prev = state.phases[phase.id] ?? emptyPhaseProgress(phase.id, true);
  if (prev.lessonCompletedBlockIds.includes(blockId)) return state;
  const lessonCompletedBlockIds = [...prev.lessonCompletedBlockIds, blockId];
  const required = phase.lessonBlocks.filter((b) => b.required).map((b) => b.id);
  const lessonDone = required.every((id) => lessonCompletedBlockIds.includes(id));
  return {
    ...state,
    phases: {
      ...state.phases,
      [phase.id]: { ...prev, lessonCompletedBlockIds, lessonDone },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Desafio/chefão liberados sem exigir aula (foco em questões). */
export function canStartChallenge(state: QuestPlayerState, phase: QuestPhase): boolean {
  const p = state.phases[phase.id];
  return Boolean(p?.unlocked);
}

export function recordDesafioResult(
  state: QuestPlayerState,
  phase: QuestPhase,
  pct: number,
  xpGained: number,
): QuestPlayerState {
  let next = applyXp(state, xpGained);
  const prev = next.phases[phase.id] ?? emptyPhaseProgress(phase.id, true);
  next = {
    ...next,
    phases: {
      ...next.phases,
      [phase.id]: {
        ...prev,
        desafioBestPct: Math.max(prev.desafioBestPct, pct),
        lastPlayedAt: new Date().toISOString(),
      },
    },
  };
  return next;
}

export function recordChefaoResult(
  state: QuestPlayerState,
  phase: QuestPhase,
  pct: number,
  xpGained: number,
): QuestPlayerState {
  let next = applyXp(state, xpGained);
  if (pct >= phase.bossPassPct) {
    next = applyXp(next, QUEST_XP.bossClear + QUEST_XP.phaseClear);
  }
  const prev = next.phases[phase.id] ?? emptyPhaseProgress(phase.id, true);
  const completed = pct >= phase.bossPassPct || prev.completed;
  next = {
    ...next,
    phases: {
      ...next.phases,
      [phase.id]: {
        ...prev,
        chefaoBestPct: Math.max(prev.chefaoBestPct, pct),
        completed,
        lastPlayedAt: new Date().toISOString(),
      },
    },
  };
  if (completed) {
    next = unlockDependents(next, phase.id);
    if (!next.achievements.includes(`phase:${phase.id}`)) {
      next = { ...next, achievements: [...next.achievements, `phase:${phase.id}`] };
    }
  }
  return next;
}

export function unlockDependents(state: QuestPlayerState, completedPhaseId: string): QuestPlayerState {
  const phases = { ...state.phases };
  for (const p of tjspQuestCatalog.phases) {
    if (!p.unlockRequiresPhaseIds.includes(completedPhaseId)) continue;
    const ready = p.unlockRequiresPhaseIds.every((id) => phases[id]?.completed);
    const cur = phases[p.id] ?? emptyPhaseProgress(p.id, false);
    if (ready && !cur.unlocked) {
      phases[p.id] = { ...cur, unlocked: true };
    }
  }
  return { ...state, phases, updatedAt: new Date().toISOString() };
}

export function scheduleReview(
  state: QuestPlayerState,
  opts: { questionId: string; phaseId: string; subjectId: string },
  now = new Date(),
): QuestPlayerState {
  const existing = state.reviews.find((r) => r.questionId === opts.questionId);
  const wrongCount = (existing?.wrongCount ?? 0) + 1;
  const idx = Math.min(wrongCount - 1, QUEST_SRS_INTERVALS.length - 1);
  const intervalDays = QUEST_SRS_INTERVALS[idx]!;
  const due = new Date(now);
  due.setDate(due.getDate() + intervalDays);
  const dueDate = due.toISOString().slice(0, 10);
  const item = {
    questionId: opts.questionId,
    phaseId: opts.phaseId,
    subjectId: opts.subjectId,
    dueDate,
    intervalDays,
    wrongCount,
  };
  const reviews = existing
    ? state.reviews.map((r) => (r.questionId === opts.questionId ? item : r))
    : [...state.reviews, item];
  return { ...state, reviews, updatedAt: now.toISOString() };
}

export function clearReviewOnSuccess(
  state: QuestPlayerState,
  questionId: string,
): QuestPlayerState {
  return {
    ...state,
    reviews: state.reviews.filter((r) => r.questionId !== questionId),
    updatedAt: new Date().toISOString(),
  };
}

export function dueReviews(state: QuestPlayerState, today = todayKey()): typeof state.reviews {
  return state.reviews.filter((r) => r.dueDate <= today);
}

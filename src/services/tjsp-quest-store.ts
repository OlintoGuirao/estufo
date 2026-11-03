import type { QuestAttempt, QuestPhase, QuestPlayerState } from "@/types/tjsp-quest";
import {
  applyXp,
  clearReviewOnSuccess,
  createInitialPlayerState,
  markLessonBlock,
  recordChefaoResult,
  recordDesafioResult,
  scheduleReview,
  xpForQuestion,
} from "@/lib/tjsp-quest/progress";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";
import { questPhaseAiService } from "@/services/quest-phase-ai.service";
import { studyUserDataDb, syncQuestState } from "@/services/study-user-data-db";

const KEY = "estufoo.tjsp-quest.v1";

/** Prefere conteúdo gerado por IA (VUNESP) quando houver cache. */
function resolvePhase(phaseId: string): QuestPhase | undefined {
  return questPhaseAiService.peekCached(phaseId)?.phase ?? getQuestPhase(phaseId);
}

function read(): QuestPlayerState {
  if (typeof window === "undefined") return createInitialPlayerState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const init = createInitialPlayerState();
      localStorage.setItem(KEY, JSON.stringify(init));
      return init;
    }
    const parsed = JSON.parse(raw) as QuestPlayerState;
    const base = createInitialPlayerState();
    return {
      ...base,
      ...parsed,
      phases: { ...base.phases, ...parsed.phases },
      attempts: parsed.attempts ?? [],
      reviews: parsed.reviews ?? [],
      achievements: parsed.achievements ?? [],
    };
  } catch {
    return createInitialPlayerState();
  }
}

function write(state: QuestPlayerState): QuestPlayerState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  syncQuestState(next);
  return next;
}

let questHydrated = false;

export const tjspQuestStore = {
  get(): QuestPlayerState {
    return read();
  },

  async hydrate(): Promise<QuestPlayerState> {
    const local = read();
    if (questHydrated) return local;
    questHydrated = true;
    const hasProgress =
      (local.attempts?.length ?? 0) > 0 ||
      Object.keys(local.phases ?? {}).length > 0 ||
      (local.xp ?? 0) > 0;
    if (hasProgress) {
      syncQuestState(local);
      return local;
    }
    try {
      const remote = await studyUserDataDb.loadQuestState();
      if (remote) {
        return write({ ...createInitialPlayerState(), ...remote });
      }
    } catch (err) {
      console.warn("[tjsp-quest] hydrate falhou", err);
    }
    return local;
  },

  reset(): QuestPlayerState {
    return write(createInitialPlayerState());
  },

  completeLessonBlock(phaseId: string, blockId: string): QuestPlayerState {
    const phase = resolvePhase(phaseId);
    if (!phase) return read();
    return write(markLessonBlock(read(), phase, blockId));
  },

  submitAnswer(input: {
    phaseId: string;
    questionId: string;
    choice: string;
    mode: QuestAttempt["mode"];
    streakCount: number;
  }): {
    state: QuestPlayerState;
    correct: boolean;
    xpAwarded: number;
  } {
    const phase = resolvePhase(input.phaseId);
    const q = phase
      ? [...phase.questions, ...phase.bossQuestions].find((x) => x.id === input.questionId)
      : undefined;
    if (!phase || !q) {
      return { state: read(), correct: false, xpAwarded: 0 };
    }
    const correct = q.correctKey === input.choice.toUpperCase();
    let state = read();
    let xpAwarded = 0;
    if (correct) {
      xpAwarded = xpForQuestion(q, input.streakCount);
      state = applyXp(state, xpAwarded);
      if (input.mode === "revisao") {
        state = clearReviewOnSuccess(state, q.id);
      }
    } else {
      state = scheduleReview(state, {
        questionId: q.id,
        phaseId: phase.id,
        subjectId: phase.subjectId,
      });
    }
    const attempt: QuestAttempt = {
      questionId: q.id,
      phaseId: phase.id,
      mode: input.mode,
      choice: input.choice.toUpperCase(),
      correct,
      at: new Date().toISOString(),
      xpAwarded: correct ? xpAwarded : 0,
    };
    state = {
      ...state,
      attempts: [...state.attempts.slice(-400), attempt],
    };
    return { state: write(state), correct, xpAwarded: correct ? xpAwarded : 0 };
  },

  finishDesafio(phaseId: string, pct: number, bonusXp: number): QuestPlayerState {
    const phase = resolvePhase(phaseId);
    if (!phase) return read();
    return write(recordDesafioResult(read(), phase, pct, bonusXp));
  },

  finishChefao(phaseId: string, pct: number, bonusXp: number): QuestPlayerState {
    const phase = resolvePhase(phaseId);
    if (!phase) return read();
    return write(recordChefaoResult(read(), phase, pct, bonusXp));
  },
};

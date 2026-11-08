import type { QuestAttempt, QuestPhase, QuestPlayerState, QuestShopHelpKind } from "@/types/tjsp-quest";
import {
  applyXp,
  clearReviewOnSuccess,
  createInitialPlayerState,
  markLessonBlock,
  recordChefaoResult,
  recordDesafioResult,
  recordTrailStageResult,
  scheduleReview,
  xpForQuestion,
} from "@/lib/tjsp-quest/progress";
import {
  consumeHelp,
  consumeLife,
  equipShopCosmetic,
  normalizeShop,
  purchaseShopItem,
} from "@/lib/tjsp-quest/shop";
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
      // Contas antigas: a loja usava XP como dinheiro — saldo vira moedas.
      coins: typeof parsed.coins === "number" ? parsed.coins : parsed.xp ?? 0,
      phases: { ...base.phases, ...parsed.phases },
      attempts: parsed.attempts ?? [],
      reviews: parsed.reviews ?? [],
      achievements: parsed.achievements ?? [],
      shop: normalizeShop(parsed.shop),
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
    try {
      const remote = await studyUserDataDb.loadQuestState();
      if (remote) {
        const localTs = Date.parse(local.updatedAt || "") || 0;
        const remoteTs = Date.parse(remote.updatedAt || "") || 0;
        // Conta logada: banco manda se estiver igual/mais novo; senão sobe o local.
        if (remoteTs >= localTs) {
          const base = createInitialPlayerState();
          return write({
            ...base,
            ...remote,
            phases: { ...base.phases, ...(remote.phases ?? {}) },
            shop: normalizeShop(remote.shop),
            updatedAt: remote.updatedAt || new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.warn("[tjsp-quest] hydrate falhou", err);
    }
    syncQuestState(local);
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

  finishTrailStage(
    phaseId: string,
    stageIndex: number,
    pct: number,
    stageCount: number,
    stagePassPct: number,
    bonusXp = 0,
  ): QuestPlayerState {
    const phase = resolvePhase(phaseId);
    if (!phase) return read();
    return write(
      recordTrailStageResult(read(), phase, stageIndex, pct, stageCount, bonusXp, stagePassPct),
    );
  },

  /** Já jogou o desafio do dia hoje? */
  dailyDone(date: string): boolean {
    const d = read().daily;
    return !!d && d.date === date && d.done;
  },

  /**
   * Fecha o desafio do dia: entrega XP + moedas (uma vez por dia) e conta
   * para a sequência de dias.
   */
  finishDaily(input: {
    date: string;
    subjectId: string;
    correct: number;
    total: number;
    reward: number;
  }): QuestPlayerState {
    const cur = read();
    if (cur.daily?.date === input.date && cur.daily.done) return cur;
    let state = applyXp(cur, input.reward);
    state = {
      ...state,
      daily: {
        date: input.date,
        subjectId: input.subjectId,
        correct: input.correct,
        total: input.total,
        done: true,
        coinsAwarded: input.reward,
      },
    };
    return write(state);
  },

  purchase(itemId: string): { state: QuestPlayerState; ok: boolean; reason?: string } {
    const result = purchaseShopItem(read(), itemId);
    if (!result.ok) return { state: read(), ok: false, reason: result.reason };
    return { state: write(result.state), ok: true };
  },

  equip(kind: "personagem" | "skin", itemId: string): QuestPlayerState {
    return write(equipShopCosmetic(read(), kind, itemId));
  },

  useHelp(kind: QuestShopHelpKind): { state: QuestPlayerState; ok: boolean } {
    const result = consumeHelp(read(), kind);
    if (!result.ok) return { state: read(), ok: false };
    return { state: write(result.state), ok: true };
  },

  useLife(): { state: QuestPlayerState; ok: boolean } {
    const result = consumeLife(read());
    if (!result.ok) return { state: read(), ok: false };
    return { state: write(result.state), ok: true };
  },
};

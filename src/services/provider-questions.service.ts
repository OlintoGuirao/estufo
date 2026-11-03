import {
  checkProviderAnswer,
  getProviderQuestion,
  getQuestionProviderStatus,
  listProviderQuestions,
} from "./provider-questions.fns";
import type {
  ProviderListResult,
  ProviderQuestionDto,
  ProviderQuestionFilters,
  ProviderStatus,
} from "@/types/provider-questions";
import { providerQuestionState, type ProviderQuestionUserState } from "./provider-question-state";
import { ApiError } from "./api";

export type ProviderAnswerResult = {
  correct: boolean;
  correctKey: string | null;
  explanationHtml: string | null;
  annulled: boolean;
  source: string;
};

function parseProviderError(e: unknown): never {
  if (e instanceof Error && e.message.startsWith("{")) {
    try {
      const payload = JSON.parse(e.message) as { message?: string; status?: number };
      throw new ApiError(payload.message ?? "Erro no provedor de questões.", payload.status ?? 502);
    } catch (inner) {
      if (inner instanceof ApiError) throw inner;
    }
  }
  throw e instanceof Error
    ? new ApiError(e.message, 502)
    : new ApiError("Erro no provedor de questões.", 502);
}

function externalIdOf(id: string): string {
  return id.startsWith("ext:") ? id.slice(4) : id;
}

function mergeUserState(q: ProviderQuestionDto): ProviderQuestionDto {
  const st = providerQuestionState.get(q.externalId);
  return {
    ...q,
    favorite: st.favorite,
    markedForReview: st.markedForReview,
    answered: st.answered ? { choice: st.answered.choice, correct: st.answered.correct } : null,
  };
}

export const providerQuestionsService = {
  async status(): Promise<ProviderStatus> {
    try {
      return await getQuestionProviderStatus();
    } catch (e) {
      return parseProviderError(e);
    }
  },

  async list(
    filters: ProviderQuestionFilters & { useTjspEscreventePreset?: boolean },
  ): Promise<ProviderListResult> {
    try {
      const res = await listProviderQuestions({ data: filters });
      return { ...res, items: res.items.map(mergeUserState) };
    } catch (e) {
      return parseProviderError(e);
    }
  },

  async get(id: string): Promise<ProviderQuestionDto> {
    try {
      const res = await getProviderQuestion({ data: { id } });
      return mergeUserState(res.question);
    } catch (e) {
      return parseProviderError(e);
    }
  },

  async answer(
    id: string,
    d: { choice: string; timeSec: number; meta?: ProviderQuestionUserState["meta"] },
  ): Promise<ProviderAnswerResult> {
    try {
      const result = await checkProviderAnswer({ data: { id, choice: d.choice } });
      const patch: Partial<ProviderQuestionUserState> = {
        answered: {
          choice: d.choice.toUpperCase(),
          correct: result.correct,
          at: new Date().toISOString(),
        },
      };
      if (d.meta) patch.meta = d.meta;
      providerQuestionState.upsert(externalIdOf(id), patch);
      return result;
    } catch (e) {
      return parseProviderError(e);
    }
  },

  favorite(id: string) {
    return providerQuestionState.toggleFavorite(externalIdOf(id));
  },

  review(id: string) {
    return providerQuestionState.toggleReview(externalIdOf(id));
  },
};

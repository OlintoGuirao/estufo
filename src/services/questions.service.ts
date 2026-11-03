import { request, qs } from "./api";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  answerQuestionFromSupabase,
  getQuestionFromSupabase,
  listQuestionsFromSupabase,
  toggleFavoriteFromSupabase,
  toggleReviewFromSupabase,
} from "./supabase/catalog";
import { tjspProvasCatalog } from "./tjsp-provas.catalog";
import { tjspBancoCatalog } from "./tjsp-banco.catalog";
import { localQuestionState } from "./local-question-state";
import type { AnswerResult, Paginated, Question, QuestionFilters } from "@/types";

export const questionsService = {
  async list(f: QuestionFilters): Promise<Paginated<Question>> {
    if (isSupabaseConfigured) {
      await localQuestionState.hydrate();
      return listQuestionsFromSupabase(f);
    }
    return request<Paginated<Question>>("GET", `/questions${qs(f)}`);
  },

  async get(id: string): Promise<Question> {
    if (tjspBancoCatalog.isBancoId(id)) return tjspBancoCatalog.getQuestion(id);
    if (tjspProvasCatalog.isTjspId(id)) return tjspProvasCatalog.getQuestion(id);
    if (isSupabaseConfigured) return getQuestionFromSupabase(id);
    return request<Question>("GET", `/questions/${id}`);
  },

  async answer(id: string, d: { choice: string; timeSec: number }): Promise<AnswerResult> {
    if (tjspBancoCatalog.isBancoId(id)) return tjspBancoCatalog.answer(id, d.choice);
    if (tjspProvasCatalog.isTjspId(id)) return tjspProvasCatalog.answer(id, d.choice);
    if (isSupabaseConfigured) return answerQuestionFromSupabase(id, d.choice);
    return request<AnswerResult>("POST", `/questions/${id}/answers`, d);
  },

  async favorite(id: string): Promise<Question> {
    if (isSupabaseConfigured) return toggleFavoriteFromSupabase(id);
    return request<Question>("POST", `/questions/${id}/favorite`);
  },

  async review(id: string): Promise<Question> {
    if (isSupabaseConfigured) return toggleReviewFromSupabase(id);
    return request<Question>("POST", `/questions/${id}/review`);
  },
};

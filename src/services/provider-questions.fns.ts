/**
 * Server functions do provedor — arquivo importável pelo cliente (RPC).
 * A lógica com QUESTIONS_API_KEY fica em src/server/** e só entra via import() no handler.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const filtersSchema = z.object({
  board: z.string().optional(),
  institution: z.string().optional(),
  role: z.string().optional(),
  year: z.number().int().optional(),
  subject: z.string().optional(),
  topic: z.string().optional(),
  requireAnswerKey: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(20).optional(),
  useTjspEscreventePreset: z.boolean().optional(),
});

export const getQuestionProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getProviderPublicStatus } = await import("@/server/question-provider/factory");
  const { TJSP_ESCREVENTE_PRESET } = await import("@/server/question-provider/normalize");
  const status = getProviderPublicStatus();
  return {
    ...status,
    targetPreset: {
      board: TJSP_ESCREVENTE_PRESET.board,
      institution: TJSP_ESCREVENTE_PRESET.institution,
      role: TJSP_ESCREVENTE_PRESET.role,
      label: TJSP_ESCREVENTE_PRESET.label,
    },
  };
});

export const listProviderQuestions = createServerFn({ method: "POST" })
  .validator(filtersSchema)
  .handler(async ({ data }) => {
    try {
      const { createQuestionProvider } = await import("@/server/question-provider/factory");
      const {
        applyClientSideFilterHints,
        evaluateMatchQuality,
        normalizeListResponse,
        TJSP_ESCREVENTE_PRESET,
      } = await import("@/server/question-provider/normalize");
      const preset = data.useTjspEscreventePreset
        ? {
            board: data.board || TJSP_ESCREVENTE_PRESET.board,
            institution: data.institution || TJSP_ESCREVENTE_PRESET.institution,
            role: data.role || TJSP_ESCREVENTE_PRESET.role,
          }
        : {};
      const rawFilters: Record<string, string | number | boolean> = { ...preset };
      if (data.board) rawFilters["board"] = data.board;
      if (data.institution) rawFilters["institution"] = data.institution;
      if (data.role) rawFilters["role"] = data.role;
      if (data.year != null) rawFilters["year"] = data.year;
      if (data.subject) rawFilters["subject"] = data.subject;
      if (data.topic) rawFilters["topic"] = data.topic;
      if (data.requireAnswerKey) rawFilters["requireAnswerKey"] = true;
      if (data.page != null) rawFilters["page"] = data.page;
      if (data.pageSize != null) rawFilters["pageSize"] = data.pageSize;
      const filters = applyClientSideFilterHints(rawFilters);
      const provider = createQuestionProvider();
      const { raw } = await provider.list(filters);
      const evaluated = evaluateMatchQuality(filters, raw.items ?? []);
      const normalized = normalizeListResponse(raw, filters, {}, evaluated);
      return {
        ...normalized,
        providerConfigured: true as const,
        providerName: provider.name,
      };
    } catch (err) {
      return await throwSafe(err);
    }
  });

export const getProviderQuestion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      const { createQuestionProvider } = await import("@/server/question-provider/factory");
      const { normalizeUpstreamQuestion, stripExternalPrefix } =
        await import("@/server/question-provider/normalize");
      const provider = createQuestionProvider();
      const raw = await provider.get(stripExternalPrefix(data.id));
      return {
        question: normalizeUpstreamQuestion(raw),
        providerName: provider.name,
      };
    } catch (err) {
      return await throwSafe(err);
    }
  });

export const checkProviderAnswer = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), choice: z.string().min(1).max(1) }))
  .handler(async ({ data }) => {
    try {
      const { createQuestionProvider } = await import("@/server/question-provider/factory");
      const { stripExternalPrefix } = await import("@/server/question-provider/normalize");
      const { plainTextToSafeHtml, sanitizeQuestionHtml } =
        await import("@/server/question-provider/sanitize");
      const provider = createQuestionProvider();
      const result = await provider.checkAnswer(
        stripExternalPrefix(data.id),
        data.choice.toUpperCase(),
      );
      const explanationRaw = result.explanationHtml ?? result.explanation ?? "";
      const explanationHtml = explanationRaw
        ? explanationRaw.includes("<")
          ? sanitizeQuestionHtml(explanationRaw)
          : plainTextToSafeHtml(explanationRaw)
        : null;
      return {
        correct: Boolean(result.correct),
        correctKey: result.correctKey ?? null,
        explanationHtml,
        annulled: Boolean(result.annulled),
        source: result.source ?? "Provedor externo",
      };
    } catch (err) {
      return await throwSafe(err);
    }
  });

async function throwSafe(err: unknown): Promise<never> {
  const { QuestionProviderError, toClientErrorPayload } =
    await import("@/server/question-provider/errors");
  const payload = toClientErrorPayload(err);
  const e = new Error(JSON.stringify(payload));
  e.name = err instanceof QuestionProviderError ? "QuestionProviderError" : "ProviderError";
  throw e;
}

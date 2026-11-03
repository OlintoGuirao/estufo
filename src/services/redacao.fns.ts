import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function throwTutorError(err: unknown): Promise<never> {
  const { OllamaError } = await import("@/server/ollama/errors");
  if (err instanceof OllamaError) throw err;
  const msg = err instanceof Error ? err.message : "Erro na redação.";
  throw new OllamaError("invalid_response", msg, 503);
}

export const generateRedacaoThemesFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      contestName: z.string().max(200).optional(),
      organ: z.string().max(200).optional(),
      role: z.string().max(200).optional(),
      board: z.string().max(120).optional(),
      summary: z.string().max(4000).optional(),
      subjects: z.array(z.string().max(120)).max(40).optional(),
      openImprovements: z.array(z.string().max(300)).max(12).optional(),
      count: z.number().int().min(3).max(8).optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const count = data.count ?? 5;
      const meta = {
        contestName: data.contestName?.trim() || "Concurso (edital)",
        organ: data.organ?.trim() || "",
        role: data.role?.trim() || "",
        board: data.board?.trim() || "",
        summary: data.summary?.trim() || "",
        subjects: data.subjects ?? [],
        openImprovements: data.openImprovements ?? [],
        count,
      };
      const {
        buildThemeMessages,
        mockThemes,
        parseThemesJson,
      } = await import("@/lib/redacao/ai");
      const { tutorChat } = await import("@/server/tutor-llm");
      const mock = mockThemes({
        contestName: meta.contestName,
        board: meta.board,
        count,
      });
      const result = await tutorChat(buildThemeMessages(meta), {
        mockText: JSON.stringify({
          themes: mock.map((t) => ({
            title: t.title,
            prompt: t.prompt,
            context: t.context,
            likelihood: t.likelihood,
          })),
        }),
      });
      const themes = parseThemesJson(result.text, {
        contestName: meta.contestName,
        board: meta.board,
        count,
      });
      return { themes, model: result.model, mocked: !!result.mocked };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

export const correctRedacaoFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      essayId: z.string().min(1).max(120),
      contestName: z.string().max(200).optional(),
      board: z.string().max(120).optional(),
      themeTitle: z.string().min(1).max(300),
      themePrompt: z.string().min(1).max(3000),
      essayBody: z.string().min(80).max(20000),
      focusPoints: z
        .array(
          z.object({
            id: z.string().max(80),
            area: z.string().max(80),
            tip: z.string().max(400),
          }),
        )
        .max(8)
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const focus = data.focusPoints ?? [];
      const {
        buildCorrectionMessages,
        mockCorrection,
        parseCorrectionJson,
      } = await import("@/lib/redacao/ai");
      const { tutorChat } = await import("@/server/tutor-llm");
      const mock = mockCorrection({ essayId: data.essayId, focusPoints: focus });
      const result = await tutorChat(
        buildCorrectionMessages({
          contestName: data.contestName?.trim() || "",
          board: data.board?.trim() || "",
          themeTitle: data.themeTitle,
          themePrompt: data.themePrompt,
          essayBody: data.essayBody,
          focusPoints: focus,
        }),
        {
          mockText: JSON.stringify({
            score: mock.score,
            maxScore: mock.maxScore,
            competencies: mock.competencies,
            strengths: mock.strengths,
            improvements: mock.improvements.map((i) => ({
              area: i.area,
              tip: i.tip,
            })),
            overallFeedback: mock.overallFeedback,
            resolvedFocus: focus.slice(0, 1).map((f) => f.area),
          }),
        },
      );
      const parsed = parseCorrectionJson(result.text, {
        essayId: data.essayId,
        focusPoints: focus,
      });
      return {
        correction: parsed.correction,
        resolvedFocusAreas: parsed.resolvedFocusAreas,
        model: result.model,
        mocked: !!result.mocked,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

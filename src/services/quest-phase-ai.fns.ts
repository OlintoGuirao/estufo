import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function throwTutorError(err: unknown): Promise<never> {
  const { OllamaError } = await import("@/server/ollama/errors");
  if (err instanceof OllamaError) throw err;
  const msg = err instanceof Error ? err.message : "Erro ao gerar conteúdo do Quest.";
  throw new OllamaError("upstream", msg, 503);
}

/** Gera aula + questões padrão VUNESP (A–E) para uma fase do /quest. */
export const generateQuestPhaseContent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      phaseId: z.string().min(1).max(80),
      subjectName: z.string().min(1).max(200),
      title: z.string().min(1).max(200),
      objective: z.string().min(1).max(800),
      sources: z
        .array(z.object({ label: z.string().max(200), url: z.string().max(500).optional() }))
        .max(12),
      /** Conteúdo estático atual — usado só no mock/fallback. */
      fallbackLessonHint: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const {
        buildQuestPhaseAiMessages,
        mockQuestPhaseAiContent,
        parseQuestPhaseAiJson,
      } = await import("@/lib/tjsp-quest/ai-phase-content");
      const { getQuestPhase } = await import("@/data/tjsp-quest-catalog");
      const { tutorChat } = await import("@/server/tutor-llm");

      const base = getQuestPhase(data.phaseId);
      const mockPayload = base
        ? mockQuestPhaseAiContent(base)
        : mockQuestPhaseAiContent({
            id: data.phaseId,
            subjectId: "x",
            number: 1,
            title: data.title,
            objective: data.objective,
            estimatedMinutes: 12,
            conceptsCount: 4,
            lessonBlocks: [],
            questions: [],
            bossQuestions: [],
            sources: data.sources,
            contentVerifiedAt: "2026-10-28",
            unlockRequiresPhaseIds: [],
            bossPassPct: 80,
          });

      const result = await tutorChat(
        buildQuestPhaseAiMessages({
          phaseId: data.phaseId,
          subjectId: base?.subjectId ?? data.phaseId.split("-")[0] ?? "geral",
          subjectName: data.subjectName,
          title: data.title,
          objective: data.objective,
          sources: data.sources,
        }),
        { mockText: JSON.stringify(mockPayload) },
      );

      let payload;
      try {
        payload = parseQuestPhaseAiJson(result.text, data.phaseId);
      } catch {
        payload = mockPayload;
      }

      return {
        content: payload,
        model: result.model,
        mocked: !!result.mocked,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { QuestPhaseAiPayload } from "@/lib/tjsp-quest/ai-phase-content";

async function throwTutorError(err: unknown): Promise<never> {
  const { OllamaError } = await import("@/server/ollama/errors");
  if (err instanceof OllamaError) throw err;
  const msg = err instanceof Error ? err.message : "Erro ao gerar conteúdo do Quest.";
  throw new OllamaError("upstream", msg, 503);
}

function dedupeQuestions<T extends { id: string; statement: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const q of list) {
    const key = q.statement.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
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
      const ai = await import("@/lib/tjsp-quest/ai-phase-content");
      const {
        buildQuestPhaseAiMessages,
        getQuestQuestionTargets,
        mockQuestPhaseAiContent,
        parseQuestPhaseAiJson,
        QUEST_AI_BATCH,
        QUEST_AI_MAX_BATCHES,
        QUEST_PHASE_AI_CONTENT_VERSION,
      } = ai;
      const { getQuestPhase } = await import("@/data/tjsp-quest-catalog");
      const { tutorChat } = await import("@/server/tutor-llm");

      const base = getQuestPhase(data.phaseId);
      const subjectId = base?.subjectId ?? data.phaseId.split("-")[0] ?? "geral";
      const targets = getQuestQuestionTargets(subjectId);

      const mockPayload = base
        ? mockQuestPhaseAiContent(base)
        : mockQuestPhaseAiContent({
            id: data.phaseId,
            subjectId,
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

      const { pickVunespExamples, formatVunespExamples } = await import("@/server/vunesp-examples");
      const { retrieveLegalContext } = await import("@/server/legal/retrieve");
      const { verifyGeneratedQuestions } = await import("@/server/question-verify");
      const isPort = subjectId.startsWith("port");
      const legal = isPort
        ? { text: "" }
        : await retrieveLegalContext(`${data.subjectName}\n${data.title}\n${data.objective}`, {
            limit: 8,
          });

      const meta = {
        phaseId: data.phaseId,
        subjectId,
        subjectName: data.subjectName,
        title: data.title,
        objective: data.objective,
        sources: data.sources,
        examples: formatVunespExamples(pickVunespExamples(data.subjectName, data.title, 2)),
        ...(legal.text ? { legalContext: legal.text } : {}),
      };
      let droppedByVerify = 0;

      const batchTotal = Math.min(
        QUEST_AI_MAX_BATCHES,
        Math.max(
          1,
          Math.ceil(targets.desafio / QUEST_AI_BATCH.desafio),
          Math.ceil(targets.boss / QUEST_AI_BATCH.boss),
        ),
      );

      let merged: QuestPhaseAiPayload = {
        lessonBlocks: [],
        questions: [],
        bossQuestions: [],
      };
      let model = "mock";
      let mocked = true;

      for (let i = 0; i < batchTotal; i++) {
        const needDesafio = Math.min(
          QUEST_AI_BATCH.desafio,
          Math.max(0, targets.desafio - merged.questions.length),
        );
        const needBoss = Math.min(
          QUEST_AI_BATCH.boss,
          Math.max(0, targets.boss - merged.bossQuestions.length),
        );
        if (needDesafio <= 0 && needBoss <= 0) break;

        const result = await tutorChat(
          buildQuestPhaseAiMessages(meta, {
            desafioCount: needDesafio > 0 ? needDesafio : needBoss > 0 ? 0 : 3,
            bossCount: needBoss,
            batchIndex: i + 1,
            batchTotal,
          }),
          {
            task: "questions", mockText: JSON.stringify({
              lessonBlocks: i === 0 ? mockPayload.lessonBlocks : [],
              questions: mockPayload.questions.slice(
                i * QUEST_AI_BATCH.desafio,
                i * QUEST_AI_BATCH.desafio + needDesafio,
              ),
              bossQuestions: mockPayload.bossQuestions.slice(
                i * QUEST_AI_BATCH.boss,
                i * QUEST_AI_BATCH.boss + needBoss,
              ),
            }),
          },
        );

        model = result.model;
        mocked = !!result.mocked;

        let payload: QuestPhaseAiPayload;
        try {
          payload = parseQuestPhaseAiJson(result.text, `${data.phaseId}-b${i + 1}`);
        } catch {
          payload = {
            lessonBlocks: i === 0 ? mockPayload.lessonBlocks : [],
            questions: mockPayload.questions.slice(
              i * QUEST_AI_BATCH.desafio,
              i * QUEST_AI_BATCH.desafio + Math.max(needDesafio, 3),
            ),
            bossQuestions: mockPayload.bossQuestions.slice(
              i * QUEST_AI_BATCH.boss,
              i * QUEST_AI_BATCH.boss + Math.max(needBoss, 2),
            ),
            contentVersion: mockPayload.contentVersion,
          };
        }

        // 2ª passagem: outro modelo/chamada resolve sem gabarito; divergentes saem.
        if (!mocked) {
          const v = await verifyGeneratedQuestions(
            [...payload.questions, ...payload.bossQuestions],
            { subject: data.subjectName, ...(legal.text ? { legalContext: legal.text } : {}) },
          );
          const ok = new Set(v.kept.map((x) => x.id));
          payload.questions = payload.questions.filter((x: { id: string }) => ok.has(x.id));
          payload.bossQuestions = payload.bossQuestions.filter((x: { id: string }) => ok.has(x.id));
          droppedByVerify += v.dropped;
        }

        if (i === 0 && payload.lessonBlocks.length) {
          merged.lessonBlocks = payload.lessonBlocks;
        }
        merged.questions = dedupeQuestions([...merged.questions, ...payload.questions]);
        merged.bossQuestions = dedupeQuestions([
          ...merged.bossQuestions,
          ...payload.bossQuestions,
        ]);
      }

      if (merged.questions.length < 3) {
        merged = mockPayload;
        mocked = true;
      } else {
        // Completa com as questões curadas da própria fase (nunca com placeholders
        // genéricos do mock — antes o aluno via "Afirmação alinhada ao núcleo de…").
        merged.questions = dedupeQuestions([
          ...merged.questions,
          ...(base?.questions ?? []),
        ]).slice(0, targets.desafio);
        merged.bossQuestions = dedupeQuestions([
          ...(merged.bossQuestions.length >= 2
            ? merged.bossQuestions
            : merged.questions.slice(0, targets.boss)),
          ...(base?.bossQuestions ?? []),
        ]).slice(0, targets.boss);
        if (!merged.lessonBlocks.length) {
          merged.lessonBlocks = mockPayload.lessonBlocks;
        }
      }

      merged.contentVersion = QUEST_PHASE_AI_CONTENT_VERSION;

      return {
        content: merged,
        model,
        mocked,
        droppedByVerify,
      };
    } catch (err) {
      return await throwTutorError(err);
    }
  });

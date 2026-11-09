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

/** Mais um lote de questões para a próxima etapa da trilha (sem repetir). */
async function extendPhaseBank(data: {
  phaseId: string;
  subjectName: string;
  title: string;
  objective: string;
  sources: { label: string; url?: string | undefined }[];
  extend: { desafio: number; boss: number; avoid: string[] };
}): Promise<{ content: QuestPhaseAiPayload; model: string; mocked: boolean }> {
  try {
    const { buildQuestPhaseAiMessages, parseQuestPhaseAiJson, mockQuestPhaseAiContent } =
      await import("@/lib/tjsp-quest/ai-phase-content");
    const { getQuestPhase } = await import("@/data/tjsp-quest-catalog");
    const { tutorChat } = await import("@/server/tutor-llm");
    const { pickVunespExamples, formatVunespExamples } = await import("@/server/vunesp-examples");
    const { retrieveLegalContext } = await import("@/server/legal/retrieve");
    const { verifyGeneratedQuestions } = await import("@/server/question-verify");
    const { editalItemsForPhase, editalFocusForPhase } = await import("@/data/tjsp-quest/edital-topics");

    const base = getQuestPhase(data.phaseId);
    const subjectId = base?.subjectId ?? data.phaseId.split("-")[0] ?? "geral";
    const isPort = subjectId.startsWith("port");
    const editalItems = editalItemsForPhase(data.phaseId).map((i) => i.text);
    const editalFocus = editalFocusForPhase(data.phaseId, data.extend.avoid.length, 3).map((i) => i.text);
    const legal = isPort
      ? { text: "" }
      : await retrieveLegalContext(
          `${data.subjectName}\n${data.title}\n${editalFocus.join("\n") || data.objective}`,
          { limit: 8 },
        );

    const messages = buildQuestPhaseAiMessages(
      {
        phaseId: data.phaseId,
        subjectId,
        subjectName: data.subjectName,
        title: data.title,
        objective: data.objective,
        sources: data.sources,
        examples: formatVunespExamples(pickVunespExamples(data.subjectName, data.title, 2)),
        ...(legal.text ? { legalContext: legal.text } : {}),
        avoid: data.extend.avoid,
        ...(editalItems.length ? { editalItems, editalFocus } : {}),
      },
      { desafioCount: data.extend.desafio, bossCount: data.extend.boss, batchIndex: 2, batchTotal: 2 },
    );
    const mock = base ? mockQuestPhaseAiContent(base) : null;
    const result = await tutorChat(messages, {
      task: "questions",
      mockText: JSON.stringify({
        lessonBlocks: [],
        questions: (mock?.questions ?? []).slice(0, data.extend.desafio),
        bossQuestions: (mock?.bossQuestions ?? []).slice(0, data.extend.boss),
      }),
    });
    // Prefixo novo a cada lote: ids nunca colidem com os que o aluno já tem.
    const payload = parseQuestPhaseAiJson(
      result.text,
      `${data.phaseId}-x${Date.now().toString(36)}`,
    );
    const avoid = new Set(data.extend.avoid.map((a) => a.toLowerCase().slice(0, 120)));
    const fresh = (list: typeof payload.questions) =>
      dedupeQuestions(list).filter(
        (q) => !avoid.has(q.statement.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120)),
      );
    let questions = fresh(payload.questions);
    let bossQuestions = fresh(payload.bossQuestions);
    if (!result.mocked) {
      const v = await verifyGeneratedQuestions([...questions, ...bossQuestions], {
        subject: data.subjectName,
        ...(legal.text ? { legalContext: legal.text } : {}),
      });
      const ok = new Set(v.kept.map((x) => x.id));
      questions = questions.filter((x) => ok.has(x.id));
      bossQuestions = bossQuestions.filter((x) => ok.has(x.id));
    }
    return {
      content: { lessonBlocks: [], questions, bossQuestions },
      model: result.model,
      mocked: !!result.mocked,
    };
  } catch (err) {
    return await throwTutorError(err);
  }
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
      /**
       * Trilha pedindo MAIS questões (a próxima etapa ainda não tem banco).
       * Gera só o lote pedido, sem repetir os enunciados já existentes.
       */
      extend: z
        .object({
          desafio: z.number().int().min(1).max(15),
          boss: z.number().int().min(0).max(4),
          avoid: z.array(z.string().max(160)).max(150).optional().default([]),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (data.extend) return extendPhaseBank(data as typeof data & { extend: NonNullable<typeof data.extend> });
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
      const { editalItemsForPhase, editalFocusForPhase } = await import("@/data/tjsp-quest/edital-topics");
      const editalItems = editalItemsForPhase(data.phaseId).map((i) => i.text);
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
        ...(editalItems.length ? { editalItems } : {}),
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

      // Lotes em PARALELO (antes eram em sequência: 2× geração + 2× verificação
      // somavam > 95 s e o aluno via "Tempo esgotado ao montar o banco").
      const runBatch = async (i: number) => {
        const needDesafio = Math.min(
          QUEST_AI_BATCH.desafio,
          Math.max(0, targets.desafio - i * QUEST_AI_BATCH.desafio),
        );
        const needBoss = Math.min(
          QUEST_AI_BATCH.boss,
          Math.max(0, targets.boss - i * QUEST_AI_BATCH.boss),
        );
        if (needDesafio <= 0 && needBoss <= 0) return null;

        const editalFocus = editalFocusForPhase(data.phaseId, i * 5, 3).map((x) => x.text);
        const result = await tutorChat(
          buildQuestPhaseAiMessages(editalFocus.length ? { ...meta, editalFocus } : meta, {
            desafioCount: needDesafio > 0 ? needDesafio : needBoss > 0 ? 0 : 3,
            bossCount: needBoss,
            batchIndex: i + 1,
            batchTotal,
          }),
          {
            task: "questions",
            mockText: JSON.stringify({
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

        // 2ª passagem: outra chamada resolve sem gabarito; divergentes saem.
        let dropped = 0;
        if (!result.mocked) {
          const v = await verifyGeneratedQuestions(
            [...payload.questions, ...payload.bossQuestions],
            { subject: data.subjectName, ...(legal.text ? { legalContext: legal.text } : {}) },
          );
          const ok = new Set(v.kept.map((x) => x.id));
          payload.questions = payload.questions.filter((x: { id: string }) => ok.has(x.id));
          payload.bossQuestions = payload.bossQuestions.filter((x: { id: string }) => ok.has(x.id));
          dropped = v.dropped;
        }
        return { i, payload, model: result.model, mocked: !!result.mocked, dropped };
      };

      const settled = await Promise.allSettled(
        Array.from({ length: batchTotal }, (_, i) => runBatch(i)),
      );
      const done = settled
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .sort((a, b) => a.i - b.i);
      if (!done.length) {
        const firstErr = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        if (firstErr) throw firstErr.reason;
      }
      for (const r of done) {
        model = r.model;
        mocked = r.mocked;
        droppedByVerify += r.dropped;
        if (r.i === 0 && r.payload.lessonBlocks.length) merged.lessonBlocks = r.payload.lessonBlocks;
        merged.questions = dedupeQuestions([...merged.questions, ...r.payload.questions]);
        merged.bossQuestions = dedupeQuestions([...merged.bossQuestions, ...r.payload.bossQuestions]);
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

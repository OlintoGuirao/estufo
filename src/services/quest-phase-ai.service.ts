import { generateQuestPhaseContent } from "./quest-phase-ai.fns";
import { questPhaseAiStore } from "./quest-phase-ai-store";
import { getQuestPhase, getQuestSubject } from "@/data/tjsp-quest-catalog";
import { mergePhaseWithAi, type QuestPhaseAiPayload } from "@/lib/tjsp-quest/ai-phase-content";
import type { QuestPhase } from "@/types/tjsp-quest";
import { ApiError } from "./api";

function parseErr(e: unknown): never {
  if (e instanceof Error && e.message.startsWith("{")) {
    try {
      const p = JSON.parse(e.message) as { message?: string; status?: number };
      throw new ApiError(p.message ?? "Erro ao gerar Quest.", p.status ?? 503);
    } catch (inner) {
      if (inner instanceof ApiError) throw inner;
    }
  }
  throw e instanceof Error ? new ApiError(e.message, 503) : new ApiError("Erro ao gerar Quest.", 503);
}

export type QuestPhaseAiResult = {
  phase: QuestPhase;
  content: QuestPhaseAiPayload;
  model: string;
  mocked: boolean;
  fromCache: boolean;
};

export const questPhaseAiService = {
  peekCached(phaseId: string): QuestPhaseAiResult | null {
    const base = getQuestPhase(phaseId);
    const cached = questPhaseAiStore.get(phaseId);
    if (!base || !cached) return null;
    return {
      phase: mergePhaseWithAi(base, cached.content),
      content: cached.content,
      model: cached.model,
      mocked: cached.mocked,
      fromCache: true,
    };
  },

  async ensure(phaseId: string, opts?: { force?: boolean }): Promise<QuestPhaseAiResult> {
    const base = getQuestPhase(phaseId);
    if (!base) throw new ApiError("Fase não encontrada.", 404);

    if (!opts?.force) {
      const hit = this.peekCached(phaseId);
      if (hit) return hit;
    } else {
      questPhaseAiStore.clear(phaseId);
    }

    const subject = getQuestSubject(base.subjectId);
    try {
      const r = await generateQuestPhaseContent({
        data: {
          phaseId: base.id,
          subjectName: subject?.name ?? base.subjectId,
          title: base.title,
          objective: base.objective,
          sources: base.sources.map((s) => ({
            label: s.label,
            ...(s.url ? { url: s.url } : {}),
          })),
        },
      });

      questPhaseAiStore.set({
        phaseId: base.id,
        content: r.content,
        model: r.model,
        mocked: r.mocked,
        savedAt: new Date().toISOString(),
      });

      return {
        phase: mergePhaseWithAi(base, r.content),
        content: r.content,
        model: r.model,
        mocked: r.mocked,
        fromCache: false,
      };
    } catch (e) {
      return parseErr(e);
    }
  },
};

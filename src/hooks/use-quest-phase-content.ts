import { useCallback, useEffect, useState } from "react";
import {
  questPhaseAiService,
  type QuestPhaseAiResult,
} from "@/services/quest-phase-ai.service";
import { questPhaseAiStore } from "@/services/quest-phase-ai-store";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";
import type { QuestPhase } from "@/types/tjsp-quest";

type State = {
  phase: QuestPhase | null;
  loading: boolean;
  error: string | null;
  mocked: boolean;
  fromCache: boolean;
  model: string | null;
};

export function useQuestPhaseContent(phaseId: string): State & {
  regenerate: () => void;
} {
  const [state, setState] = useState<State>(() => {
    const cached = questPhaseAiService.peekCached(phaseId);
    const base = getQuestPhase(phaseId) ?? null;
    if (cached) {
      return {
        phase: cached.phase,
        loading: false,
        error: null,
        mocked: cached.mocked,
        fromCache: true,
        model: cached.model,
      };
    }
    return {
      phase: base,
      loading: !!base,
      error: null,
      mocked: false,
      fromCache: false,
      model: null,
    };
  });

  const load = useCallback(
    async (force: boolean) => {
      const base = getQuestPhase(phaseId);
      if (!base) {
        setState({
          phase: null,
          loading: false,
          error: "Fase não encontrada.",
          mocked: false,
          fromCache: false,
          model: null,
        });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const r: QuestPhaseAiResult = await questPhaseAiService.ensure(phaseId, {
          force,
        });
        setState({
          phase: r.phase,
          loading: false,
          error: null,
          mocked: r.mocked,
          fromCache: r.fromCache,
          model: r.model,
        });
      } catch (e) {
        setState({
          phase: base,
          loading: false,
          error: e instanceof Error ? e.message : "Falha ao gerar conteúdo com IA.",
          mocked: false,
          fromCache: false,
          model: null,
        });
      }
    },
    [phaseId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await questPhaseAiStore.hydrate();
      if (cancelled) return;
      const cached = questPhaseAiService.peekCached(phaseId);
      if (cached) {
        setState({
          phase: cached.phase,
          loading: false,
          error: null,
          mocked: cached.mocked,
          fromCache: true,
          model: cached.model,
        });
        return;
      }
      await load(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [phaseId, load]);

  return {
    ...state,
    regenerate: () => void load(true),
  };
}

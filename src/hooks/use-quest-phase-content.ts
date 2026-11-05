import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  questPhaseAiService,
  type QuestPhaseAiResult,
} from "@/services/quest-phase-ai.service";
import { questPhaseAiStore } from "@/services/quest-phase-ai-store";
import { getQuestPhase } from "@/data/tjsp-quest-catalog";
import { mergePhaseWithAi } from "@/lib/tjsp-quest/ai-phase-content";
import type { QuestPhase } from "@/types/tjsp-quest";

const GENERATE_TIMEOUT_MS = 95_000;

type State = {
  phase: QuestPhase | null;
  loading: boolean;
  error: string | null;
  mocked: boolean;
  fromCache: boolean;
  model: string | null;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function fromCachedEntry(
  phaseId: string,
  cached: NonNullable<Awaited<ReturnType<typeof questPhaseAiStore.loadPhase>>>,
): State {
  const base = getQuestPhase(phaseId);
  return {
    phase: base ? mergePhaseWithAi(base, cached.content) : null,
    loading: false,
    error: null,
    mocked: cached.mocked,
    fromCache: true,
    model: cached.model,
  };
}

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
      // Só “montando” se ainda não há cache — senão parece regenerar a cada visita.
      loading: false,
      error: null,
      mocked: false,
      fromCache: false,
      model: null,
    };
  });

  const genSeq = useRef(0);
  const bootedFor = useRef<string | null>(null);

  const generate = useCallback(
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
      const seq = ++genSeq.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const r: QuestPhaseAiResult = await withTimeout(
          questPhaseAiService.ensure(phaseId, { force }),
          GENERATE_TIMEOUT_MS,
          "Tempo esgotado ao montar o banco. Toque em Regenerar de novo.",
        );
        if (seq !== genSeq.current) return;
        setState({
          phase: r.phase,
          loading: false,
          error: null,
          mocked: r.mocked,
          fromCache: r.fromCache,
          model: r.model,
        });
        if (force) {
          toast.success(
            `Banco atualizado · ${r.phase.questions.length + r.phase.bossQuestions.length} questões`,
          );
        }
      } catch (e) {
        if (seq !== genSeq.current) return;
        const msg =
          e instanceof Error ? e.message : "Falha ao gerar conteúdo com IA.";
        setState((s) => ({
          phase: s.phase ?? base,
          loading: false,
          error: msg,
          mocked: s.mocked,
          fromCache: s.fromCache,
          model: s.model,
        }));
        toast.error(msg);
      }
    },
    [phaseId],
  );

  useEffect(() => {
    let cancelled = false;
    bootedFor.current = phaseId;

    void (async () => {
      // 1) Já tem na sessão?
      const peek = questPhaseAiService.peekCached(phaseId);
      if (peek) {
        if (cancelled) return;
        setState({
          phase: peek.phase,
          loading: false,
          error: null,
          mocked: peek.mocked,
          fromCache: true,
          model: peek.model,
        });
        return;
      }

      // 2) Carrega do Supabase / localStorage — SEM regenerar.
      await questPhaseAiStore.hydrate();
      if (cancelled) return;
      const saved = await questPhaseAiStore.loadPhase(phaseId);
      if (cancelled) return;
      if (saved) {
        setState(fromCachedEntry(phaseId, saved));
        return;
      }

      // 3) Primeira vez nesta fase: gera uma vez e salva.
      if (cancelled) return;
      await generate(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [phaseId, generate]);

  return {
    ...state,
    regenerate: () => void generate(true),
  };
}

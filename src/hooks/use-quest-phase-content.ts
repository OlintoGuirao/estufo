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

// Geração agora roda em paralelo (~1 chamada + 1 verificação); margem para rede lenta no celular.
const GENERATE_TIMEOUT_MS = 130_000;

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
  extending: boolean;
  extend: (need: { desafio: number; boss: number }) => Promise<boolean>;
  prefetch: (need: { desafio: number; boss: number }) => Promise<void>;
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

  const [extending, setExtending] = useState(false);
  /** Busca mais questões para a etapa da trilha que ainda não tem banco. */
  const extend = useCallback(
    async (need: { desafio: number; boss: number }) => {
      setExtending(true);
      try {
        const r = await withTimeout(
          questPhaseAiService.extend(phaseId, need),
          GENERATE_TIMEOUT_MS,
          "Tempo esgotado ao gerar as questões desta trilha. Tente de novo.",
        );
        let added = true;
        setState((s) => {
          const before =
            (s.phase?.questions.length ?? 0) + (s.phase?.bossQuestions.length ?? 0);
          const after = r.phase.questions.length + r.phase.bossQuestions.length;
          added = after > before;
          return {
            ...s,
            phase: r.phase,
            mocked: r.mocked,
            error: added ? null : "A IA não trouxe questões novas desta vez.",
          };
        });
        return added;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao gerar mais questões.";
        setState((s) => ({ ...s, error: msg }));
        toast.error(msg);
        return false;
      } finally {
        setExtending(false);
      }
    },
    [phaseId],
  );

  /**
   * Mesmo que `extend`, mas em segundo plano (sem tela de carregando): enquanto
   * o aluno joga uma trilha, já prepara a próxima. Erros são silenciosos — se
   * falhar, a próxima trilha pede de novo quando o aluno chegar nela.
   */
  const prefetch = useCallback(
    async (need: { desafio: number; boss: number }) => {
      try {
        const r = await questPhaseAiService.extend(phaseId, need);
        setState((s) => {
          const before =
            (s.phase?.questions.length ?? 0) + (s.phase?.bossQuestions.length ?? 0);
          const after = r.phase.questions.length + r.phase.bossQuestions.length;
          return after > before ? { ...s, phase: r.phase, mocked: r.mocked } : s;
        });
      } catch {
        /* silencioso */
      }
    },
    [phaseId],
  );

  return {
    ...state,
    extending,
    extend,
    prefetch,
    regenerate: () => void generate(true),
  };
}

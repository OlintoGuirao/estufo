import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { QuestQuiz } from "@/components/tjsp-quest/quest-quiz";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { canStartChallenge } from "@/lib/tjsp-quest/progress";
import {
  QUEST_SESSION_SIZE,
  sampleQuestions,
} from "@/lib/tjsp-quest/ai-phase-content";
import { useQuestPhaseContent } from "@/hooks/use-quest-phase-content";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import { tjspQuestStore } from "@/services/tjsp-quest-store";

export const Route = createFileRoute("/_area/quest/fase/$phaseId/desafio")({
  component: DesafioPage,
});

function DesafioPage() {
  const { phaseId } = Route.useParams();
  const { phase, loading, error, mocked } = useQuestPhaseContent(phaseId);
  const [player] = useTjspQuest();
  const nav = useNavigate();

  const sessionQuestions = useMemo(
    () =>
      phase
        ? sampleQuestions(phase.questions, QUEST_SESSION_SIZE.desafio)
        : [],
    [phase],
  );

  if (loading) {
    return (
      <QuestShell title="Desafio" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#e85d04]" />
          <p className="font-semibold">Gerando banco de questões VUNESP…</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Em Português isso pode levar um pouco — montamos ~50 questões por fase.
          </p>
        </QuestCard>
      </QuestShell>
    );
  }

  if (!phase) {
    return (
      <QuestShell title="Desafio">
        <QuestCard>{error || "Fase não encontrada."}</QuestCard>
      </QuestShell>
    );
  }

  if (!canStartChallenge(player, phase)) {
    return (
      <QuestShell title="Desafio" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard>
          <p className="font-semibold">Fase bloqueada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua o chefão da fase anterior para liberar estas questões.
          </p>
        </QuestCard>
      </QuestShell>
    );
  }

  return (
    <QuestShell title="Desafio" backTo={`/quest/fase/${phaseId}`}>
      <p className="mb-2 text-center text-[11px] font-semibold text-white/70">
        Sessão: {sessionQuestions.length} de {phase.questions.length} no banco
      </p>
      {mocked && (
        <p className="mb-2 text-center text-[11px] font-semibold text-amber-200">
          Questões demonstrativas (mock) · padrão VUNESP A–E
        </p>
      )}
      <QuestQuiz
        phaseId={phase.id}
        questions={sessionQuestions}
        mode="desafio"
        onFinish={({ pct, xp }) => {
          tjspQuestStore.finishDesafio(phase.id, pct, 0);
          nav({
            to: "/quest/fase/$phaseId/resultado",
            params: { phaseId },
            search: { mode: "desafio", pct, xp },
          });
        }}
      />
    </QuestShell>
  );
}

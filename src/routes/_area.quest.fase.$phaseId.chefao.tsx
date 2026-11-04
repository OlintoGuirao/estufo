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

export const Route = createFileRoute("/_area/quest/fase/$phaseId/chefao")({
  component: ChefaoPage,
});

function ChefaoPage() {
  const { phaseId } = Route.useParams();
  const { phase, loading, error, mocked } = useQuestPhaseContent(phaseId);
  const [player] = useTjspQuest();
  const nav = useNavigate();

  const sessionQuestions = useMemo(
    () =>
      phase
        ? sampleQuestions(phase.bossQuestions, QUEST_SESSION_SIZE.boss)
        : [],
    [phase],
  );

  if (loading) {
    return (
      <QuestShell title="Chefão" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#e85d04]" />
          <p className="font-semibold">Gerando banco do chefão…</p>
        </QuestCard>
      </QuestShell>
    );
  }

  if (!phase) {
    return (
      <QuestShell title="Chefão">
        <QuestCard>{error || "Fase não encontrada."}</QuestCard>
      </QuestShell>
    );
  }

  if (!canStartChallenge(player, phase)) {
    return (
      <QuestShell title="Chefão" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard>
          <p className="font-semibold">Fase bloqueada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua o chefão da fase anterior para liberar.
          </p>
        </QuestCard>
      </QuestShell>
    );
  }

  return (
    <QuestShell title="Chefão" backTo={`/quest/fase/${phaseId}`}>
      <p className="mb-3 text-center text-sm font-bold text-[#ffd60a]">
        Meta: {phase.bossPassPct}% para liberar a próxima fase
      </p>
      <p className="mb-2 text-center text-[11px] font-semibold text-white/70">
        Sessão: {sessionQuestions.length} de {phase.bossQuestions.length} no banco
      </p>
      {mocked && (
        <p className="mb-2 text-center text-[11px] font-semibold text-amber-200">
          Questões demonstrativas (mock) · padrão VUNESP A–E
        </p>
      )}
      <QuestQuiz
        phaseId={phase.id}
        questions={sessionQuestions}
        mode="chefao"
        onFinish={({ pct, xp }) => {
          tjspQuestStore.finishChefao(phase.id, pct, 0);
          nav({
            to: "/quest/fase/$phaseId/resultado",
            params: { phaseId },
            search: { mode: "chefao", pct, xp },
          });
        }}
      />
    </QuestShell>
  );
}

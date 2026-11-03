import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { QuestQuiz } from "@/components/tjsp-quest/quest-quiz";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { canStartChallenge } from "@/lib/tjsp-quest/progress";
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

  if (loading) {
    return (
      <QuestShell title="Desafio" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#e85d04]" />
          <p className="font-semibold">Gerando questões VUNESP com IA…</p>
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
          <p className="font-semibold">Leitura obrigatória pendente</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua todos os blocos obrigatórios do resumo antes de jogar.
          </p>
          <Link
            to="/quest/fase/$phaseId/aula"
            params={{ phaseId }}
            className="mt-3 inline-block text-sm font-bold text-[#e85d04] underline"
          >
            Ir para o resumo
          </Link>
        </QuestCard>
      </QuestShell>
    );
  }

  return (
    <QuestShell title="Desafio" backTo={`/quest/fase/${phaseId}`}>
      {mocked && (
        <p className="mb-2 text-center text-[11px] font-semibold text-amber-200">
          Questões demonstrativas (mock) · padrão VUNESP A–E
        </p>
      )}
      <QuestQuiz
        phaseId={phase.id}
        questions={phase.questions}
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

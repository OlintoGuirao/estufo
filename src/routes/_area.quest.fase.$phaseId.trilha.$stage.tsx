import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QuestQuiz } from "@/components/tjsp-quest/quest-quiz";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import {
  getTrailStageQuestions,
  isTrailStageUnlocked,
  missingForStage,
  PHASE_TRAIL,
  stageNeedsQuestions,
  phaseUsesInnerTrail,
  trailStageCount,
} from "@/lib/tjsp-quest/phase-trail";
import { useQuestPhaseContent } from "@/hooks/use-quest-phase-content";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import { tjspQuestStore } from "@/services/tjsp-quest-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_area/quest/fase/$phaseId/trilha/$stage")({
  component: TrailStagePage,
});

function TrailStagePage() {
  const { phaseId, stage } = Route.useParams();
  const stageIndex = Math.max(0, Number.parseInt(stage, 10) || 0);
  const { phase, loading, error, mocked, extend, extending } = useQuestPhaseContent(phaseId);
  const [player, refresh] = useTjspQuest();
  const nav = useNavigate();
  const [step, setStep] = useState<"practice" | "boss">("practice");
  const [practicePct, setPracticePct] = useState(0);
  const [practiceXp, setPracticeXp] = useState(0);

  const stages = phase ? trailStageCount(phase) : 0;
  const pack = useMemo(
    () => (phase ? getTrailStageQuestions(phase, stageIndex) : null),
    [phase, stageIndex],
  );

  // Etapa sem questões no banco ainda → pede um lote novo à IA (esta + a próxima).
  const needsMore = !!phase && phaseUsesInnerTrail(phase) && stageNeedsQuestions(phase, stageIndex);
  const askedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!phase || loading || extending || !needsMore) return;
    const key = `${phase.id}:${stageIndex}:${phase.questions.length}`;
    if (askedFor.current === key) return; // não repete em loop se a IA falhar
    askedFor.current = key;
    void extend(missingForStage(phase, stageIndex));
  }, [phase, stageIndex, loading, extending, needsMore, extend]);

  if (loading || extending || (needsMore && !error)) {
    return (
      <QuestShell title={`Trilha ${stageIndex + 1}`} backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#e85d04]" />
          <p className="font-semibold">
            {extending || needsMore
              ? `Preparando as questões da trilha ${stageIndex + 1}…`
              : "Carregando etapa…"}
          </p>
          {(extending || needsMore) && (
            <p className="text-xs text-muted-foreground">
              O professor está criando questões novas para você (leva alguns segundos).
            </p>
          )}
        </QuestCard>
      </QuestShell>
    );
  }

  if (needsMore && error && phase) {
    return (
      <QuestShell title={`Trilha ${stageIndex + 1}`} backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="space-y-3 text-center">
          <p className="font-semibold">Não consegui gerar as questões desta trilha agora.</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            onClick={() => {
              askedFor.current = null;
              void extend(missingForStage(phase, stageIndex));
            }}
          >
            Tentar de novo
          </Button>
        </QuestCard>
      </QuestShell>
    );
  }

  if (loading) {
    return (
      <QuestShell title="Trilha" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#e85d04]" />
          <p className="font-semibold">Carregando etapa…</p>
        </QuestCard>
      </QuestShell>
    );
  }

  if (!phase || !pack || !phaseUsesInnerTrail(phase)) {
    return (
      <QuestShell title="Trilha" backTo={`/quest/fase/${phaseId}`}>
        <QuestCard>{error || "Etapa indisponível nesta fase."}</QuestCard>
      </QuestShell>
    );
  }

  const prog = player.phases[phase.id];
  if (!isTrailStageUnlocked(prog, stageIndex)) {
    return (
      <QuestShell title={`Trilha ${stageIndex + 1}`} backTo={`/quest/fase/${phaseId}`}>
        <QuestCard>
          <p className="font-semibold">Etapa bloqueada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua a trilha anterior (com o chefe) para liberar esta.
          </p>
        </QuestCard>
      </QuestShell>
    );
  }

  const isLast = stageIndex >= stages - 1;
  const title =
    step === "boss"
      ? isLast
        ? `Chefão final · ${stageIndex + 1}/${stages}`
        : `Chefe da trilha ${stageIndex + 1}`
      : `Trilha ${stageIndex + 1} · ${pack.practice.length} questões`;

  return (
    <QuestShell title={title} backTo={`/quest/fase/${phaseId}`} world={phase.subjectId}>
      {step === "boss" && (
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-black text-[#ffd60a]">
          <Crown className="h-4 w-4" />
          {isLast ? "Chefão da fase" : "Chefe da trilha"} · meta {PHASE_TRAIL.stagePassPct}%
        </p>
      )}
      {mocked && (
        <p className="mb-2 text-center text-[11px] font-semibold text-amber-200">
          Questões demonstrativas (mock)
        </p>
      )}

      {step === "practice" ? (
        <QuestQuiz
          phaseId={phase.id}
          questions={pack.practice}
          mode="desafio"
          onFinish={({ pct, xp }) => {
            setPracticePct(pct);
            setPracticeXp(xp);
            setStep("boss");
            toast.message("Chefe da trilha liberado!");
          }}
        />
      ) : (
        <QuestQuiz
          phaseId={phase.id}
          questions={pack.boss}
          mode="chefao"
          onFinish={({ pct, xp }) => {
            // Peso: chefe manda na liberação; prática conta no XP da sessão.
            const combined = Math.round(pct * 0.7 + practicePct * 0.3);
            tjspQuestStore.finishTrailStage(
              phase.id,
              stageIndex,
              pct,
              stages,
              PHASE_TRAIL.stagePassPct,
              0,
            );
            refresh();
            const passed = pct >= PHASE_TRAIL.stagePassPct;
            nav({
              to: "/quest/fase/$phaseId/resultado",
              params: { phaseId },
              search: {
                mode: isLast ? "chefao" : "desafio",
                pct: combined,
                xp: practiceXp + xp,
                trail: String(stageIndex + 1),
                passed: passed ? "1" : "0",
              },
            });
          }}
        />
      )}
    </QuestShell>
  );
}

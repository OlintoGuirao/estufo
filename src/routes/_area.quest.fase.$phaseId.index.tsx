import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import {
  QuestModuleHeader,
  QuestPathNode,
  QuestPathStats,
  QuestPathTrail,
  pathOffsetX,
  type PathNodeStatus,
} from "@/components/tjsp-quest/quest-path-map";
import {
  getQuestPhase,
  getQuestSubject,
} from "@/data/tjsp-quest-catalog";
import { canStartChallenge, levelProgress } from "@/lib/tjsp-quest/progress";
import {
  isTrailStageCompleted,
  isTrailStageUnlocked,
  normalizeTrailProgress,
  PHASE_TRAIL,
  phaseUsesInnerTrail,
  trailStageCount,
} from "@/lib/tjsp-quest/phase-trail";
import { useQuestPhaseContent } from "@/hooks/use-quest-phase-content";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";

export const Route = createFileRoute("/_area/quest/fase/$phaseId/")({
  component: PhaseHub,
});

function PhaseHub() {
  const { phaseId } = Route.useParams();
  const nav = useNavigate();
  const catalogPhase = getQuestPhase(phaseId);
  const {
    phase: aiPhase,
    loading,
    mocked,
    regenerate,
  } = useQuestPhaseContent(phaseId);
  const phase = aiPhase ?? catalogPhase;
  const [player] = useTjspQuest();
  const subject = phase ? getQuestSubject(phase.subjectId) : undefined;
  const prog = phase ? player.phases[phase.id] : undefined;
  const challengeOk = phase ? canStartChallenge(player, phase) : false;
  const lp = levelProgress(player.xp);
  const usesTrail = phase ? phaseUsesInnerTrail(phase) : false;
  const stages = phase && usesTrail ? trailStageCount(phase) : 0;
  const trailProg = normalizeTrailProgress(prog);
  const continueStage = Math.min(trailProg.completedCount, Math.max(0, stages - 1));

  if (!phase || !subject) {
    return (
      <QuestShell title="Fase">
        <QuestCard>Fase não encontrada.</QuestCard>
      </QuestShell>
    );
  }

  if (!prog?.unlocked) {
    return (
      <QuestShell title={phase.title} backTo={`/quest/materia/${subject.id}`}>
        <QuestCard>
          <p className="font-semibold">Fase bloqueada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Conclua o chefão da fase anterior com pelo menos {phase.bossPassPct}% de acertos.
          </p>
        </QuestCard>
      </QuestShell>
    );
  }

  return (
    <QuestShell backTo={`/quest/materia/${subject.id}`} className="!pb-4">
      <QuestPathStats streak={player.streakDays} level={lp.level} xp={player.xp} />

      <div className="mb-5">
        <QuestModuleHeader
          eyebrow={subject.name}
          title={`${phase.number}. ${phase.title}`}
          {...(challengeOk && usesTrail
            ? {
                to: "/quest/fase/$phaseId/trilha/$stage",
                params: { phaseId, stage: String(continueStage) },
              }
            : challengeOk
              ? { to: "/quest/fase/$phaseId/desafio", params: { phaseId } }
              : {})}
          accent={subject.color}
        />
        <p className="mt-2 text-center text-[11px] font-semibold text-white/70">
          {usesTrail
            ? `${stages} trilhas · ${PHASE_TRAIL.questionsPerStage} questões + chefe cada · banco ${phase.questions.length + phase.bossQuestions.length}`
            : `Banco: ${phase.questions.length + phase.bossQuestions.length} questões`}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {challengeOk && (
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full bg-[#e85d04] text-xs font-bold text-white hover:bg-[#d00000]"
              disabled={loading}
              onClick={() => {
                if (usesTrail) {
                  void nav({
                    to: "/quest/fase/$phaseId/trilha/$stage",
                    params: { phaseId, stage: String(continueStage) },
                  });
                } else {
                  void nav({ to: "/quest/fase/$phaseId/desafio", params: { phaseId } });
                }
              }}
            >
              {usesTrail ? `Continuar trilha ${continueStage + 1}` : "Começar fase"}
            </Button>
          )}
          {mocked && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200">
              Mock
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
            disabled={loading}
            onClick={() => {
              regenerate();
              toast.message("Gerando novas questões VUNESP…");
            }}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Regenerar
          </Button>
        </div>
        {loading && (
          <p className="mt-2 text-center text-xs text-white/60">Montando banco da fase…</p>
        )}
      </div>

      {usesTrail ? (
        <QuestPathTrail>
          {Array.from({ length: stages }, (_, i) => {
            const unlocked = isTrailStageUnlocked(prog, i);
            const completed = isTrailStageCompleted(prog, i);
            const isLast = i === stages - 1;
            const isCurrent = unlocked && !completed && i === trailProg.completedCount;

            let status: PathNodeStatus = "locked";
            if (isLast) {
              status = completed ? "boss-done" : unlocked ? "boss" : "locked";
            } else if (completed) {
              status = "done";
            } else if (unlocked) {
              status = "available";
            }

            return (
              <QuestPathNode
                key={`trail-${i}`}
                icon={
                  completed && !isLast ? (
                    <Check strokeWidth={3} />
                  ) : isLast ? (
                    <Crown strokeWidth={2.5} />
                  ) : (
                    <span className="text-2xl font-black tabular-nums leading-none">{i + 1}</span>
                  )
                }
                label={isLast ? "Chefão" : String(i + 1)}
                status={status}
                {...(unlocked
                  ? {
                      to: "/quest/fase/$phaseId/trilha/$stage",
                      params: { phaseId, stage: String(i) },
                    }
                  : {})}
                offsetX={pathOffsetX(i)}
                className={
                  isCurrent
                    ? "ring-2 ring-[#ffd60a] ring-offset-2 ring-offset-[#0b1020] rounded-3xl"
                    : undefined
                }
              />
            );
          })}
        </QuestPathTrail>
      ) : (
        <QuestCard className="bg-white/95 text-sm text-muted-foreground">
          Esta fase ainda usa o modo clássico (desafio + chefão). Gere o banco ou abra uma fase de
          Português para a trilha de 10 etapas.
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => void nav({ to: "/quest/fase/$phaseId/desafio", params: { phaseId } })}
            >
              Desafio
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => void nav({ to: "/quest/fase/$phaseId/chefao", params: { phaseId } })}
            >
              Chefão
            </Button>
          </div>
        </QuestCard>
      )}
    </QuestShell>
  );
}

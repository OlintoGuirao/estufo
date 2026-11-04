import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  Crown,
  Loader2,
  Sparkles,
  Swords,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { getQuestPhase, getQuestSubject } from "@/data/tjsp-quest-catalog";
import { canStartChallenge, levelProgress } from "@/lib/tjsp-quest/progress";
import { useQuestPhaseContent } from "@/hooks/use-quest-phase-content";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";

export const Route = createFileRoute("/_area/quest/fase/$phaseId/")({
  component: PhaseHub,
});

type PathStep = {
  id: string;
  label: string;
  icon: LucideIcon;
  status: PathNodeStatus;
  to?: string;
};

function PhaseHub() {
  const { phaseId } = Route.useParams();
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

  const lessonDone = prog.lessonDone;
  const desafioDone = prog.desafioBestPct > 0;
  const chefaoDone = prog.completed;

  const nodes: PathStep[] = [
    {
      id: "desafio",
      label: "Questões",
      icon: Swords,
      status: !challengeOk ? "locked" : desafioDone ? "done" : "available",
      ...(challengeOk ? { to: "/quest/fase/$phaseId/desafio" } : {}),
    },
    {
      id: "chefao",
      label: "Chefão",
      icon: Crown,
      status: !challengeOk ? "locked" : chefaoDone ? "boss-done" : "boss",
      ...(challengeOk ? { to: "/quest/fase/$phaseId/chefao" } : {}),
    },
    {
      id: "dicas",
      label: "Dicas (opcional)",
      icon: BookOpen,
      status: lessonDone ? "done" : "available",
      to: "/quest/fase/$phaseId/aula",
    },
  ];

  return (
    <QuestShell backTo={`/quest/materia/${subject.id}`} className="!pb-4">
      <QuestPathStats streak={player.streakDays} level={lp.level} xp={player.xp} />

      <div className="mb-5">
        <QuestModuleHeader
          eyebrow={subject.name}
          title={`${phase.number}. ${phase.title}`}
          to="/quest/fase/$phaseId/desafio"
          params={{ phaseId }}
          accent={subject.color}
        />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-[#ff9f1c]">
            Questões VUNESP (A–E) · aula opcional
          </span>
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
            Regenerar questões
          </Button>
        </div>
      </div>

      <QuestPathTrail>
        {nodes.map((n, i) => {
          const Icon = n.icon;
          const showCheck = n.status === "done";
          return (
            <QuestPathNode
              key={n.id}
              icon={showCheck ? <Check strokeWidth={3} /> : <Icon />}
              label={n.label}
              status={n.status}
              {...(n.to ? { to: n.to, params: { phaseId } } : {})}
              offsetX={pathOffsetX(i)}
            />
          );
        })}
      </QuestPathTrail>
    </QuestShell>
  );
}

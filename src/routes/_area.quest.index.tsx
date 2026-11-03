import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Calculator,
  Flame,
  Gavel,
  Globe,
  Landmark,
  Monitor,
  PenLine,
  Scale,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestModuleCard } from "@/components/tjsp-quest/quest-module-card";
import { QuestCard, QuestShell, QuestStatPill } from "@/components/tjsp-quest/quest-shell";
import { tjspQuestCatalog } from "@/data/tjsp-quest-catalog";
import { dueReviews, levelProgress } from "@/lib/tjsp-quest/progress";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import type { QuestSubject } from "@/types/tjsp-quest";

export const Route = createFileRoute("/_area/quest/")({
  head: () => ({
    meta: [
      { title: "TJSP Quest — Estufoo" },
      {
        name: "description",
        content: "Estude a legislação em fases gamificadas, estilo perguntas e respostas.",
      },
    ],
  }),
  component: QuestHome,
});

const SUBJECT_ICONS: Record<QuestSubject["icon"], LucideIcon> = {
  scale: Scale,
  monitor: Monitor,
  calculator: Calculator,
  book: BookOpen,
  gavel: Gavel,
  landmark: Landmark,
  pen: PenLine,
  globe: Globe,
};

function QuestHome() {
  const [player] = useTjspQuest();
  const lp = levelProgress(player.xp);
  const pending = dueReviews(player);
  const continuePhase =
    tjspQuestCatalog.phases.find(
      (p) => player.phases[p.id]?.unlocked && !player.phases[p.id]?.completed,
    ) ?? tjspQuestCatalog.phases[0];
  const currentSubjectId = continuePhase?.subjectId;

  return (
    <QuestShell title="TJSP Quest" backTo="/painel">
      <div className="mb-5 grid grid-cols-4 gap-2">
        <QuestStatPill label="Nível" value={lp.level} />
        <QuestStatPill label="XP" value={player.xp} accent="#00b4d8" />
        <QuestStatPill label="Streak" value={`${player.streakDays}d`} accent="#ef476f" />
        <QuestStatPill label="Revisões" value={pending.length} accent="#06d6a0" />
      </div>

      <QuestCard className="mb-5 overflow-hidden bg-gradient-to-br from-[#ff9f1c] to-[#e85d04] text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">
          Continuar estudando
        </p>
        <h2 className="mt-1 font-display text-2xl font-black leading-tight">
          {continuePhase?.title ?? "Escolha uma matéria"}
        </h2>
        <p className="mt-1 text-sm text-white/90">
          {continuePhase
            ? `Fase ${continuePhase.number} · ~${continuePhase.estimatedMinutes} min`
            : "Comece pelo Constitucional"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {continuePhase && (
            <Button asChild className="rounded-full bg-white font-bold text-[#e85d04] hover:bg-white/90">
              <Link to="/quest/fase/$phaseId" params={{ phaseId: continuePhase.id }}>
                <Swords className="h-4 w-4" />
                Jogar agora
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="rounded-full border-white/40 bg-transparent font-bold text-white hover:bg-white/10"
          >
            <Link to="/quest/revisao">
              <BookOpen className="h-4 w-4" />
              Revisões ({pending.length})
            </Link>
          </Button>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-white/80">
            <span>Nível {lp.level}</span>
            <span>
              {lp.into}/{lp.need} XP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${lp.pct}%` }} />
          </div>
        </div>
      </QuestCard>

      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
        <Sparkles className="h-4 w-4 text-[#ff9f1c]" />
        Matérias
      </p>

      <div className="flex flex-col gap-3">
        {tjspQuestCatalog.subjects.map((s) => {
          const phases = tjspQuestCatalog.phases.filter((p) => p.subjectId === s.id);
          const done = phases.filter((p) => player.phases[p.id]?.completed).length;
          const Icon = SUBJECT_ICONS[s.icon] ?? BookOpen;
          return (
            <QuestModuleCard
              key={s.id}
              title={s.name}
              description={s.description}
              icon={<Icon />}
              accent={s.color}
              progressFilled={done}
              progressTotal={Math.max(phases.length, 1)}
              isCurrent={s.id === currentSubjectId}
              to="/quest/materia/$subjectId"
              params={{ subjectId: s.id }}
            />
          );
        })}
      </div>

      <p className="mt-6 mb-2 flex items-center gap-2 text-sm font-bold text-white">
        <Trophy className="h-4 w-4 text-[#ffd60a]" />
        Conquistas
      </p>
      <QuestCard className="bg-white/95">
        {player.achievements.length ? (
          <ul className="space-y-2 text-sm">
            {player.achievements.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-[#e85d04]" />
                {a.startsWith("phase:") ? `Fase concluída: ${a.replace("phase:", "")}` : a}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Complete o chefão de uma fase para ganhar sua primeira medalha.
          </p>
        )}
      </QuestCard>
    </QuestShell>
  );
}

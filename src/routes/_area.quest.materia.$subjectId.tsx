import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check, Crown, Scale, Swords } from "lucide-react";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import {
  QuestModuleHeader,
  QuestPathNode,
  QuestPathStats,
  QuestPathTrail,
  pathOffsetX,
  type PathNodeStatus,
} from "@/components/tjsp-quest/quest-path-map";
import { getQuestSubject, phasesForSubject } from "@/data/tjsp-quest-catalog";
import { levelProgress } from "@/lib/tjsp-quest/progress";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";

export const Route = createFileRoute("/_area/quest/materia/$subjectId")({
  component: SubjectMap,
});

const PHASE_ICONS = [BookOpen, Scale, Swords, BookOpen, Scale] as const;

function SubjectMap() {
  const { subjectId } = Route.useParams();
  const subject = getQuestSubject(subjectId);
  const phases = phasesForSubject(subjectId);
  const [player] = useTjspQuest();
  const lp = levelProgress(player.xp);

  if (!subject) {
    return (
      <QuestShell title="Matéria">
        <QuestCard>Matéria não encontrada.</QuestCard>
      </QuestShell>
    );
  }

  const continuePhase =
    phases.find((p) => player.phases[p.id]?.unlocked && !player.phases[p.id]?.completed) ??
    phases.find((p) => player.phases[p.id]?.unlocked) ??
    phases[0];

  return (
    <QuestShell backTo="/quest" className="!pb-4">
      <QuestPathStats streak={player.streakDays} level={lp.level} xp={player.xp} />

      <div className="mb-5">
        {continuePhase ? (
          <QuestModuleHeader
            eyebrow={subject.name}
            title={`${continuePhase.number}. ${continuePhase.title}`}
            to="/quest/fase/$phaseId"
            params={{ phaseId: continuePhase.id }}
            accent={subject.color}
          />
        ) : (
          <QuestModuleHeader
            eyebrow={subject.name}
            title={subject.shortName}
            accent={subject.color}
          />
        )}
      </div>

      <QuestPathTrail>
        {phases.map((p, i) => {
          const prog = player.phases[p.id];
          const unlocked = prog?.unlocked ?? false;
          const completed = prog?.completed ?? false;
          const isLast = i === phases.length - 1;
          const Icon = isLast ? Crown : PHASE_ICONS[i % PHASE_ICONS.length]!;

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
              key={p.id}
              icon={completed && !isLast ? <Check strokeWidth={3} /> : <Icon />}
              label={`Fase ${p.number}`}
              status={status}
              {...(unlocked
                ? { to: "/quest/fase/$phaseId", params: { phaseId: p.id } }
                : {})}
              offsetX={pathOffsetX(i)}
            />
          );
        })}
      </QuestPathTrail>
    </QuestShell>
  );
}

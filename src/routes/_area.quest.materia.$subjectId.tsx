import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import {
  QuestModuleHeader,
  QuestPathNode,
  QuestPathTrail,
  pathOffsetX,
  type PathNodeStatus,
} from "@/components/tjsp-quest/quest-path-map";
import {
  characterEmoji,
  GameHud,
  MascotSays,
  starsFromPct,
  worldTheme,
} from "@/components/tjsp-quest/game-ui";
import { getQuestSubject, phasesForSubject } from "@/data/tjsp-quest-catalog";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";
import type { QuestPhaseProgress } from "@/types/tjsp-quest";

export const Route = createFileRoute("/_area/quest/materia/$subjectId")({
  component: SubjectMap,
});

/** Melhor resultado da fase (chefão, desafio ou trilhas). */
function bestPct(prog: QuestPhaseProgress | undefined): number {
  if (!prog) return 0;
  return Math.max(prog.chefaoBestPct ?? 0, prog.desafioBestPct ?? 0, ...(prog.trailStageBestPct ?? [0]));
}

function SubjectMap() {
  const { subjectId } = Route.useParams();
  const subject = getQuestSubject(subjectId);
  const phases = phasesForSubject(subjectId);
  const [player] = useTjspQuest();
  const theme = worldTheme(subjectId);

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
  const doneCount = phases.filter((p) => player.phases[p.id]?.completed).length;
  const avatar = characterEmoji(player);

  return (
    <QuestShell
      backTo="/quest"
      world={subjectId}
      className="!pb-4"
      top={<GameHud player={player} />}
    >
      <div className="mb-2 text-center text-white">
        <p className="text-4xl">{theme.emoji}</p>
        <h1 className="text-3xl font-extrabold" style={{ textShadow: "0 3px 0 rgba(0,0,0,.2)" }}>
          {theme.name}
        </h1>
        <p className="text-sm font-bold text-white/85">
          {subject.name} · {doneCount}/{phases.length} fases
        </p>
      </div>

      {continuePhase && (
        <div className="mb-2">
          <QuestModuleHeader
            eyebrow="Próxima parada"
            title={`${continuePhase.number}. ${continuePhase.title}`}
            to="/quest/fase/$phaseId"
            params={{ phaseId: continuePhase.id }}
            accent={subject.color}
          />
        </div>
      )}

      <QuestPathTrail doneCount={doneCount}>
        {phases.map((p, i) => {
          const prog = player.phases[p.id];
          const unlocked = prog?.unlocked ?? false;
          const completed = prog?.completed ?? false;
          const isLast = i === phases.length - 1;

          let status: PathNodeStatus = "locked";
          if (isLast) status = completed ? "boss-done" : unlocked ? "boss" : "locked";
          else if (completed) status = "done";
          else if (unlocked) status = "available";

          return (
            <QuestPathNode
              key={p.id}
              icon={
                completed && !isLast ? (
                  <Check strokeWidth={4} />
                ) : isLast ? (
                  <Crown strokeWidth={2.5} />
                ) : (
                  <span className="text-3xl font-extrabold leading-none">{p.number}</span>
                )
              }
              label={isLast && !/^chef/i.test(p.title) ? `Chefão · ${p.title}` : p.title}
              boss={isLast}
              status={status}
              stars={starsFromPct(bestPct(prog))}
              current={p.id === continuePhase?.id && unlocked && !completed}
              avatar={avatar}
              {...(unlocked ? { to: "/quest/fase/$phaseId", params: { phaseId: p.id } } : {})}
              offsetX={pathOffsetX(i)}
            />
          );
        })}
      </QuestPathTrail>

      <MascotSays mood={doneCount ? "cheer" : "wave"} className="mx-auto max-w-sm">
        {doneCount
          ? `Já são ${doneCount} fase(s) vencida(s) neste mundo. Bora pela próxima!`
          : "Toque na primeira fase para começar a aventura!"}
      </MascotSays>
    </QuestShell>
  );
}

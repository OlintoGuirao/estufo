import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import {
  Confetti,
  GameHud,
  GameLinkButton,
  Mascot,
  Stars,
  gameSound,
  starsFromPct,
} from "@/components/tjsp-quest/game-ui";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { getQuestPhase, getQuestSubject } from "@/data/tjsp-quest-catalog";
import { PHASE_TRAIL, phaseUsesInnerTrail } from "@/lib/tjsp-quest/phase-trail";
import { useQuestPhaseContent } from "@/hooks/use-quest-phase-content";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";

const searchSchema = z.object({
  mode: z.enum(["desafio", "chefao"]).catch("desafio"),
  pct: z.coerce.number().min(0).max(100).catch(0),
  xp: z.coerce.number().min(0).catch(0),
  trail: z.string().optional(),
  passed: z.string().optional(),
});

export const Route = createFileRoute("/_area/quest/fase/$phaseId/resultado")({
  validateSearch: searchSchema,
  component: ResultPage,
});

function ResultPage() {
  const { phaseId } = Route.useParams();
  const { mode, pct, xp, trail, passed: passedParam } = Route.useSearch();
  const catalogPhase = getQuestPhase(phaseId);
  const { phase: aiPhase } = useQuestPhaseContent(phaseId);
  const phase = aiPhase ?? catalogPhase;
  const subject = phase ? getQuestSubject(phase.subjectId) : undefined;
  const [player] = useTjspQuest();
  const prog = phase ? player.phases[phase.id] : undefined;
  const trailIndex = trail ? Math.max(0, Number.parseInt(trail, 10) - 1) : null;
  const usesTrail = phase ? phaseUsesInnerTrail(phase) : false;
  const passed =
    passedParam === "1"
      ? true
      : passedParam === "0"
        ? false
        : mode === "chefao" && phase
          ? pct >= phase.bossPassPct
          : pct >= 60;

  if (!phase || !subject) {
    return (
      <QuestShell title="Resultado">
        <QuestCard>Fase não encontrada.</QuestCard>
      </QuestShell>
    );
  }

  const retryTo =
    usesTrail && trailIndex != null
      ? {
          to: "/quest/fase/$phaseId/trilha/$stage" as const,
          params: { phaseId, stage: String(trailIndex) },
        }
      : mode === "chefao"
        ? { to: "/quest/fase/$phaseId/chefao" as const, params: { phaseId } }
        : { to: "/quest/fase/$phaseId/desafio" as const, params: { phaseId } };

  const nextTrail =
    usesTrail && trailIndex != null && passed
      ? {
          to: "/quest/fase/$phaseId/trilha/$stage" as const,
          params: { phaseId, stage: String(trailIndex + 1) },
        }
      : null;

  const stars = passed ? Math.max(1, starsFromPct(pct)) : starsFromPct(pct);

  return (
    <QuestShell backTo={`/quest/fase/${phaseId}`} world={subject.id} top={<GameHud player={player} />}>
      <ResultCelebration passed={passed} />
      <div className="flex flex-col items-center text-center text-white">
        <p className="text-sm font-extrabold uppercase tracking-widest text-white/85">
          {trail
            ? `Trilha ${trail}${mode === "chefao" ? " · Chefe" : ""}`
            : mode === "chefao"
              ? "Chefão"
              : "Desafio"}{" "}
          · {phase.title}
        </p>
        <h1
          className="q-pop mt-1 text-5xl font-extrabold"
          style={{ textShadow: "0 4px 0 rgba(0,0,0,.2)" }}
        >
          {passed ? "Vitória!" : "Quase lá!"}
        </h1>
        <Stars count={stars} size={44} className="mt-3" animate />
        <Mascot mood={passed ? "cheer" : "sad"} size={110} className="mt-2 drop-shadow-xl" />
      </div>

      <QuestCard className="mt-2 text-center">
        <p className="text-6xl font-extrabold text-[#2b2d42]">{pct}%</p>
        <p className="mt-1 text-sm font-bold text-[#5c677d]">
          {trail
            ? passed
              ? prog?.completed
                ? "Fase concluída! Próxima fase liberada."
                : `Trilha ${trail} concluída — a próxima foi liberada.`
              : `Faltou pouco: a meta do chefe é ${PHASE_TRAIL.stagePassPct}%.`
            : mode === "chefao"
              ? passed
                ? "Fase concluída! Próximas etapas desbloqueadas."
                : `Meta ${phase.bossPassPct}% não atingida — revise e tente de novo.`
              : passed
                ? "Bom desempenho! Encara o chefão?"
                : "Revise os erros e jogue de novo."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#fff3c4] p-3">
            <p className="text-3xl font-extrabold text-[#b8860b]">+{xp}</p>
            <p className="text-xs font-extrabold uppercase text-[#7a5c00]">⭐ XP</p>
          </div>
          <div className="q-chest rounded-2xl bg-[#ffe0ec] p-3">
            <p className="text-3xl font-extrabold text-[#c9184a]">+{xp}</p>
            <p className="text-xs font-extrabold uppercase text-[#7a1037]">🪙 Moedas</p>
          </div>
        </div>
      </QuestCard>

      <div className="mt-5 space-y-4">
        {nextTrail && !prog?.completed ? (
          <GameLinkButton to={nextTrail.to} params={nextTrail.params} color="#06d6a0" shadow="#04a37a">
            Próxima trilha ➜
          </GameLinkButton>
        ) : (
          <GameLinkButton to="/quest/fase/$phaseId" params={{ phaseId }} color="#3a86ff" shadow="#2459b3">
            Voltar ao mapa 🗺️
          </GameLinkButton>
        )}
        <GameLinkButton to={retryTo.to} params={retryTo.params} color="#ffffff" shadow="#d0d4dc" className="!text-[#2b2d42]">
          Jogar de novo ↻
        </GameLinkButton>
        <GameLinkButton to="/quest/revisao" color="#8338ec" shadow="#5a22a8">
          Revisar meus erros
        </GameLinkButton>
      </div>
    </QuestShell>
  );
}

/** Confete e som de vitória ao abrir o resultado. */
function ResultCelebration({ passed }: { passed: boolean }) {
  const [fire, setFire] = useState(0);
  useEffect(() => {
    if (passed) {
      gameSound.win();
      setFire(1);
    } else {
      gameSound.wrong();
    }
  }, [passed]);
  return <Confetti fire={fire} pieces={90} />;
}

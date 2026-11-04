import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Crown, RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <QuestShell title="Resultado" backTo={`/quest/fase/${phaseId}`}>
      <QuestCard
        className={
          passed
            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
            : "bg-gradient-to-br from-rose-500 to-orange-600 text-white"
        }
      >
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">
          {trail
            ? `Trilha ${trail}${mode === "chefao" ? " · Chefe" : ""}`
            : mode === "chefao"
              ? "Chefão"
              : "Desafio"}{" "}
          · {phase.title}
        </p>
        <p className="mt-2 font-display text-5xl font-black">{pct}%</p>
        <p className="mt-1 text-sm text-white/90">
          {trail
            ? passed
              ? prog?.completed
                ? "Fase concluída! Próxima matéria/fase liberada."
                : `Trilha ${trail} concluída — próxima liberada.`
              : `Meta ${PHASE_TRAIL.stagePassPct}% no chefe não atingida — tente de novo.`
            : mode === "chefao"
              ? passed
                ? `Fase concluída! Próximas etapas desbloqueadas.`
                : `Meta ${phase.bossPassPct}% não atingida — revise e tente de novo.`
              : passed
                ? "Bom desempenho no desafio. Encara o chefão?"
                : "Revise os erros e jogue de novo."}
        </p>
        <p className="mt-3 text-lg font-black text-[#ffd60a]">+{xp} XP nesta rodada</p>
        <p className="text-xs text-white/80">
          Total: {player.xp} XP · Nível {player.level} · Streak {player.streakDays}d
        </p>
      </QuestCard>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild className="h-12 rounded-2xl bg-white font-bold text-[#0b132b]">
          <Link to={retryTo.to} params={retryTo.params}>
            <RotateCcw className="h-4 w-4" />
            Tentar de novo
          </Link>
        </Button>
        {nextTrail && !prog?.completed ? (
          <Button asChild className="h-12 rounded-2xl bg-[#9b2226] font-bold text-white">
            <Link to={nextTrail.to} params={nextTrail.params}>
              <Crown className="h-4 w-4" />
              Próxima trilha
            </Link>
          </Button>
        ) : (
          <Button asChild className="h-12 rounded-2xl bg-[#0077b6] font-bold text-white">
            <Link to="/quest/fase/$phaseId" params={{ phaseId }}>
              <Swords className="h-4 w-4" />
              Ver trilha da fase
            </Link>
          </Button>
        )}
      </div>

      <QuestCard className="mt-4">
        <p className="text-sm font-semibold">Desempenho nesta fase</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {usesTrail ? (
            <li>
              Trilhas concluídas: {prog?.trailCompletedCount ?? 0} / {PHASE_TRAIL.stages}
            </li>
          ) : null}
          <li>Melhor desafio: {prog?.desafioBestPct ?? 0}%</li>
          <li>Melhor chefão: {prog?.chefaoBestPct ?? 0}%</li>
          <li>Status: {prog?.completed ? "Concluída" : "Em progresso"}</li>
        </ul>
        <Button asChild variant="outline" className="mt-3 w-full rounded-xl">
          <Link to="/quest/revisao">Abrir revisão de erros</Link>
        </Button>
      </QuestCard>
    </QuestShell>
  );
}

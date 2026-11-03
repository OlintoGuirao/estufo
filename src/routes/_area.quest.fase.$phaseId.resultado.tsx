import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Crown, RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestCard, QuestShell } from "@/components/tjsp-quest/quest-shell";
import { getQuestPhase, getQuestSubject } from "@/data/tjsp-quest-catalog";
import { useTjspQuest } from "@/hooks/use-tjsp-quest";

const searchSchema = z.object({
  mode: z.enum(["desafio", "chefao"]).catch("desafio"),
  pct: z.coerce.number().min(0).max(100).catch(0),
  xp: z.coerce.number().min(0).catch(0),
});

export const Route = createFileRoute("/_area/quest/fase/$phaseId/resultado")({
  validateSearch: searchSchema,
  component: ResultPage,
});

function ResultPage() {
  const { phaseId } = Route.useParams();
  const { mode, pct, xp } = Route.useSearch();
  const phase = getQuestPhase(phaseId);
  const subject = phase ? getQuestSubject(phase.subjectId) : undefined;
  const [player] = useTjspQuest();
  const prog = phase ? player.phases[phase.id] : undefined;
  const passed = mode === "chefao" && phase ? pct >= phase.bossPassPct : pct >= 60;

  if (!phase || !subject) {
    return (
      <QuestShell title="Resultado">
        <QuestCard>Fase não encontrada.</QuestCard>
      </QuestShell>
    );
  }

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
          {mode === "chefao" ? "Chefão" : "Desafio"} · {phase.title}
        </p>
        <p className="mt-2 font-display text-5xl font-black">{pct}%</p>
        <p className="mt-1 text-sm text-white/90">
          {mode === "chefao"
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
          <Link
            to={mode === "chefao" ? "/quest/fase/$phaseId/chefao" : "/quest/fase/$phaseId/desafio"}
            params={{ phaseId }}
          >
            <RotateCcw className="h-4 w-4" />
            Tentar de novo
          </Link>
        </Button>
        {mode === "desafio" ? (
          <Button asChild className="h-12 rounded-2xl bg-[#9b2226] font-bold text-white">
            <Link to="/quest/fase/$phaseId/chefao" params={{ phaseId }}>
              <Crown className="h-4 w-4" />
              Ir ao chefão
            </Link>
          </Button>
        ) : (
          <Button asChild className="h-12 rounded-2xl bg-[#0077b6] font-bold text-white">
            <Link to="/quest/materia/$subjectId" params={{ subjectId: subject.id }}>
              <Swords className="h-4 w-4" />
              Mapa da matéria
            </Link>
          </Button>
        )}
      </div>

      <QuestCard className="mt-4">
        <p className="text-sm font-semibold">Desempenho nesta fase</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
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

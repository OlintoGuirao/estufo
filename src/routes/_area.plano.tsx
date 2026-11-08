import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Play, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuestionPractice } from "@/components/question-practice";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { RECURRING_MIN } from "@/lib/study-plan-diagnostic";
import { cn } from "@/lib/utils";
import { studyPlanDiagnosticService } from "@/services/study-plan-diagnostic.service";
import { tjspBancoCatalog } from "@/services/tjsp-banco.catalog";
import { topicPracticeStats } from "@/services/topic-practice-stats";
import type { DiagnosticRun } from "@/types/diagnostic";
import type { Question } from "@/types";

/** Até 20 do banco de 100 por matéria (erros do diagnóstico primeiro). */
const PRACTICE_SIZE = 20;
const STATS_KEY = ["topic-practice-stats"] as const;

export const Route = createFileRoute("/_area/plano")({
  head: () => ({
    meta: [
      { title: "Cronograma — Estufoo" },
      { name: "description", content: "Foco de estudo por tópico, a partir dos erros do diagnóstico." },
      { property: "og:title", content: "Cronograma — Estufoo" },
      { property: "og:description", content: "Foco de estudo por tópico, a partir dos erros do diagnóstico." },
    ],
  }),
  component: Plan,
});

type TopicCard = {
  subject: string;
  topic: string;
  wrongCount: number;
  totalInTopic: number;
  poolSize: number;
  recurring: boolean;
  questions: Question[];
  previews: { id: string; statement: string; yourKey: string; correctKey: string }[];
};

function buildTopicCards(run: DiagnosticRun): TopicCard[] {
  const byId = new Map(run.questions.map((q) => [q.id, q]));
  const wrong = run.answers.filter((a) => !a.correct);
  const map = new Map<string, TopicCard>();

  for (const a of wrong) {
    const key = `${a.subject}::${a.topic}`;
    const q = byId.get(a.questionId);
    if (!q) continue;
    const cur =
      map.get(key) ??
      ({
        subject: a.subject,
        topic: a.topic,
        wrongCount: 0,
        totalInTopic: 0,
        poolSize: 0,
        recurring: false,
        questions: [],
        previews: [],
      } satisfies TopicCard);

    cur.wrongCount += 1;
    cur.previews.push({
      id: a.questionId,
      statement: q.statement,
      yourKey: a.choice,
      correctKey: a.correctKey,
    });
    map.set(key, cur);
  }

  for (const card of map.values()) {
    card.totalInTopic = run.answers.filter(
      (a) => a.subject === card.subject && a.topic === card.topic,
    ).length;
    card.recurring = card.wrongCount >= RECURRING_MIN;
    card.poolSize = tjspBancoCatalog.countBySubjectLabel(card.subject);
    card.questions = [];
  }

  return [...map.values()].sort(
    (a, b) => b.wrongCount - a.wrongCount || a.subject.localeCompare(b.subject),
  );
}

function practicePoolFor(card: TopicCard): Question[] {
  // Só banco 400 — nunca as questões da prova diagnóstica.
  return tjspBancoCatalog.listForPractice(card.subject, {
    limit: PRACTICE_SIZE,
    excludeStatements: card.previews.map((p) => p.statement),
  });
}

function Plan() {
  const qc = useQueryClient();
  const [active, setActive] = useState<TopicCard | null>(null);
  const [live, setLive] = useState({ answered: 0, wrong: 0, errorPct: 0 });

  const diagQ = useQuery({
    queryKey: ["study-plan-diagnostic"],
    queryFn: () => studyPlanDiagnosticService.hydrate(),
  });

  const statsTick = useQuery({
    queryKey: STATS_KEY,
    queryFn: async () => Date.now(),
    staleTime: 0,
  });

  const run = diagQ.data;
  const finished = !!run?.finishedAt && !!run.analysis;
  const cards = useMemo(
    () => (finished && run ? buildTopicCards(run) : []),
    [finished, run],
  );
  const top = cards[0];

  if (diagQ.isLoading) return <ListSkeleton />;
  if (diagQ.error) return <ErrorState error={diagQ.error} onRetry={diagQ.refetch} />;

  if (active) {
    return (
      <>
        <PageHeader
          title={active.subject}
          description={`${active.questions.length} questões do banco (não da prova diagnóstica) · % atualiza a cada resposta`}
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setActive(null);
                qc.invalidateQueries({ queryKey: STATS_KEY });
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar aos cards
            </Button>
          }
        />
        <QuestionPractice
          title={`${active.subject} · prática`}
          questions={active.questions}
          liveErrorPct={live.errorPct}
          liveAnswered={live.answered}
          liveWrong={live.wrong}
          errorOrigin="plano"
          errorSourceLabel={`Plano · ${active.subject}`}
          onAnswer={({ correct }) => {
            const next = topicPracticeStats.recordAnswer(active.subject, correct);
            setLive({
              answered: next.sessionAnswered,
              wrong: next.sessionWrong,
              errorPct: next.sessionErrorPct,
            });
            qc.invalidateQueries({ queryKey: STATS_KEY });
            if (!correct) qc.invalidateQueries({ queryKey: ["error-notes"] });
          }}
          onDone={() => {
            setActive(null);
            qc.invalidateQueries({ queryKey: STATS_KEY });
          }}
          doneLabel="Voltar ao cronograma"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cronograma"
        description={
          finished
            ? "Cada card mostra a % de erro do tópico — ela atualiza conforme você pratica."
            : "Faça o diagnóstico em Plano de estudo para montar seu foco por tópico."
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/questoes">
              <Play className="h-4 w-4" />
              {finished ? "Novo diagnóstico" : "Iniciar estudo"}
            </Link>
          </Button>
        }
      />

      {!finished ? (
        <Panel className="mx-auto max-w-xl space-y-4 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Ainda sem foco definido</h2>
          <p className="text-sm text-muted-foreground">
            Depois da prova diagnóstica, os tópicos aparecem aqui com a porcentagem de erro.
          </p>
          <Button asChild>
            <Link to="/questoes">Ir para Plano de estudo</Link>
          </Button>
        </Panel>
      ) : cards.length === 0 ? (
        <EmptyState
          title="Nenhum erro no diagnóstico"
          description="Parabéns — sem tópicos fracos desta vez. Refaça quando quiser reforçar."
          action={
            <Button asChild>
              <Link to="/questoes">Novo diagnóstico</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {run.analysis && (
            <Panel className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline">{run.provaTitle ?? "Diagnóstico"}</Badge>
              <span className="text-muted-foreground">
                {run.analysis.correct} acertos · {run.analysis.wrong} erros · {run.analysis.accuracyPct}%
              </span>
              {top && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Mais errou: {top.subject}
                </span>
              )}
            </Panel>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" key={statsTick.data}>
            {cards.map((card, i) => (
              <TopicStudyCard
                key={`${card.subject}-${card.topic}`}
                card={card}
                rank={i + 1}
                onOpen={() => {
                  topicPracticeStats.startSession(card.subject);
                  const baseline = topicPracticeStats.displayErrorPct(card.subject, {
                    wrong: card.wrongCount,
                    total: card.totalInTopic,
                  });
                  setLive({
                    answered: 0,
                    wrong: 0,
                    errorPct: baseline.errorPct,
                  });
                  setActive({
                    ...card,
                    questions: practicePoolFor(card),
                  });
                  qc.invalidateQueries({ queryKey: STATS_KEY });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function TopicStudyCard({
  card,
  rank,
  onOpen,
}: {
  card: TopicCard;
  rank: number;
  onOpen: () => void;
}) {
  const isTop = rank === 1;
  const disp = topicPracticeStats.displayErrorPct(card.subject, {
    wrong: card.wrongCount,
    total: card.totalInTopic,
  });
  const high = disp.errorPct >= 50;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors",
        "hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isTop && "border-destructive/35 ring-1 ring-destructive/15",
        card.recurring && !isTop && "border-destructive/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {isTop ? "Prioridade #1 · mais erros" : `Tópico #${rank}`}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-snug">{card.subject}</h3>
          {card.topic !== card.subject && (
            <p className="text-sm text-muted-foreground">{card.topic}</p>
          )}
        </div>
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-center",
            high ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
          )}
        >
          <p className="text-2xl font-bold tabular-nums leading-none">{disp.errorPct}%</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">erro</p>
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Origem</span>
          <span className="font-medium">
            {disp.source === "pratica" ? "Prática" : "Diagnóstico"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Respondidas</span>
          <span className="font-medium tabular-nums">
            {disp.wrong}/{disp.answered} erradas
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Prática</span>
          <span className="font-medium">
            até {Math.min(PRACTICE_SIZE, card.poolSize)} questões
          </span>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", high ? "bg-destructive" : "bg-[#1a3d32] dark:bg-emerald-700")}
          style={{ width: `${Math.min(100, disp.errorPct)}%` }}
        />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-highlight" />
        Abrir prática · a % atualiza a cada resposta
      </div>
    </button>
  );
}

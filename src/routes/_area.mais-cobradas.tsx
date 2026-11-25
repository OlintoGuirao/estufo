import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Flame, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common";
import { QuestionPractice } from "@/components/question-practice";
import { cn } from "@/lib/utils";
import {
  VUNESP_PROVA_YEARS,
  areaTotals,
  pickTopTopicQuestionIds,
  rankHotTopics,
  topicProgress,
  type HotTopic,
} from "@/lib/vunesp-hot-topics";
import { localQuestionState } from "@/services/local-question-state";
import { tjspOfficialProvasCatalog } from "@/services/tjsp-official-provas.catalog";
import type { Question } from "@/types";

export const Route = createFileRoute("/_area/mais-cobradas")({
  head: () => ({
    meta: [
      { title: "Mais cobradas em Direito — Estufoo" },
      {
        name: "description",
        content: "Assuntos de Direito que a VUNESP mais cobrou nas provas de Escrevente TJSP.",
      },
      { property: "og:title", content: "Mais cobradas em Direito — Estufoo" },
      {
        property: "og:description",
        content: "Assuntos de Direito que a VUNESP mais cobrou nas provas de Escrevente TJSP.",
      },
    ],
  }),
  component: HotTopicsPage,
});

type Practice = { title: string; questions: Question[] };

function HotTopicsPage() {
  const [areaId, setAreaId] = useState<string | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  // Força recálculo do "você acertou" ao voltar da prática.
  const [tick, setTick] = useState(0);

  const areas = useMemo(() => areaTotals(), []);
  const topics = useMemo(() => rankHotTopics(undefined, areaId), [areaId]);
  const totalQuestions = areas.reduce((n, a) => n + a.count, 0);
  const maxCount = topics[0]?.count ?? 1;

  const progressById = useMemo(() => {
    const get = (id: string) => localQuestionState.get(id).answered;
    return new Map(topics.map((t) => [t.id, topicProgress(t, get)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, tick]);

  const start = (title: string, ids: string[]) => {
    const questions = tjspOfficialProvasCatalog
      .listByIds(ids)
      .map((q) => ({ ...q, answered: null }));
    if (!questions.length) {
      toast.error("Não há questões disponíveis para este assunto.");
      return;
    }
    setPractice({ title, questions });
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    setPractice(null);
    setTick((n) => n + 1);
  };

  if (practice) {
    return (
      <>
        <PageHeader
          title={practice.title}
          description={`${practice.questions.length} questões reais da VUNESP (provas de Escrevente TJSP)`}
          actions={
            <Button variant="outline" onClick={back}>
              <ArrowLeft />
              Voltar ao ranking
            </Button>
          }
        />
        <QuestionPractice
          questions={practice.questions}
          errorOrigin="local"
          errorSourceLabel={`Mais cobradas · ${practice.title}`}
          onDone={back}
          doneLabel="Voltar ao ranking"
        />
      </>
    );
  }

  const areaLabel = areaId ? areas.find((a) => a.id === areaId)?.name : null;

  return (
    <>
      <PageHeader
        title="Mais cobradas em Direito"
        description={`O que a VUNESP mais cobrou nas ${VUNESP_PROVA_YEARS.length} provas de Escrevente TJSP (${VUNESP_PROVA_YEARS[0]}–${VUNESP_PROVA_YEARS[VUNESP_PROVA_YEARS.length - 1]}) · ${totalQuestions} questões de Direito classificadas por assunto.`}
        actions={
          <Button
            onClick={() =>
              start(
                areaLabel ? `Top 5 · ${areaLabel}` : "Top 5 assuntos mais cobrados",
                pickTopTopicQuestionIds(topics, 5, 20),
              )
            }
          >
            <Flame />
            Treinar os mais cobrados
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por matéria">
        <FilterChip active={!areaId} onClick={() => setAreaId(null)}>
          Todas · {totalQuestions}
        </FilterChip>
        {areas.map((a) => (
          <FilterChip key={a.id} active={areaId === a.id} onClick={() => setAreaId(a.id)}>
            {a.name} · {a.count}
          </FilterChip>
        ))}
      </div>

      <ol className="space-y-3">
        {topics.map((t, i) => (
          <TopicRow
            key={t.id}
            rank={i + 1}
            topic={t}
            maxCount={maxCount}
            showArea={!areaId}
            progress={progressById.get(t.id) ?? { answered: 0, correct: 0 }}
            onStart={() => start(t.name, t.questionIds)}
          />
        ))}
      </ol>

      <p className="mt-6 text-xs text-muted-foreground">
        Contagem feita sobre as provas oficiais disponíveis no app. Um assunto que caiu em todas as
        provas tende a cair de novo — comece pelo topo.
      </p>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TopicRow({
  rank,
  topic,
  maxCount,
  showArea,
  progress,
  onStart,
}: {
  rank: number;
  topic: HotTopic;
  maxCount: number;
  showArea: boolean;
  progress: { answered: number; correct: number };
  onStart: () => void;
}) {
  const pct = Math.round((topic.count / maxCount) * 100);
  const everyExam = topic.years.length === VUNESP_PROVA_YEARS.length;
  return (
    <li className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          aria-label={`Posição ${rank}`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{topic.name}</p>
            {everyExam && <Badge variant="secondary">Caiu em todas as provas</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showArea && <span className="text-foreground/80">{topic.areaName} · </span>}
            {topic.base}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums">
              {topic.count} {topic.count === 1 ? "questão" : "questões"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Em {topic.years.length} de {VUNESP_PROVA_YEARS.length} provas ({topic.years.join(", ")})
            {progress.answered > 0 && (
              <>
                {" · "}
                <span className="text-foreground">
                  Você: {progress.correct}/{progress.answered} acertos
                </span>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" className="shrink-0 self-start sm:self-center" onClick={onStart}>
          <Play />
          Resolver
        </Button>
      </div>
    </li>
  );
}

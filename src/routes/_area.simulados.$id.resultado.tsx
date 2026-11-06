import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2, Clock, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ErrorState,
  GridSkeleton,
  PageHeader,
  Panel,
  StatCard,
  formatDuration,
} from "@/components/common";
import { examsService } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/simulados/$id/resultado")({
  head: () => ({
    meta: [
      { title: "Resultado do simulado — Estufoo" },
      { name: "description", content: "Nota, balancete por matéria e revisão com gabarito." },
      { property: "og:title", content: "Resultado do simulado — Estufoo" },
      { property: "og:description", content: "Nota, balancete por matéria e revisão com gabarito." },
    ],
  }),
  component: Result,
});

function Result() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["exam-result", id], queryFn: () => examsService.result(id) });
  const [showReview, setShowReview] = useState(false);
  const [filter, setFilter] = useState<"todas" | "erradas" | "certas">("todas");

  const r = q.data;
  const total = r?.total ?? Math.max((r?.score ?? 0) + (r?.wrong.length ?? 0), 1);
  const wrongCount = r ? total - r.score : 0;

  const subjects = useMemo(() => {
    if (!r) return [];
    return [...r.bySubject]
      .map((s) => {
        const correct = s.correct ?? Math.round((s.pct / 100) * (s.total ?? 10));
        const tot = s.total ?? Math.max(correct, 1);
        const wrong = s.wrong ?? Math.max(0, tot - correct);
        return { subject: s.subject, correct, wrong, total: tot, pct: s.pct };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [r]);

  const best = subjects.filter((s) => s.pct >= 70).slice().sort((a, b) => b.pct - a.pct);
  const worst = subjects.filter((s) => s.pct < 70);

  const review = useMemo(() => {
    if (!r?.review?.length) return [];
    if (filter === "erradas") return r.review.filter((x) => !x.correct);
    if (filter === "certas") return r.review.filter((x) => x.correct);
    return r.review;
  }, [r, filter]);

  if (q.isLoading) return <GridSkeleton count={3} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (!r) return null;

  return (
    <>
      <PageHeader
        title="Resultado do simulado"
        description="Gabarito só aparece depois de finalizar — revise com calma."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/erros">Caderno de erros</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/desempenho">Desempenho</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/simulados">Voltar</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pontuação"
          value={`${r.score}/${total}`}
          hint={`${r.correctPct}% de acertos`}
          icon={Award}
          tone="highlight"
        />
        <StatCard
          label="Acertos / Erros"
          value={`${r.score} · ${wrongCount}`}
          hint="Acertos · erros"
          icon={Target}
        />
        <StatCard label="Tempo usado" value={formatDuration(r.timeUsedSec)} icon={Clock} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Balancete por matéria">
          {subjects.length ? (
            <ul className="space-y-4">
              {subjects.map((s) => (
                <li key={s.subject} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{s.subject}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.correct}/{s.total} · {s.pct}%
                    </span>
                  </div>
                  <Progress value={s.pct} className="mt-1.5 h-1.5" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="text-emerald-700">{s.correct} certas</span>
                    {" · "}
                    <span className="text-destructive">{s.wrong} erradas</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados por matéria.</p>
          )}
        </Panel>

        <Panel title="Onde foi melhor / pior">
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mais acertos
              </p>
              {best.length ? (
                <ul className="space-y-1.5">
                  {best.slice(0, 4).map((s) => (
                    <li key={s.subject} className="flex justify-between gap-2">
                      <span>{s.subject}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {s.pct}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Nenhuma matéria acima de 70%.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mais erros (prioridade de revisão)
              </p>
              {worst.length ? (
                <ul className="space-y-1.5">
                  {worst.slice(0, 4).map((s) => (
                    <li key={s.subject} className="flex justify-between gap-2">
                      <span>{s.subject}</span>
                      <Badge variant="destructive" className="tabular-nums">
                        {s.correct}/{s.total}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Todas as matérias acima de 70%. Bom trabalho!</p>
              )}
            </div>
            {r.recommendations.length > 0 && (
              <ul className="list-disc space-y-1 border-t pt-3 pl-5 text-muted-foreground">
                {r.recommendations.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Revisão das questões"
        action={
          <Button
            size="sm"
            variant={showReview ? "outline" : "default"}
            onClick={() => setShowReview((v) => !v)}
          >
            {showReview ? "Ocultar revisão" : "Ver questões com gabarito"}
          </Button>
        }
      >
        {!showReview ? (
          <p className="text-sm text-muted-foreground">
            Abra a revisão para ver cada enunciado, a letra que você marcou e a correta.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  ["todas", `Todas (${r.review?.length ?? 0})`],
                  ["erradas", `Erradas (${wrongCount})`],
                  ["certas", `Certas (${r.score})`],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {r.review?.length ? (
              <ul className="space-y-5">
                {review.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-4",
                      item.correct ? "border-emerald-200 bg-emerald-50/40" : "border-destructive/30 bg-destructive/5",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Questão {item.number}</span>
                      <span>· {item.subject}</span>
                      {item.correct ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Acertou
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> Errou
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.statement}</p>
                    <ul className="mt-3 space-y-1.5">
                      {item.alternatives.map((a) => {
                        const isYours = a.key === item.yourKey;
                        const isRight = a.key === item.correctKey;
                        return (
                          <li
                            key={a.key}
                            className={cn(
                              "rounded-md border px-3 py-2 text-sm",
                              isRight && "border-emerald-600 bg-emerald-500/10",
                              isYours && !isRight && "border-destructive bg-destructive/10",
                            )}
                          >
                            <span className="mr-2 font-bold">{a.key})</span>
                            {a.text}
                            {isRight && (
                              <span className="ml-2 text-xs font-semibold text-emerald-700">
                                gabarito
                              </span>
                            )}
                            {isYours && !isRight && (
                              <span className="ml-2 text-xs font-semibold text-destructive">
                                sua resposta
                              </span>
                            )}
                            {isYours && isRight && (
                              <span className="ml-2 text-xs font-semibold text-emerald-700">
                                sua resposta
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {!item.alternatives.length && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Sua resposta: <b className={item.correct ? "text-emerald-700" : "text-destructive"}>{item.yourKey}</b>
                        {" · "}
                        Correta: <b className="text-emerald-700">{item.correctKey}</b>
                      </p>
                    )}
                    {item.explanation ? (
                      <p className="mt-3 text-xs text-muted-foreground">{item.explanation}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Este resultado é antigo e não tem revisão completa. Abaixo, só os erros
                  registrados:
                </p>
                {r.wrong.length ? (
                  <ul className="divide-y">
                    {r.wrong.map((w) => (
                      <li key={w.id} className="py-3">
                        <p>{w.statement}</p>
                        <p className="mt-1 text-muted-foreground">
                          Sua resposta: <b className="text-destructive">{w.yourKey || "—"}</b>
                          {" · "}
                          Correta: <b className="text-emerald-700">{w.correctKey}</b>
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Nenhum erro. Excelente!</p>
                )}
              </div>
            )}
          </>
        )}
      </Panel>
    </>
  );
}

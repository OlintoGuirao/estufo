import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookX, Clock, ListChecks, RefreshCcw, Swords, Timer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ErrorState,
  GridSkeleton,
  PageHeader,
  Panel,
  StatCard,
  formatDuration,
} from "@/components/common";
import { dashboardService } from "@/services";

export const Route = createFileRoute("/_area/desempenho")({
  head: () => ({
    meta: [
      { title: "Desempenho — Estufoo" },
      {
        name: "description",
        content: "Desempenho unificado: Quest, plano, simulados e caderno de erros.",
      },
    ],
  }),
  component: Performance,
});

function Performance() {
  const [period, setPeriod] = useState<"semanal" | "mensal">("semanal");
  const q = useQuery({
    queryKey: ["performance", period],
    queryFn: () => dashboardService.performance(period),
  });
  return (
    <>
      <PageHeader
        title="Desempenho"
        description="Agrega TJSP Quest, simulados, plano e caderno de erros."
        actions={
          <>
            <Button
              variant={period === "semanal" ? "default" : "outline"}
              onClick={() => setPeriod("semanal")}
            >
              Semanal
            </Button>
            <Button
              variant={period === "mensal" ? "default" : "outline"}
              onClick={() => setPeriod("mensal")}
            >
              Mensal
            </Button>
          </>
        }
      />
      {q.isLoading ? (
        <GridSkeleton count={8} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        (() => {
          const d = q.data!;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Questões respondidas" value={d.answered} icon={ListChecks} />
                <StatCard label="Horas estudadas" value={`${d.hours}h`} icon={Clock} />
                <StatCard
                  label="Tempo médio / questão"
                  value={formatDuration(d.avgTimeSec)}
                  icon={Timer}
                />
                <StatCard
                  label="Revisões em dia"
                  value={`${d.reviewRate}%`}
                  icon={RefreshCcw}
                  tone="highlight"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Erros no caderno"
                  value={d.errorNotesCount ?? 0}
                  icon={BookX}
                />
                <StatCard
                  label="Tentativas no Quest"
                  value={d.questAttempts ?? 0}
                  icon={Swords}
                />
                <StatCard
                  label="Acerto no Quest"
                  value={`${d.questAccuracy ?? 0}%`}
                  icon={ListChecks}
                  tone="highlight"
                />
              </div>

              {d.dataNote && (
                <p className="mt-3 text-xs text-muted-foreground">{d.dataNote}</p>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <Panel title="Evolução de acertos (%)">
                  <div className="h-64">
                    <ResponsiveContainer>
                      <LineChart data={d.accuracyEvolution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" fontSize={12} />
                        <YAxis fontSize={12} domain={[0, 100]} />
                        <Tooltip />
                        <Line dataKey="acertos" stroke="var(--chart-2)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel title="Horas e questões">
                  <div className="h-64">
                    <ResponsiveContainer>
                      <BarChart data={d.monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="horas" fill="var(--chart-1)" radius={4} />
                        <Bar dataKey="questoes" fill="var(--chart-3)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel title="Por matéria (pontos fracos primeiro)">
                  <ul className="space-y-3">
                    {d.bySubject.map((s) => (
                      <li key={s.subject} className="text-sm">
                        <div className="flex justify-between">
                          <span>{s.subject}</span>
                          <span>
                            {s.pct}% · {s.answered} itens
                          </span>
                        </div>
                        <Progress value={s.pct} className="mt-1 h-1.5" />
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Erros por fonte">
                  {d.wrongsBySource?.length ? (
                    <ul className="space-y-3">
                      {d.wrongsBySource.map((s) => (
                        <li key={s.source} className="flex justify-between text-sm">
                          <span>{s.source}</span>
                          <span className="font-medium">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ainda sem erros no caderno.{" "}
                      <Link className="underline" to="/erros">
                        Abrir caderno
                      </Link>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/erros">Caderno de erros</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/revisoes">Revisão semanal</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/quest">TJSP Quest</Link>
                    </Button>
                  </div>
                </Panel>
                <Panel title="Por tópico" className="lg:col-span-2">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {d.byTopic.map((s) => (
                      <li key={`${s.subject}-${s.topic}`} className="text-sm">
                        <div className="flex justify-between">
                          <span>
                            {s.topic}{" "}
                            <span className="text-muted-foreground">· {s.subject}</span>
                          </span>
                          <span>{s.pct}%</span>
                        </div>
                        <Progress value={s.pct} className="mt-1 h-1.5" />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </>
          );
        })()
      )}
    </>
  );
}

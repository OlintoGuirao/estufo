import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, ListChecks, RefreshCcw, Timer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorState, GridSkeleton, PageHeader, Panel, StatCard, formatDuration } from "@/components/common";
import { dashboardService } from "@/services";

export const Route = createFileRoute("/_area/desempenho")({
  head: () => ({ meta: [{ title: "Desempenho — AprovaMind" }, { name: "description", content: "Evolução dos seus acertos e horas de estudo." }, { property: "og:title", content: "Desempenho — AprovaMind" }, { property: "og:description", content: "Evolução dos seus acertos e horas de estudo." }] }),
  component: Performance,
});

function Performance() {
  const [period, setPeriod] = useState<"semanal" | "mensal">("semanal");
  const q = useQuery({ queryKey: ["performance", period], queryFn: () => dashboardService.performance(period) });
  return (
    <>
      <PageHeader title="Desempenho" actions={<>
        <Button variant={period === "semanal" ? "default" : "outline"} onClick={() => setPeriod("semanal")}>Semanal</Button>
        <Button variant={period === "mensal" ? "default" : "outline"} onClick={() => setPeriod("mensal")}>Mensal</Button>
      </>} />
      {q.isLoading ? <GridSkeleton count={8} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (() => {
        const d = q.data!;
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Questões" value={d.answered} icon={ListChecks} />
              <StatCard label="Horas estudadas" value={`${d.hours}h`} icon={Clock} />
              <StatCard label="Tempo médio por questão" value={formatDuration(d.avgTimeSec)} icon={Timer} />
              <StatCard label="Revisões em dia" value={`${d.reviewRate}%`} icon={RefreshCcw} tone="highlight" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Panel title="Evolução de acertos (%)">
                <div className="h-64"><ResponsiveContainer><LineChart data={d.accuracyEvolution}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} domain={[0, 100]} /><Tooltip /><Line dataKey="acertos" stroke="var(--chart-2)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
              </Panel>
              <Panel title="Horas e questões">
                <div className="h-64"><ResponsiveContainer><BarChart data={d.monthly}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="horas" fill="var(--chart-1)" radius={4} /><Bar dataKey="questoes" fill="var(--chart-3)" radius={4} /></BarChart></ResponsiveContainer></div>
              </Panel>
              <Panel title="Por matéria">
                <ul className="space-y-3">{d.bySubject.map((s) => <li key={s.subject} className="text-sm"><div className="flex justify-between"><span>{s.subject}</span><span>{s.pct}% · {s.answered} questões</span></div><Progress value={s.pct} className="mt-1 h-1.5" /></li>)}</ul>
              </Panel>
              <Panel title="Por tópico">
                <ul className="space-y-3">{d.byTopic.map((s) => <li key={s.topic} className="text-sm"><div className="flex justify-between"><span>{s.topic} <span className="text-muted-foreground">· {s.subject}</span></span><span>{s.pct}%</span></div><Progress value={s.pct} className="mt-1 h-1.5" /></li>)}</ul>
              </Panel>
            </div>
          </>
        );
      })()}
    </>
  );
}

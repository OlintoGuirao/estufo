import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Flame, Target, ListChecks } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, GridSkeleton, MasteryBadge, PageHeader, Panel, StatCard, daysUntil, formatDate } from "@/components/common";
import { dashboardService } from "@/services";

export const Route = createFileRoute("/_area/painel")({
  head: () => ({ meta: [{ title: "Visão geral — AprovaMind" }, { name: "description", content: "Seu progresso de estudos." }, { property: "og:title", content: "Visão geral — AprovaMind" }, { property: "og:description", content: "Seu progresso de estudos." }] }),
  component: Dashboard,
});

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.get });
  if (q.isLoading) return <GridSkeleton count={8} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const d = q.data!;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={d.contest ? `${d.contest.name} · prova em ${daysUntil(d.contest.examDate)} dias (${formatDate(d.contest.examDate)})` : "Selecione um concurso para começar."}
        actions={<Button asChild variant="highlight"><Link to="/questoes">Resolver questões</Link></Button>}
      />
      <Panel className="mb-6">
        <div className="flex items-center justify-between text-sm"><span>Progresso do edital</span><span className="font-semibold">{d.progress}%</span></div>
        <Progress value={d.progress} className="mt-2" />
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Horas na semana" value={`${d.weekHours}h`} icon={Clock} />
        <StatCard label="Questões respondidas" value={d.answered} icon={ListChecks} />
        <StatCard label="Taxa de acerto" value={`${d.accuracy}%`} icon={Target} tone="highlight" />
        <StatCard label="Sequência" value={`${d.streak} dias`} icon={Flame} tone="highlight" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Semana" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <Bar dataKey="horas" name="Horas" fill="var(--chart-1)" radius={4} />
                <Bar dataKey="acertos" name="Acertos" fill="var(--chart-2)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Distribuição do tempo">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {d.distribution.map((_, i) => <Cell key={i} fill={colors[i % 5]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Hoje" action={<Link to="/plano" className="text-sm text-primary">Ver plano</Link>} className="lg:col-span-2">
          {d.today.length ? (
            <ul className="divide-y">
              {d.today.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                  <div><p className="font-medium">{s.subject}</p><p className="text-muted-foreground">{s.topic} · {s.activity}</p></div>
                  <span className="text-muted-foreground">{s.durationMin} min</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nada para hoje" description="Aproveite para revisar ou resolver questões." />}
        </Panel>
        <Panel title="Próximas revisões" action={<Link to="/revisoes" className="text-sm text-primary">Ver todas</Link>}>
          <ul className="space-y-3">
            {d.upcomingReviews.slice(0, 5).map((r) => (
              <li key={r.id} className="text-sm"><p className="font-medium">{r.topic}</p><div className="mt-1 flex items-center gap-2"><MasteryBadge mastery={r.mastery} /><span className="text-xs text-muted-foreground">{formatDate(r.dueDate)}</span></div></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Pontos fracos"><Bars items={d.weakest} /></Panel>
        <Panel title="Pontos fortes"><Bars items={d.strongest} /></Panel>
      </div>
    </>
  );
}

function Bars({ items }: { items: { subject: string; pct: number }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.subject} className="text-sm"><div className="flex justify-between"><span>{i.subject}</span><span className="font-medium">{i.pct}%</span></div><Progress value={i.pct} className="mt-1 h-1.5" /></li>
      ))}
    </ul>
  );
}

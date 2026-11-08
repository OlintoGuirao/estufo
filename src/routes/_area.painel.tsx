import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Flame, ListChecks, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Progress } from "@/components/ui/progress";
import { ErrorState, GridSkeleton, MasteryBadge, Panel, StatCard, formatDate } from "@/components/common";
import { StudyDayCalendar } from "@/components/painel/study-day-calendar";
import { TrailResumeCard } from "@/components/trail/resume-card";
import { VideoLessonResumeCard } from "@/components/video-lessons/resume-card";
import { dashboardService } from "@/services";

export const Route = createFileRoute("/_area/painel")({
  head: () => ({ meta: [{ title: "Visão geral — Estufoo" }, { name: "description", content: "Seu progresso de estudos." }, { property: "og:title", content: "Visão geral — Estufoo" }, { property: "og:description", content: "Seu progresso de estudos." }] }),
  component: Dashboard,
});

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.get });
  // A Agenda não depende das métricas: aparece na hora, sem esperar o painel.
  const calendar = (
    <div className="mb-6">
      <StudyDayCalendar />
    </div>
  );
  if (q.isLoading)
    return (
      <>
        {calendar}
        <GridSkeleton count={8} />
      </>
    );
  if (q.error)
    return (
      <>
        {calendar}
        <ErrorState error={q.error} onRetry={q.refetch} />
      </>
    );
  const d = q.data!;
  return (
    <>
      {d.dataNote && <p className="mb-4 text-xs text-muted-foreground">{d.dataNote}</p>}

      {calendar}

      <TrailResumeCard className="mb-6" />
      <VideoLessonResumeCard className="mb-6" />

      <Panel className="mb-6">
        <div className="flex items-center justify-between text-sm"><span>Progresso do plano (sessões concluídas)</span><span className="font-semibold">{d.progress}%</span></div>
        <Progress value={d.progress} className="mt-2" />
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Horas na semana (sessões)" value={`${d.weekHours}h`} hint="Tempo planejado concluído — não mede aprendizado" icon={Clock} />
        <StatCard label="Questões respondidas" value={d.answered} icon={ListChecks} />
        <StatCard label="Taxa de acerto" value={d.answered ? `${d.accuracy}%` : "—"} hint={d.answered ? undefined : "Responda questões para calcular"} icon={Target} tone="highlight" />
        <StatCard label="Sequência" value={`${d.streak} dias`} hint="Dias seguidos com sessão concluída" icon={Flame} tone="highlight" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Semana (horas concluídas)" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" fontSize={12} /><YAxis fontSize={12} /><Tooltip />
                <Bar dataKey="horas" name="Horas" fill="var(--chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">% de acerto diário não é exibido: o mock ainda não guarda data de cada resposta.</p>
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
        <Panel title="Próximas revisões" action={<Link to="/revisoes" className="text-sm text-primary">Ver todas</Link>} className="lg:col-span-2">
          {d.upcomingReviews.length ? (
            <ul className="space-y-3">
              {d.upcomingReviews.slice(0, 5).map((r) => (
                <li key={r.id} className="text-sm"><p className="font-medium">{r.topic}</p><div className="mt-1 flex items-center gap-2"><MasteryBadge mastery={r.mastery} /><span className="text-xs text-muted-foreground">{formatDate(r.dueDate)}</span></div></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma revisão vencida ou para hoje.</p>
          )}
        </Panel>
        <Panel title="Pontos fracos">
          {d.weakest.length ? <Bars items={d.weakest} /> : <p className="text-sm text-muted-foreground">Sem respostas por matéria ainda.</p>}
        </Panel>
        <Panel title="Pontos fortes">
          {d.strongest.length ? <Bars items={d.strongest} /> : <p className="text-sm text-muted-foreground">Sem respostas por matéria ainda.</p>}
        </Panel>
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

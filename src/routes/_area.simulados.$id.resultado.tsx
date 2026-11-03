import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ErrorState, GridSkeleton, PageHeader, Panel, StatCard, formatDuration } from "@/components/common";
import { examsService } from "@/services";

export const Route = createFileRoute("/_area/simulados/$id/resultado")({
  head: () => ({ meta: [{ title: "Resultado do simulado — Estufoo" }, { name: "description", content: "Veja seu desempenho no simulado." }, { property: "og:title", content: "Resultado do simulado — Estufoo" }, { property: "og:description", content: "Veja seu desempenho no simulado." }] }),
  component: Result,
});

function Result() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["exam-result", id], queryFn: () => examsService.result(id) });
  if (q.isLoading) return <GridSkeleton count={3} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const r = q.data!;
  return (
    <>
      <PageHeader
        title="Resultado do simulado"
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
        <StatCard label="Nota" value={r.score} icon={Award} tone="highlight" />
        <StatCard label="Acertos" value={`${r.correctPct}%`} icon={Target} />
        <StatCard label="Tempo usado" value={formatDuration(r.timeUsedSec)} icon={Clock} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Por matéria">
          <ul className="space-y-3">{r.bySubject.map((s) => <li key={s.subject} className="text-sm"><div className="flex justify-between"><span>{s.subject}</span><span>{s.pct}%</span></div><Progress value={s.pct} className="mt-1 h-1.5" /></li>)}</ul>
        </Panel>
        <Panel title="Recomendações">
          <ul className="list-disc space-y-2 pl-5 text-sm">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul>
        </Panel>
        <Panel title="Questões erradas" className="lg:col-span-2">
          {r.wrong.length ? (
            <ul className="divide-y">{r.wrong.map((w) => (
              <li key={w.id} className="py-3 text-sm"><p>{w.statement}</p><p className="mt-1 text-muted-foreground">Sua resposta: <b className="text-destructive">{w.yourKey || "—"}</b> · Correta: <b className="text-highlight">{w.correctKey}</b></p></li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum erro. Excelente!</p>}
        </Panel>
      </div>
    </>
  );
}

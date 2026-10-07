import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { examsService } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/simulados/$id/")({
  head: () => ({ meta: [{ title: "Simulado em andamento — AprovaMind" }, { name: "description", content: "Resolva o simulado." }, { property: "og:title", content: "Simulado — AprovaMind" }, { property: "og:description", content: "Resolva o simulado." }] }),
  component: TakeExam,
});

function TakeExam() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["exam", id], queryFn: () => examsService.get(id) });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const sent = useRef(false);
  const submit = useMutation({
    mutationFn: () => examsService.submit(id, { answers, timeUsedSec: elapsed }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); nav({ to: "/simulados/$id/resultado", params: { id } }); },
  });
  useEffect(() => { const t = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(t); }, []);
  const limit = (q.data?.timeLimitMin ?? 0) * 60;
  useEffect(() => { if (q.data && elapsed >= limit && !sent.current) { sent.current = true; submit.mutate(); } }, [elapsed, limit, q.data, submit]);

  if (q.isLoading) return <ListSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const exam = q.data!;
  const cur = exam.questions[idx];
  const left = Math.max(0, limit - elapsed);
  return (
    <>
      <PageHeader title={exam.title} actions={
        <span className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2 font-mono text-sm", left < 60 && "text-destructive")}>
          <Timer className="h-4 w-4" />{String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
        </span>} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {exam.questions.map((x, i) => (
          <button key={x.id} onClick={() => setIdx(i)} className={cn("h-8 w-8 rounded-md border text-xs", answers[x.id] && "bg-accent", i === idx && "border-primary ring-1 ring-primary")}>{i + 1}</button>
        ))}
      </div>
      {cur && (
        <Panel>
          <p className="text-xs text-muted-foreground">Questão {idx + 1} de {exam.questions.length} · {cur.subject}</p>
          <p className="mt-2 leading-relaxed">{cur.statement}</p>
          <div className="mt-4 space-y-2">
            {cur.alternatives.map((a) => (
              <button key={a.key} onClick={() => setAnswers({ ...answers, [cur.id]: a.key })}
                className={cn("flex w-full gap-3 rounded-lg border p-3 text-left text-sm hover:bg-accent", answers[cur.id] === a.key && "border-primary bg-accent")}>
                <span className="font-semibold">{a.key})</span>{a.text}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Anterior</Button>
            {idx < exam.questions.length - 1
              ? <Button onClick={() => setIdx(idx + 1)}>Próxima</Button>
              : <Button variant="highlight" disabled={submit.isPending} onClick={() => submit.mutate()}>Finalizar simulado</Button>}
          </div>
        </Panel>
      )}
    </>
  );
}

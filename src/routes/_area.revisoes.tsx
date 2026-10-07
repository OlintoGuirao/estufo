import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton, MasteryBadge, PageHeader, Panel, daysUntil, formatDate } from "@/components/common";
import { reviewsService } from "@/services";
import type { Review } from "@/types";

export const Route = createFileRoute("/_area/revisoes")({
  head: () => ({ meta: [{ title: "Revisões — AprovaMind" }, { name: "description", content: "Revisões espaçadas do que você estudou." }, { property: "og:title", content: "Revisões — AprovaMind" }, { property: "og:description", content: "Revisões espaçadas do que você estudou." }] }),
  component: Reviews,
});

function Reviews() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["reviews"], queryFn: reviewsService.list });
  const done = useMutation({
    mutationFn: ({ id, c }: { id: string; c: number }) => reviewsService.complete(id, { confidence: c }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews"] }); toast.success("Revisão registrada. Próxima data atualizada."); },
  });
  if (q.isLoading) return <ListSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const late = q.data!.filter((r) => daysUntil(r.dueDate) < 0);
  const today = q.data!.filter((r) => daysUntil(r.dueDate) === 0);
  const next = q.data!.filter((r) => daysUntil(r.dueDate) > 0);
  const Group = ({ title, items }: { title: string; items: Review[] }) => (
    <Panel title={`${title} (${items.length})`}>
      {items.length ? (
        <ul className="divide-y">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{r.topic}</p><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">{r.subject} · {formatDate(r.dueDate)} <MasteryBadge mastery={r.mastery} /></div></div>
              <div className="flex items-center gap-1">
                <span className="mr-1 text-xs text-muted-foreground">Confiança:</span>
                {[1, 2, 3, 4, 5].map((c) => <Button key={c} size="sm" variant="outline" disabled={done.isPending} onClick={() => done.mutate({ id: r.id, c })}>{c}</Button>)}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">Nada aqui.</p>}
    </Panel>
  );
  if (!q.data!.length) return <><PageHeader title="Revisões" /><EmptyState title="Nenhuma revisão agendada" /></>;
  return (
    <>
      <PageHeader title="Revisões" description="Avalie sua confiança de 1 a 5 para reagendar cada tópico." />
      <div className="space-y-6">
        {late.length > 0 && <Group title="Atrasadas" items={late} />}
        <Group title="Hoje" items={today} />
        <Group title="Próximas" items={next} />
      </div>
    </>
  );
}

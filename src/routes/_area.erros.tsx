import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Panel,
} from "@/components/common";
import { errMsg } from "@/components/forms";
import { ERROR_REASON_OPTIONS } from "@/lib/study-cycle";
import { ERROR_ORIGIN_LABEL } from "@/lib/study-errors";
import { errorNotesService } from "@/services";
import type { ErrorNoteOrigin } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/erros")({
  head: () => ({
    meta: [
      { title: "Caderno de erros — Estufoo" },
      {
        name: "description",
        content: "Todas as questões que você errou: Quest, simulado, plano e diagnóstico.",
      },
    ],
  }),
  component: ErrorNotebook,
});

const FILTERS: { id: "todas" | ErrorNoteOrigin; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "simulado", label: "Simulado" },
  { id: "quest", label: "TJSP Quest" },
  { id: "video-aula", label: "Videoaula" },
  { id: "plano", label: "Plano" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "local", label: "Questões" },
];

function ErrorNotebook() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"todas" | ErrorNoteOrigin>("todas");
  const q = useQuery({ queryKey: ["error-notes"], queryFn: () => errorNotesService.list() });
  const remove = useMutation({
    mutationFn: errorNotesService.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["error-notes"] });
      toast.success("Erro removido do caderno.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const schedule = useMutation({
    mutationFn: errorNotesService.scheduleReview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["error-notes"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Revisão agendada para hoje.");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (filter === "todas") return list;
    return list.filter((n) => (n.origin ?? "local") === filter);
  }, [q.data, filter]);

  return (
    <>
      <PageHeader
        title="Caderno de erros"
        description="Questões erradas do simulado, TJSP Quest, plano e diagnóstico — ligadas às revisões."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/revisoes">Revisão semanal</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/desempenho">Desempenho</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <ListSkeleton />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : !filtered.length ? (
        <EmptyState
          title="Nenhum erro neste filtro"
          description="Ao errar no simulado, Quest ou prática, a questão entra automaticamente aqui."
          action={
            <Button asChild>
              <Link to="/simulados">Fazer um simulado</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((n) => {
            const reason =
              n.reasonCode === "outro"
                ? n.reasonCustom || "Outro motivo"
                : (ERROR_REASON_OPTIONS.find((o) => o.code === n.reasonCode)?.label ??
                  n.reasonCode);
            const origin = (n.origin ?? "local") as ErrorNoteOrigin;
            return (
              <Panel key={n.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{n.subject}</Badge>
                  <Badge variant="outline">{n.topic}</Badge>
                  <Badge variant="outline">
                    {n.sourceLabel || ERROR_ORIGIN_LABEL[origin]}
                  </Badge>
                  <span className="text-muted-foreground">Motivo: {reason}</span>
                </div>
                {n.origin === "provider" || !n.statement ? (
                  <p className="text-sm text-muted-foreground">
                    Referência do provedor (enunciado não armazenado). ID:{" "}
                    {n.externalId || n.questionId}
                  </p>
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">{n.statement}</p>
                )}
                <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Sua resposta</dt>
                    <dd className="font-medium text-destructive">{n.yourKey || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gabarito</dt>
                    <dd className="font-medium text-highlight">{n.correctKey || "—"}</dd>
                  </div>
                </dl>
                {n.explanation ? (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      Explicação / fundamentação
                    </p>
                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                      {n.explanation}
                    </p>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={schedule.isPending}
                    onClick={() => schedule.mutate(n.id)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {n.reviewId ? "Reagendar revisão" : "Agendar revisão"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remover do caderno"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  MasteryBadge,
  PageHeader,
  Panel,
  daysUntil,
  formatDate,
} from "@/components/common";
import { errMsg } from "@/components/forms";
import { explainSrsInterval, intervalForConfidence } from "@/lib/study-cycle";
import {
  ERROR_ORIGIN_LABEL,
  groupErrorNotesBySubject,
  groupErrorNotesByWeek,
} from "@/lib/study-errors";
import {
  buildWeeklyReinforcePrompt,
  buildWeeklyReviewBundle,
} from "@/lib/weekly-review";
import { errorNotesService, reviewsService, studyPlansService, tutorService } from "@/services";
import type { ErrorNote, ErrorNoteOrigin, Review } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/revisoes")({
  head: () => ({
    meta: [
      { title: "Revisões — Estufoo" },
      {
        name: "description",
        content: "Revisão semanal acumulativa do plano + reforço dos erros.",
      },
    ],
  }),
  component: Reviews,
});

type Tab = "srs" | "semana" | "materia" | "acumulado";

function Reviews() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("semana");
  const [reinforce, setReinforce] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["reviews"], queryFn: reviewsService.list });
  const notes = useQuery({ queryKey: ["error-notes"], queryFn: () => errorNotesService.list() });
  const plan = useQuery({
    queryKey: ["sessions", "week-review"],
    queryFn: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 60);
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      return studyPlansService.sessions({ from: iso(from), to: iso(to) });
    },
  });

  const done = useMutation({
    mutationFn: ({ id, c }: { id: string; c: number }) =>
      reviewsService.complete(id, { confidence: c }),
    onSuccess: (rv) => {
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(rv.scheduleNote ?? "Revisão registrada.");
    },
  });

  const genReinforce = useMutation({
    mutationFn: async () => {
      const bundle = buildWeeklyReviewBundle({
        errorNotes: notes.data ?? [],
        sessions: plan.data ?? [],
      });
      const summaryText = buildWeeklyReinforcePrompt(bundle);
      return tutorService.weeklyReinforce({
        weekKey: bundle.week,
        summaryText,
      });
    },
    onSuccess: (r) => {
      setReinforce(r.text);
      toast.success(
        r.mocked
          ? "Reforço demonstrativo (configure GEMINI_API_KEY)."
          : "Reforço mental da semana gerado.",
      );
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const weekly = useMemo(
    () =>
      buildWeeklyReviewBundle({
        errorNotes: notes.data ?? [],
        sessions: plan.data ?? [],
      }),
    [notes.data, plan.data],
  );

  const byWeek = useMemo(
    () => groupErrorNotesByWeek(notes.data ?? []),
    [notes.data],
  );
  const bySubject = useMemo(
    () => groupErrorNotesBySubject(notes.data ?? []),
    [notes.data],
  );

  if (q.isLoading || notes.isLoading) return <ListSkeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.refetch} />;

  const late = q.data!.filter((r) => daysUntil(r.dueDate) < 0);
  const today = q.data!.filter((r) => daysUntil(r.dueDate) === 0);
  const next = q.data!.filter((r) => daysUntil(r.dueDate) > 0);
  const notesByTopic = (r: Review) =>
    (notes.data ?? []).filter((n) => n.subject === r.subject && n.topic === r.topic);

  const tabs: { id: Tab; label: string }[] = [
    { id: "semana", label: "Esta semana" },
    { id: "materia", label: "Por matéria" },
    { id: "acumulado", label: "Acumulado" },
    { id: "srs", label: "Fila SRS" },
  ];

  const Group = ({ title, items }: { title: string; items: Review[] }) => (
    <Panel title={`${title} (${items.length})`}>
      {items.length ? (
        <ul className="divide-y">
          {items.map((r) => (
            <ReviewItem
              key={r.id}
              review={r}
              relatedErrors={notesByTopic(r)}
              pending={done.isPending}
              onComplete={(c) => done.mutate({ id: r.id, c })}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nada aqui.</p>
      )}
    </Panel>
  );

  return (
    <>
      <PageHeader
        title="Revisões"
        description="Acumulativo do que você estudou no plano + erros do caderno. Reforço mental por semana via IA."
        actions={
          <Button
            disabled={genReinforce.isPending}
            onClick={() => genReinforce.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {genReinforce.isPending ? "Gerando…" : "Reforço da semana (IA)"}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
              tab === t.id
                ? "bg-card shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reinforce && (
        <Panel title="Reforço mental da semana" className="mb-6">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
            {reinforce}
          </pre>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => setReinforce(null)}
          >
            Fechar
          </Button>
        </Panel>
      )}

      {tab === "semana" && (
        <div className="space-y-4">
          <Panel title={`Semana ${weekly.week}`}>
            <p className="text-sm text-muted-foreground">
              Sessões no plano: {weekly.sessions.length} · Matérias:{" "}
              {weekly.subjectsStudied.join(", ") || "—"} · Erros:{" "}
              {weekly.errorNotes.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/plano">Abrir plano</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/erros">Caderno de erros</Link>
              </Button>
            </div>
          </Panel>
          {weekly.bySubject.length ? (
            weekly.bySubject.map((g) => (
              <ErrorGroup key={g.subject} title={g.subject} notes={g.notes} />
            ))
          ) : (
            <EmptyState
              title="Sem erros nesta semana"
              description="Conforme você errar no simulado, Quest ou prática, eles aparecem aqui."
            />
          )}
        </div>
      )}

      {tab === "materia" && (
        <div className="space-y-4">
          {bySubject.length ? (
            bySubject.map((g) => (
              <ErrorGroup key={g.subject} title={g.subject} notes={g.notes} />
            ))
          ) : (
            <EmptyState title="Nada no caderno ainda" description="Erros de todas as fontes aparecem agrupados por matéria." />
          )}
        </div>
      )}

      {tab === "acumulado" && (
        <div className="space-y-4">
          {byWeek.length ? (
            byWeek.map((g) => (
              <ErrorGroup
                key={g.week}
                title={`Semana ${g.week}`}
                notes={g.notes}
              />
            ))
          ) : (
            <EmptyState title="Acumulado vazio" description="O histórico semanal de erros cresce conforme você pratica." />
          )}
        </div>
      )}

      {tab === "srs" && (
        <div className="space-y-6">
          {!q.data!.length ? (
            <EmptyState
              title="Nenhuma revisão SRS agendada"
              description="Salve erros no caderno ou marque questões para revisão."
              action={
                <Button asChild variant="outline">
                  <Link to="/erros">Caderno de erros</Link>
                </Button>
              }
            />
          ) : (
            <>
              {late.length > 0 && <Group title="Atrasadas" items={late} />}
              <Group title="Hoje" items={today} />
              <Group title="Próximas" items={next} />
            </>
          )}
        </div>
      )}
    </>
  );
}

function ErrorGroup({ title, notes }: { title: string; notes: ErrorNote[] }) {
  return (
    <Panel title={`${title} (${notes.length})`}>
      <ul className="divide-y">
        {notes.map((n) => (
          <li key={n.id} className="py-3 text-sm">
            <div className="mb-1 flex flex-wrap gap-1.5">
              <Badge variant="outline">{n.topic}</Badge>
              <Badge variant="secondary">
                {n.sourceLabel ||
                  ERROR_ORIGIN_LABEL[(n.origin ?? "local") as ErrorNoteOrigin]}
              </Badge>
            </div>
            <p className="line-clamp-3 leading-relaxed">
              {n.statement || "(sem enunciado)"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Você: <b className="text-destructive">{n.yourKey}</b> · Gabarito:{" "}
              <b className="text-highlight">{n.correctKey}</b>
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ReviewItem({
  review,
  relatedErrors,
  pending,
  onComplete,
}: {
  review: Review;
  relatedErrors: ErrorNote[];
  pending: boolean;
  onComplete: (c: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [hoverConf, setHoverConf] = useState<number | null>(null);
  const previewInterval = hoverConf ? intervalForConfidence(hoverConf) : null;

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">{review.topic}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {review.subject} · {formatDate(review.dueDate)}{" "}
            <MasteryBadge mastery={review.mastery} />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={revealed}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {revealed ? "Ocultar ajuda" : "Revelar ajuda"}
        </Button>
      </div>

      {!revealed ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
          <p className="font-medium">Recordação ativa</p>
          <p className="mt-1 text-muted-foreground">
            O que você lembra sobre <strong>{review.topic}</strong> em {review.subject}?
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border bg-card p-4 text-sm">
          {relatedErrors.length > 0 ? (
            <ul className="space-y-2">
              {relatedErrors.slice(0, 3).map((n) => (
                <li key={n.id} className="rounded-md bg-muted/50 p-2">
                  <p className="line-clamp-2">{n.statement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você: {n.yourKey} · Gabarito: {n.correctKey}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum erro salvo deste tópico no caderno ainda.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">Confiança:</span>
          {[1, 2, 3, 4, 5].map((c) => (
            <Button
              key={c}
              size="sm"
              variant="outline"
              disabled={pending || !revealed}
              onMouseEnter={() => setHoverConf(c)}
              onMouseLeave={() => setHoverConf(null)}
              onClick={() => onComplete(c)}
            >
              {c}
            </Button>
          ))}
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          {!revealed
            ? "Revele a ajuda antes de avaliar."
            : previewInterval
              ? explainSrsInterval(hoverConf!, previewInterval)
              : review.scheduleNote || "Intervalos: 1→1d, 2→1d, 3→3d, 4→7d, 5→15d."}
        </p>
      </div>
    </li>
  );
}

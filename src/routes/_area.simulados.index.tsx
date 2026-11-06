import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, formatDate } from "@/components/common";
import { Field } from "@/components/forms";
import { useMe } from "@/hooks/use-auth";
import { getTrailStudySnapshotForSimulado } from "@/lib/approval-trail/studied-for-simulado";
import { examsService } from "@/services";
import { approvalTrailService } from "@/services/approval-trail.service";
import { trailProgressService } from "@/services/trail-progress.service";
import type { MockExam } from "@/types";

export const Route = createFileRoute("/_area/simulados/")({
  head: () => ({
    meta: [
      { title: "Simulados — Estufoo" },
      { name: "description", content: "Provas oficiais TJSP e simulados da trilha." },
      { property: "og:title", content: "Simulados — Estufoo" },
      { property: "og:description", content: "Provas oficiais TJSP e simulados da trilha." },
    ],
  }),
  component: Exams,
});

function Exams() {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["exams"], queryFn: examsService.list });
  const officialQ = useQuery({
    queryKey: ["official-provas"],
    queryFn: examsService.listOfficialProvas,
  });
  const [open, setOpen] = useState(false);

  const startOfficial = useMutation({
    mutationFn: (officialProvaId: string) =>
      examsService.startOfficial(officialProvaId, me.data?.activeContestId ?? ""),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      nav({ to: "/simulados/$id", params: { id: e.id } });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a prova."),
  });

  return (
    <>
      <PageHeader
        title="Simulados"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Novo simulado
          </Button>
        }
      />

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Provas oficiais TJSP</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Cadernos reais de Escrevente Técnico Judiciário (Vunesp). Cronômetro de 5 horas — como no
          dia da prova.
        </p>
        {officialQ.isLoading ? (
          <ListSkeleton />
        ) : officialQ.error ? (
          <ErrorState error={officialQ.error} onRetry={officialQ.refetch} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(officialQ.data ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.questionCount} questões · {p.timeLimitMin} min
                    </p>
                  </div>
                  <Badge variant="outline">{p.year}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.hasFullAnswerKey
                    ? `Gabarito · ${p.subjects.slice(0, 3).join(" · ")}${p.subjects.length > 3 ? "…" : ""}`
                    : `Gabarito parcial (${p.answerKeyCount}/${p.questionCount})`}
                </p>
                <div className="mt-4">
                  <Button
                    disabled={startOfficial.isPending || p.answerKeyCount < 10}
                    onClick={() => startOfficial.mutate(p.id)}
                  >
                    Fazer esta prova
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Meus simulados</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Simulados da trilha ou provas oficiais já iniciadas.
        </p>
        {q.isLoading ? (
          <ListSkeleton />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : !q.data!.length ? (
          <EmptyState
            title="Nenhum simulado ainda"
            action={<Button onClick={() => setOpen(true)}>Criar o primeiro</Button>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {q.data!.map((e) => (
              <div key={e.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.questionCount} questões · {e.timeLimitMin} min · {formatDate(e.createdAt)}
                    </p>
                  </div>
                  <Badge variant={e.status === "concluido" ? "secondary" : "outline"}>
                    {e.status === "concluido" ? `${e.score ?? 0}%` : "Pendente"}
                  </Badge>
                </div>
                <div className="mt-4">
                  {e.status === "concluido" ? (
                    <Button variant="outline" asChild>
                      <Link to="/simulados/$id/resultado" params={{ id: e.id }}>
                        Ver resultado
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link to="/simulados/$id" params={{ id: e.id }}>
                        Continuar
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {open && <NewExam onClose={() => setOpen(false)} />}
    </>
  );
}

function NewExam({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();

  const trailQ = useQuery({
    queryKey: ["approval-trail"],
    queryFn: () => approvalTrailService.hydrate(),
  });

  const progressQ = useQuery({
    queryKey: ["trail-progress-all", trailQ.data?.id],
    queryFn: () => trailProgressService.hydrateAll(trailQ.data!.id),
    enabled: !!trailQ.data?.id,
  });

  const snapshot = useMemo(
    () => getTrailStudySnapshotForSimulado(trailQ.data, progressQ.data ?? []),
    [trailQ.data, progressQ.data],
  );

  const [selected, setSelected] = useState<string[] | null>(null);
  const subjects = selected ?? snapshot?.subjects ?? [];

  const [f, setF] = useState({
    title: "",
    questionCount: 20,
    timeLimitMin: 60,
  });

  const title =
    f.title.trim() ||
    (snapshot
      ? `Simulado trilha · ${snapshot.label}`
      : "Simulado da trilha");

  const m = useMutation({
    mutationFn: () =>
      examsService.create({
        title,
        contestId: me.data?.activeContestId ?? "",
        subjects,
        questionCount: f.questionCount,
        timeLimitMin: f.timeLimitMin,
        correctionMode: "ao-final",
        fromTrail: true,
        trailWeekNumber: snapshot?.weekNumber ?? null,
      }),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Simulado criado com o material da trilha.");
      nav({ to: "/simulados/$id", params: { id: e.id } });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o simulado."),
  });

  const toggleSubject = (name: string) => {
    const base = selected ?? snapshot?.subjects ?? [];
    const next = base.includes(name) ? base.filter((s) => s !== name) : [...base, name];
    setSelected(next);
  };

  const loadingTrail = trailQ.isLoading || (!!trailQ.data?.id && progressQ.isLoading);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo simulado da trilha</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {loadingTrail ? (
            <p className="text-sm text-muted-foreground">Carregando o que você estudou…</p>
          ) : !snapshot ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Ainda não há dias concluídos na <strong>Trilha de aprovação</strong>. Estude a semana
              (ex.: seg–sex) e volte aqui — montamos a prova com essas matérias.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium text-foreground">{snapshot.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {snapshot.dayCount
                  ? `${snapshot.dayCount} dia(s) de estudo nesta semana`
                  : "Etapas concluídas no material"}
              </p>
              {snapshot.days.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {snapshot.days.map((d) => (
                    <li key={d.week}>
                      {d.dayLabel || `Dia ${d.week}`}: {d.focus}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {snapshot && (
            <div>
              <p className="mb-2 text-sm font-medium">Matérias da prova</p>
              <div className="flex flex-wrap gap-2">
                {snapshot.subjects.map((name) => {
                  const on = subjects.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleSubject(name)}
                      className={
                        on
                          ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                          : "rounded-full border px-3 py-1 text-xs text-muted-foreground"
                      }
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field label="Título" htmlFor="t">
            <Input
              id="t"
              placeholder={title}
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Questões" htmlFor="n">
              <Input
                id="n"
                type="number"
                min={5}
                max={80}
                value={f.questionCount}
                onChange={(e) => setF({ ...f, questionCount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Tempo (min)" htmlFor="m">
              <Input
                id="m"
                type="number"
                min={10}
                value={f.timeLimitMin}
                onChange={(e) => setF({ ...f, timeLimitMin: Number(e.target.value) })}
              />
            </Field>
          </div>
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Correção <strong className="text-foreground">só ao final</strong>: durante a prova não
            aparece se acertou ou errou. No fim você vê a pontuação, o balancete por matéria e a
            revisão com sua resposta e o gabarito.
          </p>
          <p className="text-xs text-muted-foreground">
            As questões vêm do banco TJSP e das provas oficiais, filtradas pelas matérias que você
            estudou na trilha.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={m.isPending || !subjects.length}
            onClick={() => m.mutate()}
          >
            Criar e iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, formatDate } from "@/components/common";
import { Field, NativeSelect } from "@/components/forms";
import { useMe } from "@/hooks/use-auth";
import { examsService } from "@/services";
import type { MockExam } from "@/types";

export const Route = createFileRoute("/_area/simulados/")({
  head: () => ({
    meta: [
      { title: "Simulados — Estufoo" },
      { name: "description", content: "Provas oficiais TJSP e simulados cronometrados." },
      { property: "og:title", content: "Simulados — Estufoo" },
      { property: "og:description", content: "Provas oficiais TJSP e simulados cronometrados." },
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
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a prova."),
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
          Cadernos reais de Escrevente Técnico Judiciário (Vunesp), com gabarito quando o PDF
          permite. Cronômetro de 5 horas — como no dia da prova.
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
          Simulados que você criou ou provas oficiais já iniciadas.
        </p>
        {q.isLoading ? (
          <ListSkeleton />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={q.refetch} />
        ) : !q.data!.length ? (
          <EmptyState
            title="Nenhum simulado ainda"
            action={
              <Button onClick={() => setOpen(true)}>Criar o primeiro</Button>
            }
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
  const [f, setF] = useState({
    title: "Simulado geral",
    questionCount: 10,
    timeLimitMin: 30,
    correctionMode: "ao-final" as MockExam["correctionMode"],
  });
  const m = useMutation({
    mutationFn: () =>
      examsService.create({ ...f, contestId: me.data?.activeContestId ?? "", subjects: [] }),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      nav({ to: "/simulados/$id", params: { id: e.id } });
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo simulado</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Título" htmlFor="t">
            <Input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Questões" htmlFor="n">
              <Input
                id="n"
                type="number"
                min={1}
                value={f.questionCount}
                onChange={(e) => setF({ ...f, questionCount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Tempo (min)" htmlFor="m">
              <Input
                id="m"
                type="number"
                min={1}
                value={f.timeLimitMin}
                onChange={(e) => setF({ ...f, timeLimitMin: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Correção" htmlFor="c">
            <NativeSelect
              id="c"
              value={f.correctionMode}
              onChange={(e) =>
                setF({ ...f, correctionMode: e.target.value as MockExam["correctionMode"] })
              }
            >
              <option value="ao-final">Ao final</option>
              <option value="imediata">Imediata</option>
            </NativeSelect>
          </Field>
          <p className="text-xs text-muted-foreground">
            As questões vêm do <strong>banco TJSP</strong>. Para a prova oficial completa, use os
            cards acima (2018 / 2025).
          </p>
        </div>
        <DialogFooter>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            Criar e iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Simulados — AprovaMind" }, { name: "description", content: "Crie e faça simulados cronometrados." }, { property: "og:title", content: "Simulados — AprovaMind" }, { property: "og:description", content: "Crie e faça simulados cronometrados." }] }),
  component: Exams,
});

function Exams() {
  const q = useQuery({ queryKey: ["exams"], queryFn: examsService.list });
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Simulados" actions={<Button onClick={() => setOpen(true)}><Plus />Novo simulado</Button>} />
      {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data!.length ? (
        <EmptyState title="Nenhum simulado ainda" action={<Button onClick={() => setOpen(true)}>Criar o primeiro</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data!.map((e) => (
            <div key={e.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{e.title}</p><p className="text-sm text-muted-foreground">{e.questionCount} questões · {e.timeLimitMin} min · {formatDate(e.createdAt)}</p></div>
                <Badge variant={e.status === "concluido" ? "secondary" : "outline"}>{e.status === "concluido" ? `${e.score ?? 0}%` : "Pendente"}</Badge>
              </div>
              <div className="mt-4">
                {e.status === "concluido"
                  ? <Button variant="outline" asChild><Link to="/simulados/$id/resultado" params={{ id: e.id }}>Ver resultado</Link></Button>
                  : <Button asChild><Link to="/simulados/$id" params={{ id: e.id }}>Iniciar</Link></Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <NewExam onClose={() => setOpen(false)} />}
    </>
  );
}

function NewExam({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState({ title: "Simulado geral", questionCount: 10, timeLimitMin: 30, correctionMode: "ao-final" as MockExam["correctionMode"] });
  const m = useMutation({
    mutationFn: () => examsService.create({ ...f, contestId: me.data?.activeContestId ?? "", subjects: [] }),
    onSuccess: (e) => { qc.invalidateQueries({ queryKey: ["exams"] }); nav({ to: "/simulados/$id", params: { id: e.id } }); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo simulado</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Título" htmlFor="t"><Input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Questões" htmlFor="n"><Input id="n" type="number" min={1} value={f.questionCount} onChange={(e) => setF({ ...f, questionCount: Number(e.target.value) })} /></Field>
            <Field label="Tempo (min)" htmlFor="m"><Input id="m" type="number" min={1} value={f.timeLimitMin} onChange={(e) => setF({ ...f, timeLimitMin: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Correção" htmlFor="c"><NativeSelect id="c" value={f.correctionMode} onChange={(e) => setF({ ...f, correctionMode: e.target.value as MockExam["correctionMode"] })}><option value="ao-final">Ao final</option><option value="imediata">Imediata</option></NativeSelect></Field>
        </div>
        <DialogFooter><Button disabled={m.isPending} onClick={() => m.mutate()}>Criar e iniciar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

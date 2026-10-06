import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/common";
import { Field, NativeSelect, errMsg } from "@/components/forms";
import { studyPlansService } from "@/services";
import type { StudySession } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_area/plano")({
  head: () => ({ meta: [{ title: "Plano de estudos — AprovaMind" }, { name: "description", content: "Seu cronograma semanal." }, { property: "og:title", content: "Plano de estudos — AprovaMind" }, { property: "og:description", content: "Seu cronograma semanal." }] }),
  component: Plan,
});

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function Plan() {
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialog, setDialog] = useState<string | null>(null);
  const range = { from: iso(week), to: iso(addDays(week, 6)) };
  const q = useQuery({ queryKey: ["sessions", range], queryFn: () => studyPlansService.sessions(range) });
  const inv = () => qc.invalidateQueries({ queryKey: ["sessions"] });
  const upd = useMutation({ mutationFn: ({ id, d }: { id: string; d: Partial<StudySession> }) => studyPlansService.update(id, d), onSuccess: inv, onError: (e) => toast.error(errMsg(e)) });
  const del = useMutation({ mutationFn: studyPlansService.remove, onSuccess: () => { inv(); toast.success("Sessão removida."); } });
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  return (
    <>
      <PageHeader title="Plano de estudos" description={`Semana de ${format(week, "dd 'de' MMM", { locale: ptBR })}`}
        actions={<>
          <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => setWeek(addDays(week, 7))}><ChevronRight /></Button>
          <Button onClick={() => setDialog(iso(new Date()))}><Plus />Nova sessão</Button>
        </>} />
      {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => {
            const items = q.data!.filter((s) => s.date === iso(d));
            return (
              <div key={iso(d)} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold capitalize">{format(d, "EEE dd", { locale: ptBR })}</p>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => setDialog(iso(d))} aria-label="Adicionar sessão"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="space-y-2">
                  {items.map((s) => (
                    <div key={s.id} className={cn("rounded-lg border p-2 text-xs", s.status === "concluida" && "bg-highlight-soft", s.status === "atrasada" && "border-destructive/40")}>
                      <p className="font-medium">{s.subject}</p>
                      <p className="text-muted-foreground">{s.topic}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{s.activity} · {s.durationMin}m</Badge>
                        <span className="flex gap-1">
                          {s.status !== "concluida" && <button aria-label="Concluir" onClick={() => upd.mutate({ id: s.id, d: { status: "concluida" } })}><Check className="h-3.5 w-3.5 text-highlight" /></button>}
                          <button aria-label="Remover" onClick={() => del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {dialog && <NewSession date={dialog} onClose={() => setDialog(null)} onSaved={inv} />}
    </>
  );
}

function NewSession({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Omit<StudySession, "id">>({ date, subject: "", topic: "", activity: "teoria", durationMin: 60, priority: "media", status: "planejada" });
  const m = useMutation({ mutationFn: studyPlansService.create, onSuccess: () => { onSaved(); onClose(); toast.success("Sessão criada."); } });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova sessão</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data" htmlFor="d"><Input id="d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Duração (min)" htmlFor="du"><Input id="du" type="number" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /></Field>
          <Field label="Matéria" htmlFor="s"><Input id="s" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Tópico" htmlFor="t"><Input id="t" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
          <Field label="Atividade" htmlFor="a"><NativeSelect id="a" value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value as StudySession["activity"] })}><option value="teoria">Teoria</option><option value="questoes">Questões</option><option value="revisao">Revisão</option><option value="simulado">Simulado</option></NativeSelect></Field>
          <Field label="Prioridade" htmlFor="p"><NativeSelect id="p" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as StudySession["priority"] })}><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option></NativeSelect></Field>
        </div>
        <DialogFooter><Button disabled={!f.subject || m.isPending} onClick={() => m.mutate(f)}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

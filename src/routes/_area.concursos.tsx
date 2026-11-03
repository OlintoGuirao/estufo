import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, formatDate } from "@/components/common";
import { NativeSelect, errMsg } from "@/components/forms";
import { useMe } from "@/hooks/use-auth";
import { contestsService } from "@/services";

export const Route = createFileRoute("/_area/concursos")({
  head: () => ({ meta: [{ title: "Concursos — Estufoo" }, { name: "description", content: "Encontre concursos e importe editais." }, { property: "og:title", content: "Concursos — Estufoo" }, { property: "og:description", content: "Encontre concursos e importe editais." }] }),
  component: Contests,
});

function Contests() {
  const qc = useQueryClient();
  const me = useMe();
  const [f, setF] = useState({ search: "", board: "", status: "todos" });
  const [pct, setPct] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ["contests", f], queryFn: () => contestsService.list(f) });
  const activate = useMutation({ mutationFn: contestsService.setActive, onSuccess: (u) => { qc.setQueryData(["me"], u); qc.invalidateQueries(); toast.success("Concurso ativo atualizado."); } });
  const imp = useMutation({
    mutationFn: (fl: File) => contestsService.importNotice(fl, setPct),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contests"] }); toast.success("Edital importado."); },
    onError: (e) => toast.error(errMsg(e)),
    onSettled: () => setPct(null),
  });
  return (
    <>
      <PageHeader title="Concursos" actions={<>
        <input ref={file} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && imp.mutate(e.target.files[0])} />
        <Button variant="highlight" onClick={() => file.current?.click()} disabled={imp.isPending}><Upload />Importar edital (PDF)</Button>
      </>} />
      {pct !== null && <div className="mb-4"><p className="mb-1 text-sm">Enviando edital... {pct}%</p><Progress value={pct} /></div>}
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <Input placeholder="Buscar concurso" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
        <NativeSelect aria-label="Banca" value={f.board} onChange={(e) => setF({ ...f, board: e.target.value })}><option value="">Todas as bancas</option><option>Cebraspe</option><option>FGV</option><option>FCC</option><option>Vunesp</option></NativeSelect>
        <NativeSelect aria-label="Situação" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="todos">Todas</option><option value="aberto">Aberto</option><option value="previsto">Previsto</option><option value="encerrado">Encerrado</option></NativeSelect>
      </div>
      {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data!.length ? <EmptyState title="Nenhum concurso encontrado" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data!.map((c) => {
            const active = me.data?.activeContestId === c.id;
            return (
              <div key={c.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold">{c.name}</p><Badge variant={c.status === "aberto" ? "default" : "outline"}>{c.status}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{c.organ}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-muted-foreground">Banca</dt><dd>{c.board}</dd></div>
                  <div><dt className="text-muted-foreground">Prova</dt><dd>{formatDate(c.examDate)}</dd></div>
                  <div><dt className="text-muted-foreground">Vagas</dt><dd>{c.vacancies}</dd></div>
                  <div><dt className="text-muted-foreground">Salário</dt><dd>{c.salary.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div>
                </dl>
                <Button className="mt-4" variant={active ? "secondary" : "outline"} disabled={active} onClick={() => activate.mutate(c.id)}>{active ? "Concurso ativo" : "Definir como ativo"}</Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

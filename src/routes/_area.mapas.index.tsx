import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Network, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, GridSkeleton, PageHeader, formatDate } from "@/components/common";
import { Field, NativeSelect } from "@/components/forms";
import { mindMapsService } from "@/services";

export const Route = createFileRoute("/_area/mapas/")({
  head: () => ({ meta: [{ title: "Mapas mentais — AprovaMind" }, { name: "description", content: "Organize os tópicos do edital em mapas mentais." }, { property: "og:title", content: "Mapas mentais — AprovaMind" }, { property: "og:description", content: "Organize os tópicos do edital em mapas mentais." }] }),
  component: Maps,
});

function Maps() {
  const q = useQuery({ queryKey: ["mind-maps"], queryFn: mindMapsService.list });
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Mapas mentais" actions={<Button onClick={() => setOpen(true)}><Plus />Novo mapa</Button>} />
      {q.isLoading ? <GridSkeleton count={3} /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : !q.data!.length ? (
        <EmptyState title="Nenhum mapa ainda" action={<Button onClick={() => setOpen(true)}>Criar mapa</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data!.map((m) => (
            <Link key={m.id} to="/mapas/$id" params={{ id: m.id }} className="rounded-xl border bg-card p-5 shadow-card transition-colors hover:border-primary">
              <Network className="h-5 w-5 text-highlight" />
              <p className="mt-3 font-semibold">{m.title}</p>
              <p className="text-sm text-muted-foreground">{m.subject} · {m.nodeCount} tópicos</p>
              <p className="mt-2 text-xs text-muted-foreground">Atualizado em {formatDate(m.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
      {open && <NewMap onClose={() => setOpen(false)} />}
    </>
  );
}

function NewMap({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [f, setF] = useState({ title: "", subject: "Direito Previdenciário", mode: "edital" });
  const m = useMutation({
    mutationFn: () => mindMapsService.create({ title: f.title, subject: f.subject, fromNotice: f.mode === "edital", ai: f.mode === "ia" }),
    onSuccess: (r) => nav({ to: "/mapas/$id", params: { id: r.id } }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo mapa mental</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Título" htmlFor="t"><Input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Matéria" htmlFor="s"><NativeSelect id="s" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}><option>Direito Previdenciário</option><option>Língua Portuguesa</option><option>Direito Constitucional</option><option>Raciocínio Lógico</option></NativeSelect></Field>
          <Field label="Começar a partir de" htmlFor="mo"><NativeSelect id="mo" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="edital">Tópicos do edital</option><option value="ia">Tópicos com resumos</option><option value="vazio">Mapa em branco</option></NativeSelect></Field>
        </div>
        <DialogFooter><Button disabled={!f.title || m.isPending} onClick={() => m.mutate()}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

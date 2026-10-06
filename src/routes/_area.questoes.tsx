import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/common";
import { NativeSelect, errMsg } from "@/components/forms";
import { questionsService } from "@/services";
import type { AnswerResult, Question, QuestionFilters } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_area/questoes")({
  head: () => ({ meta: [{ title: "Questões — AprovaMind" }, { name: "description", content: "Banco de questões de concursos." }, { property: "og:title", content: "Questões — AprovaMind" }, { property: "og:description", content: "Banco de questões de concursos." }] }),
  component: Questions,
});

function Questions() {
  const [f, setF] = useState<QuestionFilters>({ status: "todas", page: 1 });
  const q = useQuery({ queryKey: ["questions", f], queryFn: () => questionsService.list(f) });
  const set = (k: keyof QuestionFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => setF({ ...f, [k]: e.target.value, page: 1 });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  return (
    <>
      <PageHeader title="Questões" description={q.data ? `${q.data.total} questões encontradas` : undefined} />
      <div className="mb-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <NativeSelect aria-label="Banca" value={f.board ?? ""} onChange={set("board")}><option value="">Todas as bancas</option><option>Cebraspe</option><option>FGV</option><option>FCC</option><option>Vunesp</option></NativeSelect>
        <NativeSelect aria-label="Matéria" value={f.subject ?? ""} onChange={set("subject")}><option value="">Todas as matérias</option><option>Direito Previdenciário</option><option>Língua Portuguesa</option><option>Direito Constitucional</option><option>Raciocínio Lógico</option></NativeSelect>
        <NativeSelect aria-label="Ano" value={f.year ?? ""} onChange={set("year")}><option value="">Todos os anos</option>{[2025, 2024, 2023, 2022].map((y) => <option key={y}>{y}</option>)}</NativeSelect>
        <NativeSelect aria-label="Dificuldade" value={f.difficulty ?? ""} onChange={set("difficulty")}><option value="">Qualquer dificuldade</option><option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option></NativeSelect>
        <NativeSelect aria-label="Situação" value={f.status} onChange={set("status")}><option value="todas">Todas</option><option value="respondidas">Respondidas</option><option value="nao-respondidas">Não respondidas</option><option value="erradas">Erradas</option><option value="favoritas">Favoritas</option></NativeSelect>
      </div>
      {q.isLoading ? <ListSkeleton /> : q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data!.items.length === 0 ? (
        <EmptyState title="Nenhuma questão encontrada" description="Ajuste os filtros para ver mais questões." />
      ) : (
        <div className="space-y-4">
          {q.data!.items.map((x) => <QuestionCard key={x.id} q={x} />)}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" disabled={(f.page ?? 1) <= 1} onClick={() => setF({ ...f, page: (f.page ?? 1) - 1 })}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {f.page} de {pages}</span>
            <Button variant="outline" disabled={(f.page ?? 1) >= pages} onClick={() => setF({ ...f, page: (f.page ?? 1) + 1 })}>Próxima</Button>
          </div>
        </div>
      )}
    </>
  );
}

export function QuestionCard({ q }: { q: Question }) {
  const qc = useQueryClient();
  const [choice, setChoice] = useState<string | null>(q.answered?.choice ?? null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [start] = useState(Date.now());
  const answer = useMutation({
    mutationFn: () => questionsService.answer(q.id, { choice: choice!, timeSec: Math.round((Date.now() - start) / 1000) }),
    onSuccess: setResult,
    onError: (e) => toast.error(errMsg(e)),
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["questions"] });
  const fav = useMutation({ mutationFn: () => questionsService.favorite(q.id), onSuccess: inv });
  const rev = useMutation({ mutationFn: () => questionsService.review(q.id), onSuccess: () => { inv(); toast.success("Questão marcada para revisão."); } });
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{q.board}</Badge><Badge variant="outline">{q.year}</Badge><Badge variant="outline">{q.subject}</Badge>
        <span className="text-muted-foreground">{q.topic} · {q.difficulty}</span>
        <span className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Favoritar" onClick={() => fav.mutate()}><Star className={cn(q.favorite && "fill-warning text-warning")} /></Button>
          <Button size="icon" variant="ghost" aria-label="Marcar para revisão" onClick={() => rev.mutate()}><Bookmark className={cn(q.markedForReview && "fill-primary text-primary")} /></Button>
        </span>
      </div>
      <p className="leading-relaxed">{q.statement}</p>
      <div className="mt-4 space-y-2" role="radiogroup">
        {q.alternatives.map((a) => {
          const isCorrect = result?.correctKey === a.key;
          const isWrong = result && choice === a.key && !result.correct;
          return (
            <button key={a.key} role="radio" aria-checked={choice === a.key} disabled={!!result} onClick={() => setChoice(a.key)}
              className={cn("flex w-full gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                choice === a.key && !result && "border-primary bg-accent", isCorrect && "border-highlight bg-highlight-soft", isWrong && "border-destructive bg-destructive/10")}>
              <span className="font-semibold">{a.key})</span>{a.text}
            </button>
          );
        })}
      </div>
      {result ? (
        <div className={cn("mt-4 rounded-lg p-4 text-sm", result.correct ? "bg-highlight-soft" : "bg-destructive/10")}>
          <p className="font-semibold">{result.correct ? "Você acertou!" : `Resposta correta: ${result.correctKey}`}</p>
          <p className="mt-1 text-muted-foreground">{result.explanation}</p>
        </div>
      ) : (
        <Button className="mt-4" disabled={!choice || answer.isPending} onClick={() => answer.mutate()}>Responder</Button>
      )}
    </Panel>
  );
}

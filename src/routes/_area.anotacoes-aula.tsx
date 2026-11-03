import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { videoLessonNotesStore } from "@/services/video-lesson-notes-store";
import { useState } from "react";

export const Route = createFileRoute("/_area/anotacoes-aula")({
  head: () => ({
    meta: [
      { title: "Anotações de aula — Estufoo" },
      { name: "description", content: "Anotações salvas por videoaula." },
    ],
  }),
  component: AnotacoesAulaPage,
});

function AnotacoesAulaPage() {
  const [tick, setTick] = useState(0);
  useQuery({
    queryKey: ["video-notes-hydrate"],
    queryFn: () => videoLessonNotesStore.hydrate(),
  });
  const notes = videoLessonNotesStore.list();
  void tick;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Anotações de aula</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada card é uma anotação de videoaula (título obrigatório).
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/video-aulas">
            <Clapperboard className="h-4 w-4" />
            Video aulas
          </Link>
        </Button>
      </div>

      {!notes.length && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <NotebookPen className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Nenhuma anotação ainda. Abra uma videoaula e use o botão Anotações.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {notes.map((n) => (
          <article key={n.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold leading-snug">{n.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {n.subjectName} · {n.lessonTitle}
            </p>
            <p className="mt-3 line-clamp-6 flex-1 whitespace-pre-wrap text-sm text-foreground/90">
              {n.body || "—"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link
                  to="/video-aulas/$subjectId"
                  params={{ subjectId: n.subjectId }}
                  search={{ lesson: n.lessonId }}
                >
                  Abrir aula
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  videoLessonNotesStore.remove(n.id);
                  setTick((t) => t + 1);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

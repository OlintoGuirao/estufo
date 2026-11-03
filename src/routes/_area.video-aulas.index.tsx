import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clapperboard, NotebookPen } from "lucide-react";
import { listVideoSubjectsFn } from "@/services/video-lessons.fns";
import { videoLessonProgressStore } from "@/services/video-lesson-progress-store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_area/video-aulas/")({
  head: () => ({
    meta: [
      { title: "Video aulas — Estufoo" },
      { name: "description", content: "Videoaulas por matéria com quiz e anotações." },
    ],
  }),
  component: VideoAulasIndex,
});

function VideoAulasIndex() {
  const q = useQuery({
    queryKey: ["video-subjects", "bunny-v3-proxy"],
    queryFn: () => listVideoSubjectsFn(),
    staleTime: 0,
  });

  useQuery({
    queryKey: ["video-progress-hydrate"],
    queryFn: () => videoLessonProgressStore.hydrate(),
  });

  const progress = videoLessonProgressStore.all();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Video aulas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha a matéria. Ao abrir a aula, o progresso fica salvo se você pausar no meio.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/anotacoes-aula">
            <NotebookPen className="h-4 w-4" />
            Anotações de aula
          </Link>
        </Button>
      </div>

      {q.isLoading && (
        <p className="text-sm text-muted-foreground">Carregando matérias...</p>
      )}

      {q.data?.provider === "bunny" && q.data.available && (
        <p className="text-xs text-muted-foreground">Fonte: Bunny CDN · {q.data.subjects.length} matéria(s)</p>
      )}
      {q.data?.warning && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {q.data.warning}
        </div>
      )}

      {q.data && !q.data.available && (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Nenhuma videoaula encontrada em{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{q.data.source}</code>.
          {q.data.provider === "bunny" ? (
            <>
              {" "}
              Confira <code className="text-xs">BUNNY_STORAGE_ZONE</code>,{" "}
              <code className="text-xs">BUNNY_STORAGE_ACCESS_KEY</code> e{" "}
              <code className="text-xs">BUNNY_CDN_BASE_URL</code> no <code className="text-xs">.env</code>.
            </>
          ) : (
            <>
              {" "}
              Ou configure a Bunny no <code className="text-xs">.env</code> (recomendado para acesso
              externo).
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(q.data?.subjects ?? []).map((s) => {
          const done = Object.values(progress).filter(
            (p) => p.subjectId === s.id && p.completed,
          ).length;
          return (
            <Link
              key={s.id}
              to="/video-aulas/$subjectId"
              params={{ subjectId: s.id }}
              className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clapperboard className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold group-hover:text-primary">{s.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                {s.lessonCount} aulas
                {done > 0 ? ` · ${done} concluída(s)` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

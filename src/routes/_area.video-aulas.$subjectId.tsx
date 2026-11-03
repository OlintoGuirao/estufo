import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, NotebookPen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listVideoLessonsFn } from "@/services/video-lessons.fns";
import { videoLessonProgressStore } from "@/services/video-lesson-progress-store";
import { VideoLessonNotesDialog } from "@/components/video-lessons/notes-dialog";
import { VideoLessonQuiz } from "@/components/video-lessons/lesson-quiz";
import { MpegTsLessonPlayer } from "@/components/video-lessons/mpegts-player";
import { LessonThumb } from "@/components/video-lessons/lesson-thumb";
import { cn } from "@/lib/utils";
import type { VideoLesson } from "@/server/video-lessons/catalog";

export const Route = createFileRoute("/_area/video-aulas/$subjectId")({
  validateSearch: (s: Record<string, unknown>): { lesson?: string } => ({
    lesson: typeof s["lesson"] === "string" ? s["lesson"] : undefined,
  }),
  head: ({ params }) => ({
    meta: [{ title: `Video aulas — ${params.subjectId} — Estufoo` }],
  }),
  component: VideoAulasPlayer,
});

function VideoAulasPlayer() {
  const { subjectId } = Route.useParams();
  const search = Route.useSearch();
  const lessonsQ = useQuery({
    queryKey: ["video-lessons", "bunny-v5-thumbs", subjectId],
    queryFn: () => listVideoLessonsFn({ data: { subjectId } }),
    staleTime: 0,
  });

  const lessons = lessonsQ.data?.lessons ?? [];
  const activeId = search.lesson || lessons[0]?.id;
  const active = useMemo(
    () => lessons.find((l) => l.id === activeId) ?? lessons[0] ?? null,
    [lessons, activeId],
  );

  const [ended, setEnded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [progressTick, setProgressTick] = useState(0);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    void videoLessonProgressStore.hydrate();
  }, []);

  useEffect(() => {
    setEnded(false);
  }, [active?.id]);

  const persistProgress = (
    lesson: VideoLesson,
    currentTime: number,
    duration: number,
    completed: boolean,
  ) => {
    videoLessonProgressStore.save({
      lessonId: lesson.id,
      subjectId: lesson.subjectId,
      subjectName: lesson.subjectName,
      lessonTitle: lesson.title,
      lessonOrder: lesson.order,
      currentTime,
      duration,
      completed: completed || currentTime / Math.max(duration, 1) >= 0.95,
    });
    setProgressTick((t) => t + 1);
  };

  const progressBag = videoLessonProgressStore.all();
  void progressTick;
  const suggestedTitle = active ? `${active.subjectName} aula ${active.order}` : "Aula";
  const resumeAt = active ? progressBag[active.id]?.currentTime ?? 0 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/video-aulas">
            <ArrowLeft className="h-4 w-4" />
            Matérias
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/anotacoes-aula">
            <NotebookPen className="h-4 w-4" />
            Anotações de aula
          </Link>
        </Button>
      </div>

      {lessonsQ.isLoading && (
        <p className="text-sm text-muted-foreground">Carregando aulas...</p>
      )}

      {!lessonsQ.isLoading && !lessons.length && (
        <p className="text-sm text-muted-foreground">Nenhuma aula nesta matéria.</p>
      )}

      {active && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <MpegTsLessonPlayer
              key={active.id}
              src={active.streamPath}
              initialTime={
                progressBag[active.id]?.completed ? 0 : resumeAt
              }
              onTimeUpdate={(currentTime, duration) => {
                if (saveTimer.current) window.clearTimeout(saveTimer.current);
                saveTimer.current = window.setTimeout(() => {
                  persistProgress(active, currentTime, duration, false);
                }, 800);
              }}
              onPause={(currentTime, duration) => {
                persistProgress(active, currentTime, duration, false);
              }}
              onEnded={(duration) => {
                persistProgress(active, duration, duration, true);
                setEnded(true);
              }}
            />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold leading-snug">{active.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.subjectName} · Aula {active.order} de {lessons.length}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setNotesOpen(true)}>
                <NotebookPen className="h-4 w-4" />
                Anotações
              </Button>
            </div>

            {(ended || progressBag[active.id]?.completed) && (
              <VideoLessonQuiz
                key={active.id}
                lessonId={active.id}
                subjectName={active.subjectName}
                lessonTitle={active.title}
              />
            )}
          </div>

          <aside className="flex max-h-[min(80vh,720px)] flex-col overflow-hidden rounded-xl border bg-[#0f0f0f] text-white shadow-sm">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold leading-snug">{active.subjectName}</h2>
              <p className="mt-0.5 text-xs text-white/60">
                {lessons.length} aulas nesta matéria
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {lessons.map((lesson) => {
                const isActive = lesson.id === active.id;
                const p = progressBag[lesson.id];
                return (
                  <Link
                    key={lesson.id}
                    to="/video-aulas/$subjectId"
                    params={{ subjectId }}
                    search={{ lesson: lesson.id }}
                    className={cn(
                      "flex gap-3 px-3 py-2.5 transition-colors hover:bg-white/5",
                      isActive && "bg-[#3d2a1f]",
                    )}
                  >
                    <div className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded bg-white/10">
                      <LessonThumb thumbPath={lesson.thumbPath} order={lesson.order} />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[9px] font-medium tabular-nums text-white/90">
                        {String(lesson.order).padStart(2, "0")}
                      </span>
                      {isActive && (
                        <span className="absolute left-1 top-1 rounded bg-black/70 p-0.5">
                          <Play className="h-3 w-3 fill-white text-white" />
                        </span>
                      )}
                      {p?.completed && (
                        <span className="absolute bottom-1 right-1 rounded bg-emerald-600 px-1 text-[9px] font-medium">
                          OK
                        </span>
                      )}
                      {p && !p.completed && p.duration > 0 && (
                        <span
                          className="absolute bottom-0 left-0 h-0.5 bg-red-500"
                          style={{
                            width: `${Math.min(100, (p.currentTime / p.duration) * 100)}%`,
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{lesson.title}</p>
                      <p className="mt-1 text-xs text-white/55">{active.subjectName}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {active && (
        <VideoLessonNotesDialog
          open={notesOpen}
          onOpenChange={setNotesOpen}
          lessonId={active.id}
          subjectId={active.subjectId}
          subjectName={active.subjectName}
          lessonTitle={active.title}
          suggestedTitle={suggestedTitle}
        />
      )}
    </div>
  );
}

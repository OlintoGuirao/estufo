import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Clapperboard, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/common";
import { videoLessonProgressStore } from "@/services/video-lesson-progress-store";
import { listVideoLessonsFn } from "@/services/video-lessons.fns";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Card de videoaulas no /painel — continua de onde parou ou atalho para assistir. */
export function VideoLessonResumeCard({ className }: Props) {
  const progressQ = useQuery({
    queryKey: ["video-lesson-progress"],
    queryFn: () => videoLessonProgressStore.hydrate(),
  });

  const resume = useMemo(
    () => videoLessonProgressStore.getResumePoint(progressQ.data),
    [progressQ.data],
  );

  const lessonsQ = useQuery({
    queryKey: ["video-lessons", "resume", resume?.subjectId],
    queryFn: () => listVideoLessonsFn({ data: { subjectId: resume!.subjectId } }),
    enabled: !!resume?.subjectId && (!resume.lessonTitle || !resume.subjectName),
    staleTime: 60_000,
  });

  const lessonMeta = useMemo(() => {
    if (!resume) return null;
    const fromCatalog = lessonsQ.data?.lessons.find((l) => l.id === resume.lessonId);
    return {
      subjectName: resume.subjectName || fromCatalog?.subjectName || resume.subjectId,
      title: resume.lessonTitle || fromCatalog?.title || "Videoaula",
      order: resume.lessonOrder ?? fromCatalog?.order,
    };
  }, [resume, lessonsQ.data]);

  if (resume && lessonMeta) {
    const total = resume.duration > 0 ? resume.duration : 0;
    const pct =
      total > 0 ? Math.min(100, Math.round((resume.currentTime / total) * 100)) : null;

    return (
      <Panel className={cn("border-sky-500/30 bg-sky-500/5", className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              <Clapperboard className="h-3.5 w-3.5" />
              Continuar videoaula
            </p>
            <p className="mt-1 font-display text-lg font-bold leading-snug">
              {lessonMeta.subjectName}
              {lessonMeta.order != null ? ` · Aula ${lessonMeta.order}` : ""}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{lessonMeta.title}</p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {formatClock(resume.currentTime)}
              {total > 0 ? ` / ${formatClock(total)}` : ""}
              {pct != null ? ` · ${pct}%` : ""}
            </p>
          </div>
          <Button asChild variant="default" size="sm" className="shrink-0">
            <Link
              to="/video-aulas/$subjectId"
              params={{ subjectId: resume.subjectId }}
              search={{ lesson: resume.lessonId }}
            >
              <Play className="h-4 w-4" />
              Continuar
            </Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className={cn("border-sky-500/30 bg-sky-500/5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            <Clapperboard className="h-3.5 w-3.5" />
            Videoaulas
          </p>
          <p className="mt-1 font-display text-lg font-bold leading-snug">Assistir videoaulas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quando pausar no meio, o progresso aparece aqui para continuar.
          </p>
        </div>
        <Button asChild variant="default" size="sm" className="shrink-0">
          <Link to="/video-aulas">
            <Play className="h-4 w-4" />
            Abrir
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

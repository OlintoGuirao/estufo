import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/common";
import { approvalTrailService } from "@/services/approval-trail.service";
import { trailProgressService } from "@/services/trail-progress.service";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Card "Continuar de onde parei" — Trilha e Painel. */
export function TrailResumeCard({ className }: Props) {
  const trailQ = useQuery({
    queryKey: ["approval-trail"],
    queryFn: () => approvalTrailService.hydrate(),
  });
  const trail = trailQ.data;
  const progressAllQ = useQuery({
    queryKey: ["trail-progress-all", trail?.id],
    queryFn: () => trailProgressService.hydrateAll(trail!.id),
    enabled: !!trail?.id,
  });

  const resumePoint = useMemo(() => {
    if (!trail?.id || !trail.weeks.length) return null;
    const unlocked =
      trail.scheduleUnlocked ||
      trail.subjects.some((s) => s.topics.some((t) => !!t.explanation?.trim()));
    if (!unlocked) return null;
    void progressAllQ.data;
    return trailProgressService.getResumePoint(trail.id, trail.weeks);
  }, [trail, progressAllQ.data]);

  if (!resumePoint) return null;

  return (
    <Panel className={cn("border-highlight/35 bg-highlight-soft/25", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-highlight">
            Continuar de onde parei
          </p>
          <p className="mt-1 font-display text-lg font-bold leading-snug">
            {resumePoint.dayLabel ?? `Dia ${resumePoint.week}`}
            {resumePoint.weekNumber != null ? ` · Semana ${resumePoint.weekNumber}` : ""}
            {resumePoint.moduleIndex != null ? ` · Material ${resumePoint.moduleIndex}` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{resumePoint.focus}</p>
        </div>
        <Button asChild variant="highlight" size="sm" className="shrink-0">
          <Link
            to="/trilha/semana/$week"
            params={{ week: String(resumePoint.week) }}
            search={resumePoint.moduleIndex != null ? { m: resumePoint.moduleIndex } : {}}
          >
            <Play className="h-4 w-4" />
            Continuar
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

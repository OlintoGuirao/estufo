import type { QueryClient } from "@tanstack/react-query";
import { trailWeekLessonService } from "@/services/trail-week-lesson.service";
import type { ApprovalTrail } from "@/types/approval-trail";

/**
 * Prepara "por baixo dos panos" as aulas dos próximos dias da trilha.
 *
 * Uma de cada vez (para não pesar na IA nem no celular), só as próximas
 * `ahead`, e usando a MESMA chave de cache da tela da semana: se o aluno
 * abrir o dia enquanto ele ainda está sendo montado, a tela aproveita a
 * geração em andamento em vez de começar outra. A aula fica salva no
 * aparelho e no banco — no outro dia ela abre na hora.
 */
let running: Promise<void> | null = null;

export function prefetchUpcomingLessons(
  qc: QueryClient,
  trail: ApprovalTrail | null | undefined,
  fromWeek: number,
  opts: { ahead?: number; includeFrom?: boolean; delayMs?: number } = {},
): void {
  if (!trail?.weeks.length || running) return;
  const ahead = opts.ahead ?? 2;
  const ordered = [...trail.weeks].sort((a, b) => a.week - b.week);
  const startIdx = ordered.findIndex((w) => (opts.includeFrom ? w.week >= fromWeek : w.week > fromWeek));
  if (startIdx < 0) return;
  const targets = ordered.slice(startIdx, startIdx + ahead).map((w) => w.week);
  if (!targets.length) return;

  running = (async () => {
    await new Promise((r) => setTimeout(r, opts.delayMs ?? 2500));
    for (const week of targets) {
      const key = ["trail-week-lesson", trail.id, week];
      if (qc.getQueryData(key)) continue;
      // Já existe no aparelho ou no banco? Então só aquece o cache (rápido).
      const cached = trailWeekLessonService.getCached(trail.id, week);
      if (cached?.modules?.length) {
        qc.setQueryData(key, cached);
        continue;
      }
      try {
        await qc.prefetchQuery({
          queryKey: key,
          queryFn: () => trailWeekLessonService.ensureLesson(week),
          staleTime: Infinity,
        });
      } catch {
        /* silencioso: o dia gera normalmente quando o aluno abrir */
      }
    }
  })().finally(() => {
    running = null;
  });
}

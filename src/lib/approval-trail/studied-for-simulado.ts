import type { ApprovalTrail, TrailWeek } from "@/types/approval-trail";
import type { TrailWeekProgress } from "@/types/trail-progress";

export type TrailStudySnapshot = {
  /** Número da semana de estudo (ex.: 1 = primeira semana Mon–Sex). */
  weekNumber: number | null;
  /** Dias concluídos/em andamento nessa semana. */
  days: Array<{ week: number; dayLabel?: string; focus: string; subjects: string[] }>;
  /** Matérias únicas cobertas. */
  subjects: string[];
  /** Quantos dias da semana entraram no recorte. */
  dayCount: number;
  label: string;
};

function weekMeta(trail: ApprovalTrail, week: number): TrailWeek | undefined {
  return trail.weeks.find((w) => w.week === week);
}

/**
 * Recorta a última semana de estudo da trilha (ex.: seg–sex) com dias
 * concluídos ou em andamento — base para o "Novo simulado".
 */
export function getTrailStudySnapshotForSimulado(
  trail: ApprovalTrail | null | undefined,
  progress: TrailWeekProgress[] | null | undefined,
): TrailStudySnapshot | null {
  if (!trail?.weeks?.length) return null;
  const list = progress ?? [];
  const relevant = list.filter(
    (p) => p.status === "concluida" || p.status === "em-andamento",
  );
  if (!relevant.length) {
    // Fallback: tópicos marcados como concluídos no material.
    const subjects = [
      ...new Set(
        trail.subjects
          .filter((s) => s.topics.some((t) => t.status === "concluida"))
          .map((s) => s.name),
      ),
    ];
    if (!subjects.length) return null;
    return {
      weekNumber: null,
      days: [],
      subjects,
      dayCount: 0,
      label: "Matérias com etapas concluídas na trilha",
    };
  }

  const withMeta = relevant
    .map((p) => {
      const meta = weekMeta(trail, p.week);
      return {
        progress: p,
        meta,
        weekNumber: meta?.weekNumber ?? Math.ceil(p.week / 5),
      };
    })
    .filter((x) => x.meta);

  if (!withMeta.length) return null;

  const latestWeekNumber = Math.max(...withMeta.map((x) => x.weekNumber));
  const inWeek = withMeta
    .filter((x) => x.weekNumber === latestWeekNumber)
    .sort((a, b) => a.progress.week - b.progress.week);

  const subjects = [
    ...new Set(inWeek.flatMap((x) => x.meta?.subjectNames ?? []).filter(Boolean)),
  ];

  // Se a semana não trouxe subjectNames, resolve pelos topicIds.
  if (!subjects.length) {
    const topicIds = new Set(inWeek.flatMap((x) => x.progress.topicIds ?? x.meta?.topicIds ?? []));
    for (const s of trail.subjects) {
      if (s.topics.some((t) => topicIds.has(t.id) || t.status === "concluida")) {
        subjects.push(s.name);
      }
    }
  }

  const uniqueSubjects = [...new Set(subjects)];
  if (!uniqueSubjects.length) return null;

  const days = inWeek.map((x) => ({
    week: x.progress.week,
    dayLabel: x.meta?.dayLabel,
    focus: x.meta?.focus ?? `Dia ${x.progress.week}`,
    subjects: x.meta?.subjectNames ?? [],
  }));

  const dayLabels = days.map((d) => d.dayLabel).filter(Boolean);
  const range =
    dayLabels.length >= 2
      ? `${dayLabels[0]} a ${dayLabels[dayLabels.length - 1]}`
      : dayLabels[0] || `${days.length} dia(s)`;

  return {
    weekNumber: latestWeekNumber,
    days,
    subjects: uniqueSubjects,
    dayCount: days.length,
    label: `Semana ${latestWeekNumber} · ${range}`,
  };
}

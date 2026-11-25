import type { ApprovalTrail, TrailWeek } from "@/types/approval-trail";
import type { TrailWeekProgress } from "@/types/trail-progress";

export type TrailStudyDay = {
  week: number;
  dayLabel?: string;
  focus: string;
  subjects: string[];
};

export type TrailStudySnapshot = {
  /** Número da semana de estudo (ex.: 1 = primeira semana Mon–Sex). */
  weekNumber: number | null;
  /** Dias que entraram no recorte (concluídos ou com estudo real). */
  days: TrailStudyDay[];
  /** Matérias únicas cobertas. */
  subjects: string[];
  /** Quantos dias da semana entraram no recorte. */
  dayCount: number;
  /** Quantos dias a semana tem no cronograma da trilha. */
  totalDays: number;
  /** Todos os dias da semana concluídos. */
  complete: boolean;
  label: string;
};

type Entry = { progress: TrailWeekProgress; meta: TrailWeek; weekNumber: number };

function entriesFor(trail: ApprovalTrail, list: TrailWeekProgress[]): Entry[] {
  const out: Entry[] = [];
  for (const p of list) {
    const meta = trail.weeks.find((w) => w.week === p.week);
    if (!meta) continue;
    out.push({ progress: p, meta, weekNumber: meta.weekNumber ?? Math.ceil(p.week / 5) });
  }
  return out;
}

/** Monta o recorte de UMA semana a partir dos dias informados. */
function buildSnapshot(
  trail: ApprovalTrail,
  inWeek: Entry[],
  weekNumber: number,
): TrailStudySnapshot | null {
  const sorted = [...inWeek].sort((a, b) => a.progress.week - b.progress.week);
  const subjects = new Set(sorted.flatMap((x) => x.meta.subjectNames ?? []).filter(Boolean));

  // Sem subjectNames: resolve só pelos tópicos DESTES dias.
  if (!subjects.size) {
    const topicIds = new Set(sorted.flatMap((x) => x.progress.topicIds ?? x.meta.topicIds ?? []));
    for (const s of trail.subjects) {
      if (s.topics.some((t) => topicIds.has(t.id))) subjects.add(s.name);
    }
  }
  if (!subjects.size) return null;

  const days: TrailStudyDay[] = sorted.map((x) => ({
    week: x.progress.week,
    ...(x.meta.dayLabel ? { dayLabel: x.meta.dayLabel } : {}),
    focus: x.meta.focus || `Dia ${x.progress.week}`,
    subjects: x.meta.subjectNames ?? [],
  }));

  const totalDays =
    trail.weeks.filter((w) => (w.weekNumber ?? Math.ceil(w.week / 5)) === weekNumber).length ||
    days.length;
  const complete =
    sorted.length >= totalDays && sorted.every((x) => x.progress.status === "concluida");

  const dayLabels = days.map((d) => d.dayLabel).filter(Boolean);
  const range =
    dayLabels.length >= 2
      ? `${dayLabels[0]} a ${dayLabels[dayLabels.length - 1]}`
      : dayLabels[0] || `${days.length} dia(s)`;

  return {
    weekNumber,
    days,
    subjects: [...subjects],
    dayCount: days.length,
    totalDays,
    complete,
    label: `Semana ${weekNumber} · ${range}`,
  };
}

/**
 * Semanas da trilha com dias CONCLUÍDOS (mais recente primeiro). Cada uma
 * traz só os dias concluídos — base para escolher a semana do "Novo simulado".
 */
export function listConcludedTrailWeeks(
  trail: ApprovalTrail | null | undefined,
  progress: TrailWeekProgress[] | null | undefined,
): TrailStudySnapshot[] {
  if (!trail?.weeks?.length) return [];
  const done = entriesFor(trail, (progress ?? []).filter((p) => p.status === "concluida"));
  const weekNumbers = [...new Set(done.map((x) => x.weekNumber))].sort((a, b) => b - a);
  return weekNumbers
    .map((n) => buildSnapshot(trail, done.filter((x) => x.weekNumber === n), n))
    .filter((s): s is TrailStudySnapshot => !!s);
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
  // Só abrir um dia já o marca "em andamento" (módulo ativo automático). Sem
  // estudo real, espiar a próxima semana fazia o simulado puxar essa semana.
  const relevant = list.filter(
    (p) => p.status === "concluida" || (p.status === "em-andamento" && hasRealStudy(p)),
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
      totalDays: 0,
      complete: false,
      label: "Matérias com etapas concluídas na trilha",
    };
  }

  const withMeta = entriesFor(trail, relevant);
  if (!withMeta.length) return null;

  // Prioriza a semana mais recente com dia CONCLUÍDO; só sem nenhum concluído
  // cai para a semana mais recente com estudo em andamento.
  const concluded = withMeta.filter((x) => x.progress.status === "concluida");
  const latestWeekNumber = Math.max(
    ...(concluded.length ? concluded : withMeta).map((x) => x.weekNumber),
  );
  return buildSnapshot(
    trail,
    withMeta.filter((x) => x.weekNumber === latestWeekNumber),
    latestWeekNumber,
  );
}

/** Dia com estudo de verdade (módulo concluído, questão respondida ou chat). */
function hasRealStudy(p: TrailWeekProgress): boolean {
  return (
    (p.completedModuleIds?.length ?? 0) > 0 ||
    Object.keys(p.practiceAnswers ?? {}).length > 0 ||
    (p.chat?.length ?? 0) > 0
  );
}

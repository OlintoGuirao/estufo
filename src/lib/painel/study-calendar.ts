import type { ApprovalTrail, TrailWeek } from "@/types/approval-trail";
import type { StudySchedule, StudyWeekday } from "@/types/study-schedule";
import type { TrailWeekProgress, TrailWeekStudyStatus } from "@/types/trail-progress";
import { STUDY_WEEKDAYS } from "@/lib/study-schedule/weekdays";

export type DayTone = "overdue" | "today" | "done" | "upcoming" | "idle";

export type CalendarDayInfo = {
  date: Date;
  dateKey: string;
  tone: DayTone;
  session: TrailWeek | null;
  progressStatus: TrailWeekStudyStatus | null;
  isRedacao: boolean;
  isExam: boolean;
  isStudyDay: boolean;
};

export type TodayTask = {
  kind: "trail" | "redacao" | "exam";
  id: string;
  title: string;
  detail: string;
  tone: "overdue" | "today" | "done";
  to: string;
  params?: { week: string };
};

const WEEKDAY_LABELS = [
  "Domingo",
  ...STUDY_WEEKDAYS.map((d) => d.label),
] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateKey(d: Date): string {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Nome do dia civil (Segunda, Terça…) a partir da data real. */
export function weekdayLabelFromDate(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()] ?? "Estudo";
}

/** Primeiro dia de estudo na/após a criação da trilha. */
export function planStartDate(trail: ApprovalTrail, studyDays: StudyWeekday[]): Date {
  const days = (studyDays.length ? studyDays : ([1, 2, 3, 4, 5] as StudyWeekday[])).slice().sort(
    (a, b) => a - b,
  );
  const d = startOfDay(new Date(trail.createdAt));
  for (let i = 0; i < 21; i++) {
    if (days.includes(d.getDay() as StudyWeekday)) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * N-ésimo dia de estudo a partir do início do plano (0 = planStart).
 * Usa a ordem real das sessões — não o dayLabel “Segunda/Terça” do edital.
 */
export function dateForStudyDayIndex(
  index: number,
  planStart: Date,
  studyDays: StudyWeekday[],
): Date {
  const d = new Date(planStart);
  let seen = 0;
  while (seen < index) {
    d.setDate(d.getDate() + 1);
    if (studyDays.includes(d.getDay() as StudyWeekday)) seen += 1;
  }
  return startOfDay(d);
}

export function buildSessionDateMap(
  trail: ApprovalTrail,
  studyDays: StudyWeekday[],
): Map<string, TrailWeek> {
  const days = (studyDays.length ? studyDays : ([1, 2, 3, 4, 5] as StudyWeekday[])).slice().sort(
    (a, b) => a - b,
  );
  const start = planStartDate(trail, days);
  const map = new Map<string, TrailWeek>();
  // Ordem do array = sequência de dias de estudo (evita “Terça” cair na quarta).
  const ordered = [...trail.weeks].sort((a, b) => a.week - b.week);
  ordered.forEach((session, index) => {
    const d = dateForStudyDayIndex(index, start, days);
    map.set(dateKey(d), session);
  });
  return map;
}

/** Último dia de estudo da mesma semana civil (dom–sáb) que `date`. */
function lastStudyDayOfCalendarWeek(date: Date, studyDays: StudyWeekday[]): Date {
  const sunday = startOfDay(date);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  let last = startOfDay(date);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    if (studyDays.includes(d.getDay() as StudyWeekday)) last = startOfDay(d);
  }
  return last;
}

/** Intervalo contínuo: do 1º dia de estudo até o fim da última semana com conteúdo. */
export function planContinuousRange(
  trail: ApprovalTrail,
  studyDays: StudyWeekday[],
): { start: Date; end: Date } | null {
  const days = (studyDays.length ? studyDays : ([1, 2, 3, 4, 5] as StudyWeekday[])).slice().sort(
    (a, b) => a - b,
  );
  const sessionMap = buildSessionDateMap(trail, days);
  if (!sessionMap.size) return null;
  const sorted = [...sessionMap.keys()].sort();
  const firstKey = sorted[0]!;
  const lastKey = sorted[sorted.length - 1]!;
  const [fy, fm, fd] = firstKey.split("-").map(Number);
  const [ly, lm, ld] = lastKey.split("-").map(Number);
  const start = startOfDay(new Date(fy!, fm! - 1, fd!));
  const lastSession = startOfDay(new Date(ly!, lm! - 1, ld!));
  const end = lastStudyDayOfCalendarWeek(lastSession, days);
  return { start, end };
}

function toneForDay(input: {
  date: Date;
  today: Date;
  session: TrailWeek | null;
  status: TrailWeekStudyStatus | null;
  inContinuousPlan: boolean;
}): DayTone {
  const { date, today, session, status, inContinuousPlan } = input;
  const t = startOfDay(today).getTime();
  const d = startOfDay(date).getTime();

  if (session) {
    if (status === "concluida") return "done";
    if (d < t) return "overdue";
    if (d === t) return "today";
    return "upcoming";
  }

  // Dias de estudo sem sessão ainda: mantém a semana contínua no calendário.
  if (inContinuousPlan) {
    if (d === t) return "today";
    return "upcoming";
  }
  return "idle";
}

export function buildMonthDayInfos(input: {
  month: Date;
  today?: Date;
  trail: ApprovalTrail | null;
  schedule: StudySchedule;
  progressByWeek: Map<number, TrailWeekProgress>;
}): CalendarDayInfo[] {
  const today = startOfDay(input.today ?? new Date());
  const year = input.month.getFullYear();
  const monthIdx = input.month.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const studyDays = input.schedule.studyDays;
  const sessionMap =
    input.trail && input.trail.weeks.length
      ? buildSessionDateMap(input.trail, studyDays)
      : new Map<string, TrailWeek>();
  const range =
    input.trail && input.trail.weeks.length
      ? planContinuousRange(input.trail, studyDays)
      : null;

  const out: CalendarDayInfo[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = startOfDay(new Date(year, monthIdx, day));
    const key = dateKey(date);
    const weekday = date.getDay() as StudyWeekday;
    const isStudyWeekday = studyDays.includes(weekday);
    const session = sessionMap.get(key) ?? null;
    const status = session ? (input.progressByWeek.get(session.week)?.status ?? "pendente") : null;
    const inContinuousPlan = !!(
      range &&
      isStudyWeekday &&
      date.getTime() >= range.start.getTime() &&
      date.getTime() <= range.end.getTime()
    );
    out.push({
      date,
      dateKey: key,
      tone: toneForDay({ date, today, session, status, inContinuousPlan }),
      session,
      progressStatus: status,
      isRedacao: input.schedule.redacaoDays.includes(weekday),
      isExam: input.schedule.examDays.includes(weekday),
      isStudyDay: isStudyWeekday,
    });
  }
  return out;
}

export function buildTodayTasks(input: {
  today?: Date;
  trail: ApprovalTrail | null;
  schedule: StudySchedule;
  progressByWeek: Map<number, TrailWeekProgress>;
}): TodayTask[] {
  const today = startOfDay(input.today ?? new Date());
  const weekday = today.getDay() as StudyWeekday;
  const tasks: TodayTask[] = [];

  if (input.trail?.weeks.length) {
    const sessionMap = buildSessionDateMap(input.trail, input.schedule.studyDays);
    const overdue: { session: TrailWeek; date: Date }[] = [];
    let todaySession: TrailWeek | null = null;

    for (const [key, session] of sessionMap) {
      const [y, m, d] = key.split("-").map(Number);
      const date = startOfDay(new Date(y!, m! - 1, d!));
      const status = input.progressByWeek.get(session.week)?.status ?? "pendente";
      // O dia de hoje entra mesmo concluído (aparece verde, "concluído").
      if (date.getTime() === today.getTime()) todaySession = session;
      if (status === "concluida") continue;
      if (date.getTime() < today.getTime()) overdue.push({ session, date });
    }

    overdue.sort((a, b) => a.session.week - b.session.week);
    for (const { session: s, date } of overdue) {
      tasks.push({
        kind: "trail",
        id: `overdue-${s.week}`,
        title: `Em atraso · ${weekdayLabelFromDate(date)}`,
        detail: s.focus,
        tone: "overdue",
        to: "/trilha/semana/$week",
        params: { week: String(s.week) },
      });
    }

    if (todaySession) {
      const status = input.progressByWeek.get(todaySession.week)?.status ?? "pendente";
      const todayLabel = weekdayLabelFromDate(today);
      tasks.push({
        kind: "trail",
        id: `today-${todaySession.week}`,
        title:
          status === "concluida"
            ? `Hoje · ${todayLabel} (concluído)`
            : `Hoje · ${todayLabel}`,
        detail: todaySession.focus,
        tone: status === "concluida" ? "done" : "today",
        to: "/trilha/semana/$week",
        params: { week: String(todaySession.week) },
      });
    } else if (input.schedule.studyDays.includes(weekday) && !overdue.length) {
      tasks.push({
        kind: "trail",
        id: "study-empty",
        title: "Hoje é dia de estudo",
        detail: "Gere o material na Trilha para liberar o conteúdo do dia.",
        tone: "today",
        to: "/trilha",
      });
    }
  }

  if (input.schedule.redacaoDays.includes(weekday)) {
    tasks.push({
      kind: "redacao",
      id: "redacao-today",
      title: "Redação",
      detail: "Hoje está na sua agenda de redação.",
      tone: "today",
      to: "/redacao",
    });
  }

  if (input.schedule.examDays.includes(weekday)) {
    tasks.push({
      kind: "exam",
      id: "exam-today",
      title: "Prova / simulado",
      detail: "Hoje está na sua agenda de prova.",
      tone: "today",
      to: "/simulados",
    });
  }

  return tasks;
}

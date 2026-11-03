import type { TrailSubject, TrailTopic, TrailWeek } from "@/types/approval-trail";
import type { StudyWeekday } from "@/types/study-schedule";
import { STUDY_WEEKDAYS } from "@/lib/study-schedule/weekdays";

function shortSubjectName(name: string): string {
  return name.length > 48 ? `${name.slice(0, 45).trim()}…` : name;
}

function stageLabel(name: string): string {
  return name.length > 80 ? `${name.slice(0, 77).trim()}…` : name;
}

function dayLabel(weekday: StudyWeekday): string {
  return STUDY_WEEKDAYS.find((d) => d.value === weekday)?.label ?? `Dia ${weekday}`;
}

/** Artigos por dia de estudo (mín. 10 — ex.: Arts. 293–303). */
const ARTICLES_PER_DAY = 10;
/** Assunto (Português, Matemática…): vários no mesmo dia (~2h). */
const TOPICS_PER_DAY = 3;

export function isArticleTopic(t: TrailTopic): boolean {
  if (t.kind === "artigo") return true;
  if (t.articleRef) return true;
  return /\bArts?\.?\s*\d/i.test(t.name);
}

function chunkTopicsForDays(topics: TrailTopic[]): TrailTopic[][] {
  const chunks: TrailTopic[][] = [];
  let i = 0;
  while (i < topics.length) {
    const t = topics[i]!;
    if (isArticleTopic(t)) {
      const run: TrailTopic[] = [];
      while (i < topics.length && isArticleTopic(topics[i]!) && run.length < ARTICLES_PER_DAY) {
        run.push(topics[i]!);
        i += 1;
      }
      chunks.push(run);
    } else {
      // Português etc.: une vários assuntos no mesmo dia.
      const run: TrailTopic[] = [];
      while (
        i < topics.length &&
        !isArticleTopic(topics[i]!) &&
        run.length < TOPICS_PER_DAY
      ) {
        run.push(topics[i]!);
        i += 1;
      }
      chunks.push(run);
    }
  }
  return chunks;
}

function focusForChunk(subjectName: string, chunk: TrailTopic[]): string {
  if (chunk.length === 1) {
    return `${shortSubjectName(subjectName)} — ${stageLabel(chunk[0]!.name)}`;
  }
  const refs = chunk
    .map((t) => t.articleRef || t.name.replace(/^Arts?\.?\s*/i, "").trim())
    .filter(Boolean);
  const first = refs[0] ?? chunk[0]!.name;
  const last = refs[refs.length - 1] ?? chunk[chunk.length - 1]!.name;
  if (chunk.every(isArticleTopic) && refs.length >= 2) {
    return `${shortSubjectName(subjectName)} — Arts. ${first}–${last}`;
  }
  return `${shortSubjectName(subjectName)} — ${stageLabel(chunk[0]!.name)} (+${chunk.length - 1})`;
}

/**
 * Monta o cronograma por matéria e pelos dias de estudo (ex.: seg–sex).
 * - Assunto (Português etc.): vários por dia (~2h)
 * - Artigos (Direito): blocos de ≥10 por dia; cards separados Seg/Ter/…
 */
export function buildWeeksFromSubjects(input: {
  subjects: TrailSubject[];
  weeksTarget: number;
  hoursPerWeek: number;
  studyDays: StudyWeekday[];
  onlyWithMaterial?: boolean;
}): TrailWeek[] {
  const studyDays = (
    input.studyDays.length ? input.studyDays : ([1, 2, 3, 4, 5] as StudyWeekday[])
  )
    .filter((d) => d >= 1 && d <= 6)
    .sort((a, b) => a - b) as StudyWeekday[];

  if (!studyDays.length) return [];

  // O formulário grava "horas por dia" em hoursPerWeek. Valores altos (>8) são legado (horas/semana).
  const raw = Math.max(1, input.hoursPerWeek || 2);
  const hoursPerDay =
    raw > 8
      ? Math.max(2, Math.round((raw / studyDays.length) * 10) / 10)
      : Math.min(12, raw);
  const maxCalendarWeeks = Math.max(4, Math.min(80, input.weeksTarget * 4));

  const subjects = input.subjects.filter((s) => {
    if (!s.topics.length) return false;
    if (!input.onlyWithMaterial) return true;
    return s.topics.some((t) => !!t.explanation?.trim());
  });

  if (!subjects.length) return [];

  const sessions: TrailWeek[] = [];
  let sessionId = 1;
  let calendarWeek = 1;
  // Índice compartilhado entre matérias — a semana não reinicia na segunda a cada bloco.
  let dayIdx = 0;

  for (const s of subjects) {
    const topics = input.onlyWithMaterial
      ? s.topics.filter((t) => !!t.explanation?.trim())
      : s.topics;
    if (!topics.length) continue;

    const dayChunks = chunkTopicsForDays(topics);

    for (const chunk of dayChunks) {
      if (calendarWeek > maxCalendarWeeks) break;
      const weekday = studyDays[dayIdx]!;
      const label = dayLabel(weekday);
      const n = chunk.length;

      sessions.push({
        week: sessionId,
        weekNumber: calendarWeek,
        weekday,
        dayLabel: label,
        focus: focusForChunk(s.name, chunk).slice(0, 180),
        subjectNames: [s.name],
        hoursSuggested: hoursPerDay,
        activities: [
          n > 1
            ? chunk.every(isArticleTopic)
              ? `${label}: ${n} artigos · ~${hoursPerDay}h`
              : `${label}: ${n} assuntos · ~${hoursPerDay}h`
            : `${label}: ~${hoursPerDay}h nesta etapa`,
          n > 1
            ? chunk.map((t) => stageLabel(t.name)).join(" · ")
            : "Definição · Macete · Exemplo · 5 questões",
          n > 1
            ? chunk.every(isArticleTopic)
              ? "Por artigo: definição · macete · exemplo · questões"
              : "Por assunto: definição · macete · exemplo · 5 questões"
            : "Prática do dia (≥5 questões)",
          n > 1
            ? `Prática do dia (≥${Math.max(5, n)} questões)`
            : "Revisão dos erros",
        ],
        topicIds: chunk.map((t) => t.id),
      });

      sessionId += 1;
      dayIdx += 1;
      if (dayIdx >= studyDays.length) {
        dayIdx = 0;
        calendarWeek += 1;
      }
    }
  }

  return sessions;
}

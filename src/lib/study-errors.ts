import type { ErrorNote, ErrorNoteOrigin, ErrorReasonCode } from "@/types";
// ErrorNoteOrigin used in ERROR_ORIGIN_LABEL

export const ERROR_ORIGIN_LABEL: Record<ErrorNoteOrigin, string> = {
  local: "Questões",
  provider: "Provedor",
  simulado: "Simulado",
  quest: "TJSP Quest",
  plano: "Plano de estudo",
  diagnostico: "Diagnóstico",
  revisao: "Revisão",
  "video-aula": "Videoaula",
};

/** ISO week key yyyy-Www (segunda como início). */
export function isoWeekKey(isoDate: string): string {
  const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
    );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function groupErrorNotesByWeek(notes: ErrorNote[]): {
  week: string;
  notes: ErrorNote[];
}[] {
  const map = new Map<string, ErrorNote[]>();
  for (const n of notes) {
    const w = isoWeekKey(n.createdAt);
    const list = map.get(w) ?? [];
    list.push(n);
    map.set(w, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, notes]) => ({ week, notes }));
}

export function groupErrorNotesBySubject(notes: ErrorNote[]): {
  subject: string;
  notes: ErrorNote[];
}[] {
  const map = new Map<string, ErrorNote[]>();
  for (const n of notes) {
    const s = n.subject || "Sem matéria";
    const list = map.get(s) ?? [];
    list.push(n);
    map.set(s, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([subject, notes]) => ({ subject, notes }));
}

export type ErrorSnapshotInput = {
  questionId: string;
  subject: string;
  topic: string;
  statement: string;
  yourKey: string;
  correctKey: string;
  explanation?: string;
  reasonCode?: ErrorReasonCode;
  origin: ErrorNoteOrigin;
  sourceLabel?: string;
};

/** Payload pronto para POST /error-notes (snapshot). */
export function buildErrorSnapshot(input: ErrorSnapshotInput) {
  return {
    questionId: input.questionId,
    subject: input.subject,
    topic: input.topic,
    statement: input.statement,
    yourKey: input.yourKey,
    correctKey: input.correctKey,
    explanation: input.explanation ?? "",
    reasonCode: input.reasonCode ?? ("nao-sabia" as ErrorReasonCode),
    origin: input.origin,
    sourceLabel: input.sourceLabel ?? ERROR_ORIGIN_LABEL[input.origin],
    snapshot: true as const,
  };
}

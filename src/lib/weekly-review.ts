import type { ErrorNote, StudySession } from "@/types";
import {
  groupErrorNotesBySubject,
  groupErrorNotesByWeek,
  isoWeekKey,
} from "@/lib/study-errors";

export type WeeklyReviewBundle = {
  week: string;
  errorNotes: ErrorNote[];
  bySubject: { subject: string; notes: ErrorNote[] }[];
  sessions: StudySession[];
  subjectsStudied: string[];
};

/** Monta revisão acumulativa da semana atual (ou chave dada). */
export function buildWeeklyReviewBundle(input: {
  errorNotes: ErrorNote[];
  sessions: StudySession[];
  weekKey?: string;
}): WeeklyReviewBundle {
  const week = input.weekKey ?? isoWeekKey(new Date().toISOString());
  const weekNotes =
    groupErrorNotesByWeek(input.errorNotes).find((g) => g.week === week)?.notes ??
    input.errorNotes.filter((n) => isoWeekKey(n.createdAt) === week);

  const sessions = input.sessions.filter((s) => {
    const key = isoWeekKey(s.date);
    return key === week;
  });

  const subjectsStudied = [
    ...new Set(sessions.map((s) => s.subject).filter(Boolean)),
  ];

  return {
    week,
    errorNotes: weekNotes,
    bySubject: groupErrorNotesBySubject(weekNotes),
    sessions,
    subjectsStudied,
  };
}

export function buildWeeklyReinforcePrompt(bundle: WeeklyReviewBundle): string {
  const lines = [
    `Semana: ${bundle.week}`,
    `Matérias estudadas no plano: ${bundle.subjectsStudied.join(", ") || "(nenhuma sessão)"}`,
    `Erros no caderno esta semana: ${bundle.errorNotes.length}`,
    "",
    "Erros por matéria:",
  ];
  for (const g of bundle.bySubject) {
    lines.push(`- ${g.subject} (${g.notes.length})`);
    for (const n of g.notes.slice(0, 4)) {
      lines.push(
        `  · [${n.origin ?? "local"}] ${n.topic}: ${(n.statement || "(sem enunciado)").slice(0, 160)}`,
      );
    }
  }
  return lines.join("\n");
}

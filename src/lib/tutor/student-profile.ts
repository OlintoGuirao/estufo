/**
 * Resumo curto do aluno para o Professor IA adaptar a explicação.
 * Usa só dados que o app já guarda (caderno de erros + dificuldades marcadas).
 */
import type { TutorDifficultyCode } from "./types";
import { TUTOR_DIFFICULTY_OPTIONS } from "./types";

export type ProfileErrorNote = { subject: string; topic: string; createdAt?: string };
export type ProfileDifficulty = {
  subject: string;
  topic: string;
  code: TutorDifficultyCode;
  at: string;
};

const REASON_LABEL = Object.fromEntries(
  TUTOR_DIFFICULTY_OPTIONS.map((o) => [o.code, o.label.toLowerCase()]),
) as Record<TutorDifficultyCode, string>;

function top<T>(items: T[], key: (t: T) => string, n: number): { k: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it).trim();
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([k, count]) => ({ k, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function buildStudentProfileText(input: {
  errorNotes: ProfileErrorNote[];
  difficulties: ProfileDifficulty[];
  currentSubject?: string;
  maxChars?: number;
}): string {
  const parts: string[] = [];
  const notes = input.errorNotes.slice(-300);
  if (notes.length) {
    const subj = input.currentSubject?.toLowerCase();
    const inSubject = subj ? notes.filter((n) => n.subject.toLowerCase() === subj) : [];
    const topicsHere = top(inSubject, (n) => n.topic, 4);
    const subjects = top(notes, (n) => n.subject, 3);
    parts.push(
      `${notes.length} erros no caderno; matérias com mais erros: ${subjects.map((s) => `${s.k} (${s.count})`).join(", ")}.`,
    );
    if (topicsHere.length) {
      parts.push(
        `Nesta matéria erra mais: ${topicsHere.map((t) => `${t.k} (${t.count})`).join(", ")}.`,
      );
    }
  } else {
    parts.push("Aluno sem histórico de erros ainda — trate como iniciante no tema.");
  }

  const recent = [...input.difficulties].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 20);
  if (recent.length) {
    const reasons = top(recent, (d) => d.code, 2).map(
      (r) => REASON_LABEL[r.k as TutorDifficultyCode] ?? r.k,
    );
    parts.push(`Motivos que ele mesmo marca nos erros: ${reasons.join(" e ")}.`);
    const last = recent[0]!;
    parts.push(
      `Última dificuldade: ${REASON_LABEL[last.code] ?? last.code} em ${last.topic || last.subject}.`,
    );
  }

  const text = parts.join(" ");
  const max = input.maxChars ?? 600;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

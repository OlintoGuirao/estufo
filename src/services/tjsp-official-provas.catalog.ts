import catalog from "@/data/tjsp-official-provas.json";
import { localQuestionState } from "@/services/local-question-state";
import { ApiError } from "@/services/api";
import type { Question } from "@/types";

export type OfficialProvaSummary = {
  id: string;
  year: number;
  title: string;
  questionCount: number;
  timeLimitMin: number;
  hasFullAnswerKey: boolean;
  answerKeyCount: number;
  subjects: string[];
};

type RawQ = {
  id: string;
  number: number;
  statement: string;
  alternatives: { key: string; text: string }[];
  subject: string;
  topic: string;
  correctKey: string;
  board: string;
  year: number;
  contest: string;
  difficulty: Question["difficulty"];
  source: string;
};

type RawProva = {
  id: string;
  year: number;
  title: string;
  contest: string;
  board: string;
  questionCount: number;
  timeLimitMin: number;
  hasFullAnswerKey: boolean;
  answerKeyCount: number;
  subjects: string[];
  questions: RawQ[];
};

const provas = (catalog as { provas: RawProva[] }).provas;
const byId = new Map<string, RawQ>();
for (const p of provas) {
  for (const q of p.questions) byId.set(q.id, q);
}

function toQuestion(q: RawQ): Question {
  const st = localQuestionState.get(q.id);
  return {
    id: q.id,
    statement: q.statement,
    alternatives: q.alternatives.map((a) => ({ key: a.key, text: a.text })),
    board: q.board,
    year: q.year,
    contest: q.contest,
    subject: q.subject,
    topic: q.topic,
    difficulty: q.difficulty,
    source: q.source,
    favorite: st.favorite,
    markedForReview: st.markedForReview,
    answered: st.answered,
  };
}

export function isOfficialProvaQuestionId(id: string): boolean {
  return id.startsWith("tjsp-oficial-");
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const tjspOfficialProvasCatalog = {
  list(): OfficialProvaSummary[] {
    return [...provas]
      .sort((a, b) => b.year - a.year)
      .map((p) => ({
        id: p.id,
        year: p.year,
        title: p.title,
        questionCount: p.questions.length,
        timeLimitMin: p.timeLimitMin,
        hasFullAnswerKey: p.hasFullAnswerKey,
        answerKeyCount: p.answerKeyCount,
        subjects: p.subjects,
      }));
  },

  get(id: string): { id: string; title: string; year: number; timeLimitMin: number; questions: Question[]; raw: RawQ[] } {
    const p = provas.find((x) => x.id === id);
    if (!p) throw new ApiError(`Prova oficial ${id} não encontrada.`, 404);
    return {
      id: p.id,
      title: p.title,
      year: p.year,
      timeLimitMin: p.timeLimitMin,
      questions: p.questions.map(toQuestion),
      raw: p.questions,
    };
  },

  getRaw(id: string): RawQ | undefined {
    return byId.get(id);
  },

  /**
   * Sorteia questões das provas oficiais (com gabarito) filtradas por matéria.
   * Cobre Direito etc., que o banco 400 não tem.
   */
  pickForSimulado(opts: {
    count: number;
    subjects?: string[];
    excludeIds?: Set<string>;
  }): Question[] {
    const count = Math.max(1, Math.min(80, opts.count));
    const labels = (opts.subjects ?? []).map(norm).filter(Boolean);
    const exclude = opts.excludeIds ?? new Set<string>();
    let pool = [...byId.values()].filter((q) => q.correctKey && !exclude.has(q.id));
    if (labels.length) {
      const filtered = pool.filter((q) => {
        const subj = norm(q.subject);
        return labels.some((l) => subj.includes(l) || l.includes(subj));
      });
      if (filtered.length >= Math.min(count, 3)) pool = filtered;
    }
    return shuffle(pool)
      .slice(0, count)
      .map((q) => ({
        ...toQuestion(q),
        answered: null,
        favorite: false,
        markedForReview: false,
      }));
  },
};

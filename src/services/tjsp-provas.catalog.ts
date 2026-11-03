import catalog from "@/data/tjsp-30-provas.json";
import { localQuestionState } from "@/services/local-question-state";
import { ApiError } from "@/services/api";
import type { AnswerResult, Question } from "@/types";

export type TjspProvaSummary = {
  id: number;
  title: string;
  questionCount: number;
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

type RawProva = { id: number; title: string; questions: RawQ[] };

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

export const tjspProvasCatalog = {
  meta: (catalog as { meta: Record<string, unknown> }).meta,

  listProvas(): TjspProvaSummary[] {
    return provas.map((p) => ({
      id: p.id,
      title: p.title,
      questionCount: p.questions.length,
      subjects: [...new Set(p.questions.map((q) => q.subject))],
    }));
  },

  getProva(id: number): { id: number; title: string; questions: Question[] } {
    const p = provas.find((x) => x.id === id);
    if (!p) throw new ApiError(`Prova ${id} não encontrada.`, 404);
    return {
      id: p.id,
      title: p.title,
      questions: p.questions.map(toQuestion),
    };
  },

  getRaw(id: string): RawQ | undefined {
    return byId.get(id);
  },

  getQuestion(id: string): Question {
    const raw = byId.get(id);
    if (!raw) throw new ApiError("Questão não encontrada no banco TJSP.", 404);
    return toQuestion(raw);
  },

  answer(id: string, choice: string): AnswerResult {
    const q = byId.get(id);
    if (!q) throw new ApiError("Questão não encontrada no banco TJSP.", 404);
    const correctKey = q.correctKey.toUpperCase();
    const correct = choice.toUpperCase() === correctKey;
    localQuestionState.upsert(id, {
      answered: { choice: choice.toUpperCase(), correct },
    });
    return {
      correct,
      correctKey,
      explanation: `${q.subject} · gabarito ${correctKey}.`,
    };
  },

  isTjspId(id: string): boolean {
    return id.startsWith("tjsp-");
  },

  /** Questões únicas por enunciado, filtradas por matéria/tópico. */
  listUniqueBySubject(
    subject: string,
    opts?: { topic?: string; limit?: number; prioritizeIds?: string[] },
  ): Question[] {
    const topic = opts?.topic;
    const limit = opts?.limit ?? 20;
    const prioritize = new Set(opts?.prioritizeIds ?? []);
    const byStatement = new Map<string, RawQ>();

    for (const p of provas) {
      for (const q of p.questions) {
        if (q.subject !== subject) continue;
        if (topic && q.topic !== topic) continue;
        if (!byStatement.has(q.statement)) byStatement.set(q.statement, q);
      }
    }

    const all = [...byStatement.values()];
    const priority: RawQ[] = [];
    const rest: RawQ[] = [];
    for (const q of all) {
      if (prioritize.has(q.id) || [...prioritize].some((id) => byId.get(id)?.statement === q.statement)) {
        priority.push(q);
      } else {
        rest.push(q);
      }
    }
    // embaralha o restante para variar a prática
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }

    return [...priority, ...rest].slice(0, limit).map((q) => ({
      ...toQuestion(q),
      answered: null,
      favorite: false,
      markedForReview: false,
    }));
  },

  countUniqueBySubject(subject: string, topic?: string): number {
    const seen = new Set<string>();
    for (const p of provas) {
      for (const q of p.questions) {
        if (q.subject !== subject) continue;
        if (topic && q.topic !== topic) continue;
        seen.add(q.statement);
      }
    }
    return seen.size;
  },
};

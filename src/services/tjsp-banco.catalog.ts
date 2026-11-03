import catalog from "@/data/tjsp-banco-400.json";
import { localQuestionState } from "@/services/local-question-state";
import { ApiError } from "@/services/api";
import type { AnswerResult, Question } from "@/types";

type RawQ = {
  id: string;
  code: string;
  number: number;
  statement: string;
  alternatives: { key: string; text: string }[];
  subject: string;
  subjectKey: string;
  topic: string;
  correctKey: string;
  explanation: string;
  board: string;
  year: number;
  contest: string;
  difficulty: Question["difficulty"];
  source: string;
};

const questions = (catalog as { questions: RawQ[] }).questions;
const byId = new Map(questions.map((q) => [q.id, q]));
const byCode = new Map(questions.map((q) => [q.code, q]));

/** Remove acentos para bater "Informática" ↔ INFORMATICA, etc. */
function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Mapeia o nome da prova diagnóstica → chave do banco 400.
 * Legislação Especial | Atualidades | Matemática / Raciocínio Lógico | Informática
 */
export function resolveSubjectKey(subject: string): string | null {
  const s = norm(subject);
  if (s.includes("legisla")) return "LEGISLACAO_ESPECIAL";
  if (s.includes("atual")) return "ATUALIDADES";
  if (s.includes("informa")) return "INFORMATICA";
  if (s.includes("matem") || s.includes("racioc") || s.includes("logic")) {
    return "MATEMATICA_RACIOCINIO_LOGICO";
  }
  return null;
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const tjspBancoCatalog = {
  meta: (catalog as { meta: Record<string, unknown> }).meta,

  all(): Question[] {
    return questions.map(toQuestion);
  },

  getRaw(id: string): RawQ | undefined {
    return byId.get(id) ?? byCode.get(id);
  },

  getQuestion(id: string): Question {
    const raw = byId.get(id) ?? byCode.get(id);
    if (!raw) throw new ApiError("Questão não encontrada no banco TJSP 400.", 404);
    return toQuestion(raw);
  },

  isBancoId(id: string): boolean {
    return id.startsWith("tjsp-banco-") || byCode.has(id);
  },

  answer(id: string, choice: string): AnswerResult {
    const q = byId.get(id) ?? byCode.get(id);
    if (!q) throw new ApiError("Questão não encontrada no banco TJSP 400.", 404);
    const correctKey = q.correctKey.toUpperCase();
    const correct = choice.toUpperCase() === correctKey;
    localQuestionState.upsert(q.id, {
      answered: { choice: choice.toUpperCase(), correct },
    });
    return { correct, correctKey, explanation: q.explanation };
  },

  countBySubjectLabel(subjectLabel: string): number {
    const key = resolveSubjectKey(subjectLabel);
    if (!key) return 0;
    return questions.filter((q) => q.subjectKey === key).length;
  },

  /**
   * Prática só com o banco de 400 (não usa itens da prova diagnóstica).
   * Opcionalmente exclui enunciados já vistos no diagnóstico.
   */
  listForPractice(
    subjectLabel: string,
    opts?: {
      limit?: number;
      /** Enunciados da prova diagnóstica a evitar. */
      excludeStatements?: string[];
    },
  ): Question[] {
    const key = resolveSubjectKey(subjectLabel);
    if (!key) return [];
    const limit = opts?.limit ?? 20;
    const excluded = new Set((opts?.excludeStatements ?? []).map((s) => s.trim()));
    const pool = questions.filter(
      (q) => q.subjectKey === key && !excluded.has(q.statement.trim()),
    );
    // Se excluir demais, completa com o restante do banco da matéria
    const fallback =
      pool.length >= Math.min(limit, 5)
        ? pool
        : questions.filter((q) => q.subjectKey === key);

    return shuffle(fallback)
      .slice(0, limit)
      .map((q) => ({
        ...toQuestion(q),
        answered: null,
        favorite: false,
        markedForReview: false,
      }));
  },

  /**
   * Sorteia questões reais do banco (provas) para simulado — sem IA.
   * Se `subjects` estiver vazio, usa o banco inteiro.
   */
  pickForSimulado(opts: {
    count: number;
    subjects?: string[];
  }): Question[] {
    const count = Math.max(1, Math.min(80, opts.count));
    const labels = (opts.subjects ?? []).map(norm).filter(Boolean);
    let pool = questions;
    if (labels.length) {
      const filtered = questions.filter((q) => {
        const subj = norm(q.subject);
        const key = q.subjectKey.toLowerCase();
        return labels.some(
          (l) =>
            subj.includes(l) ||
            l.includes(subj) ||
            key.includes(l.replace(/\s+/g, "_")) ||
            resolveSubjectKey(l) === q.subjectKey,
        );
      });
      if (filtered.length >= Math.min(count, 5)) pool = filtered;
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

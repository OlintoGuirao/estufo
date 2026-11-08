/**
 * Distribui a letra correta entre A–E.
 * A IA tende a colocar a resposta sempre em A ou B (o exemplo do prompt usa "B");
 * o aluno aprende o vício e não o conteúdo. Aqui reposicionamos as alternativas
 * (o texto não muda) e corrigimos as letras citadas na explicação.
 */
export type QuizLike = {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  explanation?: string;
};

const KEYS = ["A", "B", "C", "D", "E"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Troca "alternativa B", "letra B", "(B)", "B)" na explicação conforme o novo mapa de letras. */
export function remapLetters(text: string, map: Record<string, string>): string {
  return text
    .replace(/\b(alternativas?|letras?|op[cç](?:ão|ao|ões|oes)|itens?|item)\s+([A-E])\b/gi, (m, w, k) =>
      map[k.toUpperCase()] ? `${w} ${map[k.toUpperCase()]}` : m,
    )
    .replace(/\(([A-E])\)/g, (m, k) => (map[k] ? `(${map[k]})` : m))
    .replace(/(^|\s)([A-E])\)/g, (m, sp, k) => (map[k] ? `${sp}${map[k]})` : m));
}

/** Coloca a correta na posição `target`, mantendo a ordem relativa das demais. */
export function moveCorrectTo<Q extends QuizLike>(q: Q, target: string): Q {
  const n = q.alternatives.length;
  const keys = KEYS.slice(0, n);
  if (!keys.includes(target)) return q;
  const correct = q.alternatives.find((a) => a.key.toUpperCase() === q.correctKey.toUpperCase());
  if (!correct || correct.key.toUpperCase() === target) return q;
  const others = q.alternatives.filter((a) => a !== correct);
  const order = [...others];
  order.splice(keys.indexOf(target), 0, correct);
  const letterMap: Record<string, string> = {};
  const alternatives = order.map((a, i) => {
    letterMap[a.key.toUpperCase()] = keys[i]!;
    return { ...a, key: keys[i]! };
  });
  return {
    ...q,
    alternatives,
    correctKey: target,
    ...(q.explanation ? { explanation: remapLetters(q.explanation, letterMap) } : {}),
  };
}

/**
 * Equilibra as letras corretas de uma lista.
 * Com `seed` o resultado é sempre o mesmo (a questão não "muda de letra" a cada visita).
 */
export function balanceCorrectKeys<Q extends QuizLike>(questions: Q[], seed?: string): Q[] {
  if (!questions.length) return questions;
  const rand = rng(hash(seed ?? String(Math.random())));
  const n = Math.min(...questions.map((q) => q.alternatives.length));
  const pool = KEYS.slice(0, Math.max(2, Math.min(5, n)));
  const targets: string[] = [];
  while (targets.length < questions.length) {
    const round = [...pool];
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [round[i], round[j]] = [round[j]!, round[i]!];
    }
    targets.push(...round);
  }
  return questions.map((q, i) => moveCorrectTo(q, targets[i]!));
}

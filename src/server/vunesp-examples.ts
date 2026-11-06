/**
 * Exemplos REAIS de questões VUNESP/TJSP (provas oficiais + banco) para
 * few-shot: mostrar 2–3 questões de verdade ensina o estilo da banca
 * muito melhor do que descrever "padrão VUNESP" em texto.
 * Só servidor (importa os JSONs grandes).
 */
import officialData from "@/data/tjsp-official-provas.json";
import bancoData from "@/data/tjsp-banco-400.json";

type ExampleQ = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  subject: string;
  topic?: string;
  correctKey: string;
  year?: number;
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

let pool: ExampleQ[] | null = null;

function getPool(): ExampleQ[] {
  if (pool) return pool;
  const official = (officialData as { provas: { questions: ExampleQ[] }[] }).provas.flatMap(
    (p) => p.questions,
  );
  const banco = (bancoData as { questions: ExampleQ[] }).questions;
  pool = [...official, ...banco].filter(
    (q) => q.correctKey && q.alternatives?.length === 5 && q.statement?.length > 30,
  );
  return pool;
}

const SUBJECT_ALIASES: Record<string, string[]> = {
  port: ["lingua portuguesa", "portugues"],
  penal: ["direito penal"],
  "proc-penal": ["processual penal"],
  "proc-civil": ["processual civil"],
  const: ["constitucional"],
  adm: ["administrativo"],
  info: ["informatica"],
  mat: ["matematica", "raciocinio"],
  atual: ["atualidades"],
};

/** Seleciona exemplos da mesma matéria, priorizando tópico parecido. */
export function pickVunespExamples(subject: string, topic = "", n = 2): ExampleQ[] {
  const s = norm(subject);
  const aliasHits = Object.values(SUBJECT_ALIASES).find((list) => list.some((a) => s.includes(a)));
  const wanted = aliasHits ?? [s];
  const sameSubject = getPool().filter((q) => wanted.some((w) => norm(q.subject).includes(w)));
  if (!sameSubject.length) return [];
  const words = new Set(
    norm(topic)
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
  const scored = sameSubject.map((q) => {
    const hay = norm(`${q.topic ?? ""} ${q.statement}`);
    let score = Math.random() * 0.5; // varia os exemplos entre chamadas
    for (const w of words) if (hay.includes(w)) score += 1;
    if (q.statement.length > 1_800) score -= 1;
    return { q, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.q);
}

export function formatVunespExamples(examples: ExampleQ[]): string {
  if (!examples.length) return "";
  return examples
    .map((q, i) => {
      const st = q.statement.length > 1_500 ? `${q.statement.slice(0, 1_500)}…` : q.statement;
      const alts = q.alternatives.map((a) => `(${a.key}) ${a.text}`).join("\n");
      return `EXEMPLO REAL ${i + 1}${q.year ? ` (TJSP ${q.year})` : ""}:\n${st}\n${alts}\nGabarito: ${q.correctKey}`;
    })
    .join("\n\n");
}

/**
 * Desafio do dia (roleta): 5 questões REAIS de provas TJSP/VUNESP da matéria
 * sorteada. Mesmo dia + mesma matéria = mesmas questões (não dá para "rolar
 * de novo" até sair fácil).
 */
import type { QuestAltKey, QuestQuestion } from "@/types/tjsp-quest";
import { cleanOfficialProva, isCleanOfficialQuestion } from "@/lib/official-question-clean";

export type WheelSlice = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  /** Casa com o campo `subject` das questões reais. */
  match: RegExp;
};

export const DAILY_WHEEL: WheelSlice[] = [
  { id: "port", label: "Português", emoji: "📚", color: "#ff006e", match: /portugu/i },
  { id: "const", label: "Constitucional", emoji: "🏛️", color: "#fb8500", match: /constitucional/i },
  { id: "penal", label: "Penal", emoji: "⚔️", color: "#8338ec", match: /^direito penal/i },
  { id: "procpen", label: "Proc. Penal", emoji: "🕵️", color: "#3a86ff", match: /processual penal/i },
  { id: "procciv", label: "Proc. Civil", emoji: "📜", color: "#06a77d", match: /processual civil/i },
  { id: "admin", label: "Administrativo", emoji: "🏢", color: "#e63946", match: /administrativo/i },
  { id: "info", label: "Informática", emoji: "💻", color: "#0096c7", match: /inform[aá]tica/i },
  { id: "mat", label: "Mat. e Lógica", emoji: "🧮", color: "#ffbe0b", match: /matem|racioc/i },
  { id: "atual", label: "Atualidades", emoji: "📰", color: "#ff7043", match: /atualidades/i },
];

export const DAILY_SIZE = 5;
/** Recompensa: XP/moedas por acerto e bônus por gabaritar. */
export const DAILY_REWARD = { perCorrect: 60, perfectBonus: 150 } as const;

type RawQ = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  subject: string;
  topic?: string;
  correctKey: string;
  explanation?: string;
  difficulty?: "facil" | "media" | "dificil";
  year?: number;
  source?: string;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let x = seed || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toQuest(r: RawQ): QuestQuestion | null {
  const keys = ["A", "B", "C", "D", "E"];
  const alternatives = r.alternatives
    .filter((a) => keys.includes(String(a.key).toUpperCase()))
    .map((a) => ({ key: String(a.key).toUpperCase() as QuestAltKey, text: a.text }));
  const correctKey = String(r.correctKey).toUpperCase() as QuestAltKey;
  if (alternatives.length < 4 || !alternatives.some((a) => a.key === correctKey)) return null;
  const explanation = (r.explanation ?? "").replace(/\[fonte\]\([^)]*\)/gi, "").trim();
  return {
    id: `daily:${r.id}`,
    statement: r.statement,
    alternatives,
    correctKey,
    legalBasis: r.source || (r.year ? `Prova TJSP ${r.year} (VUNESP)` : "Prova TJSP (VUNESP)"),
    whyCorrect: explanation || `Gabarito oficial VUNESP: letra ${correctKey}.`,
    whyWrong: {},
    difficulty: r.difficulty ?? "media",
    official: true,
    boardStyle: "VUNESP",
  };
}

/** Carrega as questões reais (provas oficiais + banco) — sob demanda. */
async function loadPool(): Promise<RawQ[]> {
  const [official, banco] = await Promise.all([
    import("@/data/tjsp-official-provas.json"),
    import("@/data/tjsp-banco-400.json"),
  ]);
  // Limpa a extração do PDF (texto de apoio no lugar certo, marcas de parágrafo)
  // e deixa de fora as que continuam quebradas — no desafio a questão tem que fazer sentido sozinha.
  const o = (official.default as { provas: { questions: RawQ[] }[] }).provas.flatMap((p) =>
    cleanOfficialProva(p.questions),
  );
  const b = (banco.default as { questions: RawQ[] }).questions;
  return [...o, ...b].filter(isCleanOfficialQuestion);
}

export async function buildDailyQuestions(slice: WheelSlice, date = todayKey()): Promise<QuestQuestion[]> {
  const pool = (await loadPool()).filter((q) => slice.match.test(q.subject));
  const rand = seeded(hash(`${date}:${slice.id}`));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const out: QuestQuestion[] = [];
  for (const r of shuffled) {
    const q = toQuest(r);
    if (q) out.push(q);
    if (out.length >= DAILY_SIZE) break;
  }
  return out;
}

export function dailyReward(correct: number, total: number): number {
  return correct * DAILY_REWARD.perCorrect + (total > 0 && correct === total ? DAILY_REWARD.perfectBonus : 0);
}

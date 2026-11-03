import type { GeneratedPracticeQuestion } from "./types";

const LEAK_PATTERNS = [
  /\bresposta\s+(correta\s+)?(é|eh)\s*[A-E]\b/i,
  /\balternativa\s+correta\s*(é|eh|:)?\s*[A-E]\b/i,
  /\bgabarito\s*(é|eh|:)?\s*[A-E]\b/i,
  /\bmarque\s+a\s+letra\s+[A-E]\b/i,
  /\bescolha\s+a\s+([A-E])\b/i,
  /\bcerta\s+é\s+a\s+[A-E]\b/i,
];

/** Retorna true se a dica parece revelar a letra correta. */
export function tipLooksLikeAnswerReveal(tip: string, correctKey?: string | null): boolean {
  const t = tip.trim();
  if (!t) return true;
  if (LEAK_PATTERNS.some((re) => re.test(t))) return true;
  if (correctKey) {
    const key = correctKey.toUpperCase();
    if (new RegExp(`\\b(é|eh|seria)\\s+['"]?${key}['"]?\\b`, "i").test(t)) return true;
    if (new RegExp(`\\bletra\\s+${key}\\b`, "i").test(t) && /correta|certa|gabarito/i.test(t))
      return true;
  }
  return false;
}

export function sanitizeTipText(tip: string): string {
  return tip.replace(/\s+/g, " ").trim().slice(0, 800);
}

export function parsePracticeQuestionJson(
  raw: string,
  meta: { subject: string; topic: string },
): GeneratedPracticeQuestion {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error("A IA devolveu JSON inválido para a questão de treino.");
  }
  if (!data || typeof data !== "object") throw new Error("Formato de questão inválido.");
  const obj = data as Record<string, unknown>;
  const statement = String(obj["statement"] ?? "").trim();
  const correctKey = String(obj["correctKey"] ?? "")
    .toUpperCase()
    .slice(0, 1);
  const explanation = String(obj["explanation"] ?? "").trim();
  const altsRaw = Array.isArray(obj["alternatives"]) ? obj["alternatives"] : [];
  const alternatives = altsRaw.map((a) => {
    const row = a as { key?: string; text?: string };
    return {
      key: String(row.key ?? "")
        .toUpperCase()
        .slice(0, 1),
      text: String(row.text ?? "").trim(),
    };
  });
  if (!statement || statement.length < 20)
    throw new Error("Enunciado da questão gerada é inválido.");
  if (alternatives.length < 4 || alternatives.length > 5)
    throw new Error("Questão gerada precisa de 4–5 alternativas.");
  if (!/^[A-E]$/.test(correctKey)) throw new Error("Gabarito da questão gerada é inválido.");
  if (!alternatives.some((a) => a.key === correctKey))
    throw new Error("Gabarito não corresponde às alternativas.");
  if (alternatives.some((a) => !a.text)) throw new Error("Alternativa vazia na questão gerada.");
  if (!explanation) throw new Error("Justificativa ausente na questão gerada.");

  return {
    statement,
    alternatives,
    correctKey,
    explanation,
    subject: meta.subject,
    topic: meta.topic,
    aiGenerated: true,
  };
}

/** Versão pública da questão (sem gabarito). */
export function hidePracticeAnswer(q: GeneratedPracticeQuestion) {
  return {
    statement: q.statement,
    alternatives: q.alternatives,
    subject: q.subject,
    topic: q.topic,
    aiGenerated: true as const,
    label: "Gerada por IA — não é questão oficial de banca",
  };
}

export type ActiveTestQuestion = {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
};

/**
 * Extrai o JSON do “Teste ativo” embutido no texto do Mastigado.
 * Remove o bloco do texto para não aparecer na aula.
 */
export function extractActiveTestFromMastigado(raw: string): {
  text: string;
  activeTest: ActiveTestQuestion | null;
} {
  const fence = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  const loose = !fence
    ? raw.match(
        /(\{\s*"statement"\s*:\s*"[\s\S]*?"correctKey"\s*:\s*"[A-E]"[\s\S]*?\})/i,
      )
    : null;
  const jsonBlob = fence?.[1] ?? loose?.[1] ?? null;
  if (!jsonBlob) return { text: raw, activeTest: null };

  try {
    const q = parsePracticeQuestionJson(jsonBlob, {
      subject: "treino",
      topic: "teste-ativo",
    });
    const text = raw
      .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/i, "")
      .replace(jsonBlob, "")
      .replace(/(?:^|\n)\s*(?:\*{0,2})?\s*\d+\.\s+Teste ativo\s*(?:\*{0,2})?\s*(?=\n|$)/i, "\n")
      .replace(
        /(?:^|\n)\s*(?:\*{0,2})?\s*\d+\.\s+Resposta do teste[^\n]*(?:\*{0,2})?\s*\n[\s\S]*?(?=(?:\n\s*(?:\*{0,2})?\s*\d+\.\s+)|$)/i,
        "\n",
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return {
      text,
      activeTest: {
        statement: q.statement,
        alternatives: q.alternatives,
        correctKey: q.correctKey,
        explanation: q.explanation,
      },
    };
  } catch {
    return { text: raw, activeTest: null };
  }
}

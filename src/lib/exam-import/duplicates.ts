import type { ExamImportDraftQuestion } from "@/types/exam-import";

/** Normaliza enunciado para comparação (não altera o texto exibido). */
export function statementFingerprint(statement: string): string {
  return statement
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .slice(0, 400);
}

/**
 * Marca possíveis duplicatas contra enunciados já publicados.
 * Nunca remove nem sobrescreve — só sinaliza.
 */
export function flagPossibleDuplicates(
  questions: ExamImportDraftQuestion[],
  existingStatements: { id: string; statement: string }[],
): ExamImportDraftQuestion[] {
  const map = new Map<string, string[]>();
  for (const e of existingStatements) {
    const fp = statementFingerprint(e.statement);
    if (fp.length < 40) continue;
    const list = map.get(fp) ?? [];
    list.push(e.id);
    map.set(fp, list);
  }

  return questions.map((q) => {
    const fp = statementFingerprint(q.statement);
    const hits = fp.length >= 40 ? (map.get(fp) ?? []) : [];
    if (!hits.length) {
      return { ...q, possibleDuplicateIds: [] };
    }
    const alerts = [
      ...q.alerts.filter((a) => a.code !== "possible_duplicate"),
      {
        code: "possible_duplicate" as const,
        message: `Possível duplicata de questão(ões) já cadastrada(s): ${hits.join(", ")}. Não será sobrescrita automaticamente.`,
        questionNumber: q.number,
      },
    ];
    return { ...q, possibleDuplicateIds: hits, alerts };
  });
}

import type { ExamImportAlert, ExamImportDraftQuestion, ExamImportPage } from "@/types/exam-import";
import { joinPagesWithMarkers } from "./parse-questions";

const KEY_RE = /\b([A-Ea-e])\b/;

/**
 * Extrai mapa número → letra do gabarito.
 * Só inclui entradas com correspondência segura (uma única letra A–E por número).
 */
export function parseAnswerKeyMap(pages: ExamImportPage[]): {
  answers: Map<number, string>;
  ambiguous: number[];
  alerts: ExamImportAlert[];
} {
  const text = joinPagesWithMarkers(pages).replace(/<<<PAGE:\d+>>>/g, "\n");
  const answers = new Map<number, string>();
  const ambiguous = new Set<number>();
  const alerts: ExamImportAlert[] = [];
  const candidates = new Map<number, Set<string>>();

  const patterns = [
    // 1-A / 1. A / 1) A / 01 – B (também C/E em certo-errado)
    /(?:^|[;\s,])\s*(\d{1,3})\s*[\.\-\–\)\:]\s*([A-Ea-e])\b/g,
    // Questão 1: A
    /QUEST[AÃ]O\s*(\d{1,3})\s*[\.\-\–\)\:]\s*([A-Ea-e])\b/gi,
    // 1 - CERTO / 2 ERRADO
    /(?:^|[;\s,])\s*(\d{1,3})\s*[\.\-\–\)\:]\s*(CERTO|ERRADO|VERDADEIRO|FALSO)\b/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      let key = m[2]!.toUpperCase();
      if (key === "CERTO" || key === "VERDADEIRO") key = "C";
      if (key === "ERRADO" || key === "FALSO") key = "E";
      if (!Number.isFinite(n) || n < 1 || n > 300) continue;
      if (!KEY_RE.test(key)) continue;
      const set = candidates.get(n) ?? new Set<string>();
      set.add(key);
      candidates.set(n, set);
    }
  }

  for (const [n, set] of candidates) {
    if (set.size === 1) {
      answers.set(n, [...set][0]!);
    } else {
      ambiguous.add(n);
      alerts.push({
        code: "answer_unmatched",
        message: `Gabarito ambíguo para a questão ${n} — deixado em branco.`,
        questionNumber: n,
      });
    }
  }

  if (!candidates.size && text.trim().length > 20) {
    alerts.push({
      code: "answer_unmatched",
      message: "Não foi possível extrair gabarito com correspondência segura.",
    });
  }

  return { answers, ambiguous: [...ambiguous], alerts };
}

/**
 * Associa gabarito às questões somente quando houver correspondência segura.
 * Em dúvida, deixa correctKey null e sinaliza.
 */
export function associateAnswerKey(
  questions: ExamImportDraftQuestion[],
  answerPages: ExamImportPage[],
): { questions: ExamImportDraftQuestion[]; alerts: ExamImportAlert[] } {
  if (!answerPages.length) {
    return { questions, alerts: [] };
  }

  const { answers, alerts } = parseAnswerKeyMap(answerPages);
  const out = questions.map((q) => {
    const key = answers.get(q.number);
    if (!key) {
      const alert: ExamImportAlert = {
        code: "answer_unmatched",
        message: `Sem gabarito seguro para a questão ${q.number}.`,
        questionNumber: q.number,
      };
      return {
        ...q,
        correctKey: null,
        alerts: [...q.alerts, alert],
      };
    }
    return { ...q, correctKey: key };
  });

  const matched = out.filter((q) => q.correctKey).length;
  if (matched === 0 && questions.length) {
    alerts.push({
      code: "answer_unmatched",
      message: "Nenhuma questão recebeu gabarito com correspondência segura.",
    });
  }

  return { questions: out, alerts };
}

import type { ExamImportAlert, ExamImportDraftQuestion, ExamImportFigureRef, ExamImportPage } from "@/types/exam-import";

const ALT_KEYS = ["A", "B", "C", "D", "E"] as const;

function uid(): string {
  return `dq_${Math.random().toString(36).slice(2, 10)}`;
}

/** Junta páginas com marcadores para estimar página de origem. */
export function joinPagesWithMarkers(pages: ExamImportPage[]): string {
  return pages
    .map((p) => `\n<<<PAGE:${p.page}>>>\n${p.text}`)
    .join("\n");
}

function pageAtOffset(full: string, offset: number): number | null {
  const before = full.slice(0, Math.max(0, offset));
  const matches = [...before.matchAll(/<<<PAGE:(\d+)>>>/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  return Number(last?.[1] ?? NaN) || null;
}

function detectFigures(text: string, page: number | null): ExamImportFigureRef[] {
  const refs: ExamImportFigureRef[] = [];
  const re = /\b(figura|fig\.|quadro|imagem|gr[aá]fico)\s*(\d+[A-Za-z]?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    refs.push({
      page: page ?? 1,
      label: `${m[1]} ${m[2]}`.replace(/\s+/g, " "),
      note: "Referência textual — conferir imagem no PDF original.",
    });
  }
  return refs;
}

type RawBlock = {
  number: number;
  body: string;
  start: number;
  end: number;
};

/**
 * Detecta blocos de questões em texto de prova (padrão comum A–E).
 * Mantém tudo como rascunho — não publica.
 */
export function parseQuestionsFromText(
  pages: ExamImportPage[],
  opts?: { defaultSubject?: string; defaultTopic?: string; sourceFileName?: string },
): { questions: ExamImportDraftQuestion[]; alerts: ExamImportAlert[] } {
  const full = joinPagesWithMarkers(pages);
  const plain = full.replace(/<<<PAGE:\d+>>>/g, "\n");
  const alerts: ExamImportAlert[] = [];

  const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
  if (totalChars < 40) {
    alerts.push({
      code: "needs_ocr",
      message: "Pouco ou nenhum texto extraível. PDF pode ser digitalizado — OCR não está habilitado nesta versão.",
    });
    return { questions: [], alerts };
  }

  // 1. / 01 - / QUESTÃO 1
  const startRe =
    /(?:^|\n)\s*(?:QUEST[AÃ]O\s*)?(\d{1,3})\s*[\.\-\–\)]\s+/gi;
  const starts: { number: number; index: number; matchLen: number }[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = startRe.exec(plain))) {
    const number = Number(sm[1]);
    if (!Number.isFinite(number) || number < 1 || number > 300) continue;
    starts.push({ number, index: sm.index + (sm[0].startsWith("\n") ? 1 : 0), matchLen: sm[0].length });
  }

  if (!starts.length) {
    alerts.push({
      code: "low_confidence",
      message: "Não foi possível detectar numeração de questões no texto extraído.",
    });
    return { questions: [], alerts };
  }

  const blocks: RawBlock[] = [];
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i]!;
    const next = starts[i + 1];
    const bodyStart = cur.index + cur.matchLen;
    const bodyEnd = next ? next.index : plain.length;
    blocks.push({
      number: cur.number,
      body: plain.slice(bodyStart, bodyEnd).trim(),
      start: cur.index,
      end: bodyEnd,
    });
  }

  const seen = new Map<number, number>();
  const questions: ExamImportDraftQuestion[] = [];

  for (const block of blocks) {
    const count = (seen.get(block.number) ?? 0) + 1;
    seen.set(block.number, count);
    if (count > 1) {
      alerts.push({
        code: "duplicate_number",
        message: `Numeração repetida: questão ${block.number}.`,
        questionNumber: block.number,
      });
    }

    const pageStart = pageAtOffset(full, mapPlainToFull(full, plain, block.start));
    const parsed = splitStatementAndAlternatives(block.body);
    const qAlerts: ExamImportAlert[] = [];

    if (!parsed.statement.trim()) {
      qAlerts.push({
        code: "empty_statement",
        message: "Enunciado vazio ou não detectado.",
        questionNumber: block.number,
      });
    }

    const missingKeys = ALT_KEYS.filter((k) => !parsed.alternatives.some((a) => a.key === k));
    if (parsed.alternatives.length < 2) {
      qAlerts.push({
        code: "few_alternatives",
        message: "Menos de 2 alternativas detectadas.",
        questionNumber: block.number,
      });
    }
    for (const k of missingKeys.slice(0, 3)) {
      if (parsed.alternatives.length >= 2 && missingKeys.length) {
        qAlerts.push({
          code: "missing_alternative",
          message: `Alternativa ${k} ausente.`,
          questionNumber: block.number,
        });
        break;
      }
    }

    let confidence = 0.55;
    if (parsed.statement.length > 20) confidence += 0.15;
    if (parsed.alternatives.length >= 4) confidence += 0.2;
    if (parsed.alternatives.length === 5) confidence += 0.05;
    if (qAlerts.length) confidence -= 0.15 * qAlerts.length;
    confidence = Math.max(0.05, Math.min(0.95, confidence));

    if (confidence < 0.45) {
      qAlerts.push({
        code: "low_confidence",
        message: "Baixa confiança na extração — revisar manualmente.",
        questionNumber: block.number,
      });
    }

    if (parsed.kind === "true_false" && parsed.alternatives.length >= 2) {
      confidence = Math.min(0.95, confidence + 0.1);
    }

    questions.push({
      id: uid(),
      number: block.number,
      statement: parsed.statement.trim(),
      alternatives: parsed.alternatives,
      correctKey: null,
      subject: opts?.defaultSubject ?? "",
      topic: opts?.defaultTopic ?? "",
      status: "draft",
      kind: parsed.kind,
      pageStart,
      pageEnd: pageStart,
      confidence,
      alerts: qAlerts,
      figureRefs: detectFigures(block.body, pageStart),
      explanation: "",
      explanationSource: "none",
      publishedQuestionId: null,
      sourceFileName: opts?.sourceFileName ?? "",
      possibleDuplicateIds: [],
    });
  }

  alerts.push(...questions.flatMap((q) => q.alerts));
  return { questions, alerts: dedupeAlerts(alerts) };
}

function mapPlainToFull(full: string, plain: string, plainOffset: number): number {
  // Aproximação: proporção de comprimento (marcadores PAGE são curtos).
  if (!plain.length) return 0;
  const ratio = full.length / plain.length;
  return Math.min(full.length - 1, Math.floor(plainOffset * ratio));
}

export function splitStatementAndAlternatives(body: string): {
  statement: string;
  alternatives: { key: string; text: string }[];
  kind: "multiple_choice" | "true_false";
} {
  // Certo/Errado ou Verdadeiro/Falso (padrão comum em concursos).
  const ce = detectTrueFalse(body);
  if (ce) return ce;

  const altRe = /(?:^|\n)\s*[\(\[]?\s*([A-Ea-e])\s*[\)\]\.\-\–\:]\s+/g;
  const matches = [...body.matchAll(altRe)];
  if (!matches.length) {
    return { statement: body.trim(), alternatives: [], kind: "multiple_choice" };
  }

  const first = matches[0]!;
  const statement = body.slice(0, first.index).trim();
  const alternatives: { key: string; text: string }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const key = m[1]!.toUpperCase();
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? body.length) : body.length;
    const text = body.slice(start, end).trim().replace(/\s+/g, " ");
    if (!ALT_KEYS.includes(key as (typeof ALT_KEYS)[number])) continue;
    if (alternatives.some((a) => a.key === key)) continue;
    alternatives.push({ key, text });
  }

  return { statement, alternatives, kind: "multiple_choice" };
}

/** Detecta blocos C/E ou V/F sem inventar conteúdo. */
export function detectTrueFalse(body: string): {
  statement: string;
  alternatives: { key: string; text: string }[];
  kind: "true_false";
} | null {
  const ceLabeled =
    /(?:^|\n)\s*[\(\[]?\s*(C|E)\s*[\)\]\.\-\–\:]\s*(certo|errado|errada|verdadeiro|falso)\b/gi;
  const labeled = [...body.matchAll(ceLabeled)];
  if (labeled.length >= 2) {
    const first = labeled[0]!;
    const statement = body.slice(0, first.index).trim();
    const alternatives: { key: string; text: string }[] = [];
    for (const m of labeled) {
      const key = m[1]!.toUpperCase();
      const text = (m[2] ?? "").trim();
      if (alternatives.some((a) => a.key === key)) continue;
      if (key === "C" || key === "E") alternatives.push({ key, text: text || (key === "C" ? "Certo" : "Errado") });
    }
    if (alternatives.length >= 2) {
      return { statement, alternatives: alternatives.slice(0, 2), kind: "true_false" };
    }
  }

  // Linhas finais só com (C) Certo / (E) Errado
  const tail = /(?:certo|errada?|verdadeiro|falso).{0,40}(?:certo|errada?|verdadeiro|falso)/i;
  if (tail.test(body) && !/(?:^|\n)\s*[\(\[]?\s*[A-Ea-e]\s*[\)\]\.\-\–\:]/.test(body.replace(/[CE]/gi, ""))) {
    // Sem letras A–E de múltipla escolha: oferecer C/E padrão se o enunciado menciona certo/errado.
    const strip = body
      .replace(/(?:^|\n)\s*[\(\[]?\s*[CE]\s*[\)\]\.\-\–\:]\s*(?:certo|errada?|verdadeiro|falso)\b.*/gi, "")
      .trim();
    if (strip.length > 10) {
      return {
        statement: strip,
        alternatives: [
          { key: "C", text: "Certo" },
          { key: "E", text: "Errado" },
        ],
        kind: "true_false",
      };
    }
  }

  return null;
}

function dedupeAlerts(alerts: ExamImportAlert[]): ExamImportAlert[] {
  const seen = new Set<string>();
  const out: ExamImportAlert[] = [];
  for (const a of alerts) {
    const k = `${a.code}|${a.questionNumber ?? ""}|${a.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

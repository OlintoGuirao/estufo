import { describe, expect, it, beforeEach } from "vitest";
import { validatePdfUpload, looksLikePdf, EXAM_IMPORT_MAX_BYTES } from "./validate";
import { parseQuestionsFromText, splitStatementAndAlternatives } from "./parse-questions";
import { associateAnswerKey, parseAnswerKeyMap } from "./parse-answer-key";
import { canPublishQuestion, assertDraftNotStudentVisible, studentVisibleQuestions } from "./publish";
import { metadataFingerprint, sha256Hex } from "./hash";
import { examImportStore } from "@/services/exam-import-store";
import type { ExamImportBatch, ExamImportDraftQuestion, ExamImportPage } from "@/types/exam-import";

const sampleExamText = `
PROVA OBJETIVA — MODELO FICTÍCIO

1. Qual é a capital do Brasil?
(A) São Paulo
(B) Brasília
(C) Rio de Janeiro
(D) Salvador
(E) Belo Horizonte

2. Em lógica, a negação de "todo A é B" é:
(A) Nenhum A é B
(B) Algum A não é B
(C) Todo A não é B
(D) Algum A é B
(E) Todo B é A

3. Assinale a alternativa correta sobre a figura 1 do caderno.
(A) Opção um
(B) Opção dois
(C) Opção três
(D) Opção quatro
(E) Opção cinco
`;

const sampleKeyText = `
GABARITO FICTÍCIO
1-B
2-B
3-A
4-Z
`;

function pagesFrom(text: string, page = 1): ExamImportPage[] {
  return [{ page, text, charCount: text.length }];
}

function draft(partial: Partial<ExamImportDraftQuestion> & { number: number }): ExamImportDraftQuestion {
  return {
    id: `q${partial.number}`,
    statement: "Enunciado",
    alternatives: [
      { key: "A", text: "a" },
      { key: "B", text: "b" },
    ],
    correctKey: "A",
    subject: "Português",
    topic: "Geral",
    status: "draft",
    kind: "multiple_choice",
    pageStart: 1,
    pageEnd: 1,
    confidence: 0.8,
    alerts: [],
    figureRefs: [],
    explanation: "",
    explanationSource: "none",
    publishedQuestionId: null,
    sourceFileName: "prova.pdf",
    possibleDuplicateIds: [],
    ...partial,
  };
}

describe("validatePdfUpload", () => {
  it("aceita PDF válido", () => {
    expect(
      validatePdfUpload({
        fileName: "prova.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
  });

  it("rejeita extensão inválida", () => {
    const r = validatePdfUpload({
      fileName: "prova.docx",
      mimeType: "application/pdf",
      sizeBytes: 10,
    });
    expect(r.ok).toBe(false);
  });

  it("rejeita tamanho acima do limite", () => {
    const r = validatePdfUpload({
      fileName: "prova.pdf",
      mimeType: "application/pdf",
      sizeBytes: EXAM_IMPORT_MAX_BYTES + 1,
    });
    expect(r.ok).toBe(false);
  });

  it("rejeita arquivo vazio", () => {
    const r = validatePdfUpload({
      fileName: "prova.pdf",
      mimeType: "application/pdf",
      sizeBytes: 0,
    });
    expect(r.ok).toBe(false);
  });

  it("detecta magic number PDF", () => {
    const ok = new TextEncoder().encode("%PDF-1.4 rest");
    const bad = new TextEncoder().encode("not a pdf");
    expect(looksLikePdf(ok)).toBe(true);
    expect(looksLikePdf(bad)).toBe(false);
  });
});

describe("parseQuestionsFromText", () => {
  it("extrai enunciados e alternativas A–E", () => {
    const { questions, alerts } = parseQuestionsFromText(pagesFrom(sampleExamText));
    expect(questions.length).toBe(3);
    expect(questions[0]!.statement).toMatch(/capital do Brasil/i);
    expect(questions[0]!.alternatives.map((a) => a.key)).toEqual(["A", "B", "C", "D", "E"]);
    expect(questions[0]!.status).toBe("draft");
    expect(questions[0]!.correctKey).toBeNull();
    expect(questions[2]!.figureRefs.some((f) => /figura/i.test(f.label))).toBe(true);
    expect(alerts.some((a) => a.code === "needs_ocr")).toBe(false);
  });

  it("sinaliza numeração duplicada", () => {
    const text = `
1. Pergunta um?
(A) a
(B) b
1. Pergunta repetida?
(A) x
(B) y
`;
    const { alerts } = parseQuestionsFromText(pagesFrom(text));
    expect(alerts.some((a) => a.code === "duplicate_number")).toBe(true);
  });

  it("alerta alternativas ausentes / poucas", () => {
    const text = [
      "1. Pergunta com poucas alternativas?",
      "(A) unica",
      "",
      "2. Outra pergunta completa?",
      "(A) a",
      "(B) b",
      "(C) c",
      "(D) d",
      "(E) e",
    ].join("\n");
    const { questions } = parseQuestionsFromText(pagesFrom(text));
    expect(questions.length).toBeGreaterThanOrEqual(1);
    expect(questions[0]!.alternatives.length).toBeLessThan(2);
    expect(questions[0]!.alerts.some((a) => a.code === "few_alternatives")).toBe(true);
  });

  it("PDF sem texto extraível → needs_ocr", () => {
    const { questions, alerts } = parseQuestionsFromText(pagesFrom("   "));
    expect(questions).toHaveLength(0);
    expect(alerts.some((a) => a.code === "needs_ocr")).toBe(true);
  });

  it("detecta certo/errado rotulado", () => {
    const text = `
1. A soberania é fundamento da República.
(C) Certo
(E) Errado
`;
    const { questions } = parseQuestionsFromText(pagesFrom(text));
    expect(questions).toHaveLength(1);
    expect(questions[0]!.kind).toBe("true_false");
    expect(questions[0]!.alternatives.map((a) => a.key)).toEqual(["C", "E"]);
  });
});

describe("splitStatementAndAlternatives", () => {
  it("normaliza chaves maiúsculas", () => {
    const r = splitStatementAndAlternatives("Enunciado\n(a) um\n(b) dois");
    expect(r.alternatives[0]!.key).toBe("A");
  });
});

describe("flagPossibleDuplicates", () => {
  it("sinaliza sem sobrescrever", async () => {
    const { flagPossibleDuplicates } = await import("./duplicates");
    const qs = [
      draft({
        number: 1,
        statement: "Qual é a capital do Brasil segundo a Constituição fictícia de teste longo?",
      }),
    ];
    const flagged = flagPossibleDuplicates(qs, [
      {
        id: "exist_1",
        statement: "Qual é a capital do Brasil segundo a Constituição fictícia de teste longo?",
      },
    ]);
    expect(flagged[0]!.possibleDuplicateIds).toContain("exist_1");
    expect(flagged[0]!.alerts.some((a) => a.code === "possible_duplicate")).toBe(true);
  });
});

describe("parseAnswerKey / associate", () => {
  it("associa só com correspondência segura", () => {
    const { questions } = parseQuestionsFromText(pagesFrom(sampleExamText));
    const { answers, ambiguous } = parseAnswerKeyMap(pagesFrom(sampleKeyText));
    expect(answers.get(1)).toBe("B");
    expect(answers.get(2)).toBe("B");
    expect(answers.has(4)).toBe(false); // Z inválido / não A-E no padrão seguro se filtrado
    expect(ambiguous).toEqual([]);

    const assoc = associateAnswerKey(questions, pagesFrom(sampleKeyText));
    expect(assoc.questions[0]!.correctKey).toBe("B");
    expect(assoc.questions[1]!.correctKey).toBe("B");
    // questão 3 tem A no gabarito
    expect(assoc.questions[2]!.correctKey).toBe("A");
  });

  it("em dúvida deixa gabarito em branco", () => {
    const qs = [draft({ number: 1, correctKey: null })];
    const ambiguousKey = "1-A\n1-B\n";
    const assoc = associateAnswerKey(qs, pagesFrom(ambiguousKey));
    expect(assoc.questions[0]!.correctKey).toBeNull();
    expect(
      assoc.questions[0]!.alerts.some((a) => a.code === "answer_unmatched") ||
        assoc.alerts.some((a) => a.code === "answer_unmatched"),
    ).toBe(true);
  });

  it("sem gabarito não inventa respostas", () => {
    const { questions } = parseQuestionsFromText(pagesFrom(sampleExamText));
    const assoc = associateAnswerKey(questions, []);
    expect(assoc.questions.every((q) => q.correctKey === null)).toBe(true);
  });
});

describe("publish gates", () => {
  it("bloqueia publicação de rascunho", () => {
    const r = canPublishQuestion(draft({ number: 1, status: "draft" }));
    expect(r.ok).toBe(false);
  });

  it("permite aprovação completa", () => {
    const r = canPublishQuestion(
      draft({ number: 1, status: "approved", correctKey: "A", subject: "Dir." }),
    );
    expect(r.ok).toBe(true);
  });

  it("rascunho não é visível ao aluno", () => {
    const batch: ExamImportBatch = {
      id: "b1",
      createdAt: "",
      updatedAt: "",
      createdByEmail: "a@b.com",
      status: "needs_review",
      authorizationConfirmed: true,
      metadata: {
        board: "X",
        organ: "Y",
        role: "Z",
        year: 2024,
        examName: "T",
        bookletType: "",
        sourceUrl: "",
      },
      examFile: {
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        sha256: "aa",
        storageKey: null,
      },
      answerKeyFile: null,
      pages: [],
      answerKeyPages: [],
      questions: [
        draft({ number: 1, status: "draft", publishedQuestionId: null }),
        draft({
          number: 2,
          status: "approved",
          publishedQuestionId: "pub1",
          id: "q2",
        }),
      ],
      alerts: [],
      textExtractable: true,
      needsOcr: false,
      error: null,
      persistence: "mock-local",
    };
    expect(studentVisibleQuestions(batch)).toHaveLength(1);
    expect(() =>
      assertDraftNotStudentVisible(draft({ number: 1, status: "draft", publishedQuestionId: "x" })),
    ).toThrow();
  });
});

describe("duplicidade", () => {
  beforeEach(() => {
    examImportStore._resetForTests();
  });

  it("detecta arquivo já importado por hash e metadados", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 fake");
    const hash = await sha256Hex(bytes);
    const meta = {
      board: "Vunesp",
      organ: "TJ",
      role: "Escrevente",
      year: 2024,
      examName: "Prova teste",
      bookletType: "Tipo 1",
      sourceUrl: "",
    };
    const batch: ExamImportBatch = {
      id: "imp1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByEmail: "admin@test.com",
      status: "needs_review",
      authorizationConfirmed: true,
      metadata: meta,
      examFile: {
        fileName: "p.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        sha256: hash,
        storageKey: null,
      },
      answerKeyFile: null,
      pages: [],
      answerKeyPages: [],
      questions: [],
      alerts: [],
      textExtractable: true,
      needsOcr: false,
      error: null,
      persistence: "mock-local",
    };
    examImportStore.upsert(batch);
    expect(examImportStore.findByExamHash(hash)?.id).toBe("imp1");
    expect(examImportStore.findByMetadata(meta)?.id).toBe("imp1");
    expect(metadataFingerprint(meta)).toContain("vunesp");
  });
});

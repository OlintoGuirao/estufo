/**
 * Server functions de importação de provas — importáveis pelo cliente.
 * PDF fica em armazenamento privado; lógica pesada só no handler.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const metaSchema = z.object({
  board: z.string().min(1).max(120),
  organ: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  year: z.number().int().min(1990).max(2100),
  examName: z.string().min(1).max(240),
  bookletType: z.string().max(80).default(""),
  sourceUrl: z.string().max(500).default(""),
  defaultSubject: z.string().max(160).optional().default(""),
  defaultTopic: z.string().max(160).optional().default(""),
});

const submitSchema = z.object({
  examPdfBase64: z.string().min(1),
  examFileName: z.string().min(1).max(240),
  examMimeType: z.string().max(100),
  answerKeyPdfBase64: z.string().nullable().optional(),
  answerKeyFileName: z.string().nullable().optional(),
  answerKeyMimeType: z.string().nullable().optional(),
  metadata: metaSchema,
  authorizationConfirmed: z.literal(true),
  actorEmail: z.string().email(),
});

export const getExamImportAccess = createServerFn({ method: "POST" })
  .validator(z.object({ actorEmail: z.string().email() }))
  .handler(async ({ data }) => {
    const { canImportExams } = await import("@/server/exam-import/config");
    return canImportExams(data.actorEmail);
  });

/** Preview privado do PDF (base64) — só para usuário autorizado; não é URL pública. */
export const getExamImportPdfPreview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      actorEmail: z.string().email(),
      storageKey: z.string().min(1).max(400),
    }),
  )
  .handler(async ({ data }) => {
    const { canImportExams } = await import("@/server/exam-import/config");
    const access = canImportExams(data.actorEmail);
    if (!access.allowed) {
      throw new Error(JSON.stringify({ message: access.reason, status: 403 }));
    }
    const { readPrivatePdf } = await import("@/server/exam-import/store");
    const bytes = await readPrivatePdf(data.storageKey);
    if (!bytes) {
      throw new Error(JSON.stringify({ message: "Arquivo não encontrado no armazenamento privado.", status: 404 }));
    }
    const b64 = Buffer.from(bytes).toString("base64");
    return { mimeType: "application/pdf", base64: b64 };
  });

export const processExamImport = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(async ({ data }) => {
    const { canImportExams } = await import("@/server/exam-import/config");
    const access = canImportExams(data.actorEmail);
    if (!access.allowed) {
      throw new Error(JSON.stringify({ message: access.reason, status: 403 }));
    }
    if (!data.authorizationConfirmed) {
      throw new Error(
        JSON.stringify({
          message: "Confirme que tem autorização para enviar e processar os arquivos.",
          status: 400,
        }),
      );
    }

    const { validatePdfUpload, decodeBase64ToBytes, looksLikePdf } = await import(
      "@/lib/exam-import/validate"
    );
    const examCheck = validatePdfUpload({
      fileName: data.examFileName,
      mimeType: data.examMimeType,
      sizeBytes: Math.ceil((data.examPdfBase64.length * 3) / 4),
    });
    if (!examCheck.ok) {
      throw new Error(JSON.stringify({ message: examCheck.message, status: 400 }));
    }

    let examBytes: Uint8Array;
    try {
      examBytes = decodeBase64ToBytes(data.examPdfBase64);
    } catch {
      throw new Error(JSON.stringify({ message: "PDF da prova inválido (base64).", status: 400 }));
    }
    if (!looksLikePdf(examBytes)) {
      throw new Error(JSON.stringify({ message: "O arquivo da prova não parece um PDF.", status: 400 }));
    }
    const exactExamCheck = validatePdfUpload({
      fileName: data.examFileName,
      mimeType: data.examMimeType || "application/pdf",
      sizeBytes: examBytes.byteLength,
    });
    if (!exactExamCheck.ok) {
      throw new Error(JSON.stringify({ message: exactExamCheck.message, status: 400 }));
    }

    let answerBytes: Uint8Array | null = null;
    if (data.answerKeyPdfBase64 && data.answerKeyFileName) {
      const akCheck = validatePdfUpload({
        fileName: data.answerKeyFileName,
        mimeType: data.answerKeyMimeType || "application/pdf",
        sizeBytes: Math.ceil((data.answerKeyPdfBase64.length * 3) / 4),
      });
      if (!akCheck.ok) {
        throw new Error(JSON.stringify({ message: `Gabarito: ${akCheck.message}`, status: 400 }));
      }
      answerBytes = decodeBase64ToBytes(data.answerKeyPdfBase64);
      if (!looksLikePdf(answerBytes)) {
        throw new Error(JSON.stringify({ message: "O arquivo do gabarito não parece um PDF.", status: 400 }));
      }
      const akExact = validatePdfUpload({
        fileName: data.answerKeyFileName,
        mimeType: data.answerKeyMimeType || "application/pdf",
        sizeBytes: answerBytes.byteLength,
      });
      if (!akExact.ok) {
        throw new Error(JSON.stringify({ message: `Gabarito: ${akExact.message}`, status: 400 }));
      }
    }

    const { sha256Hex } = await import("@/lib/exam-import/hash");
    const examHash = await sha256Hex(examBytes);
    const batchId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const { savePrivatePdf } = await import("@/server/exam-import/store");
    const examStored = await savePrivatePdf({
      batchId,
      kind: "exam",
      fileName: data.examFileName,
      bytes: examBytes,
    });

    let answerStored: { storageKey: string } | null = null;
    let answerHash: string | null = null;
    if (answerBytes && data.answerKeyFileName) {
      answerStored = await savePrivatePdf({
        batchId,
        kind: "answer-key",
        fileName: data.answerKeyFileName,
        bytes: answerBytes,
      });
      answerHash = await sha256Hex(answerBytes);
    }

    const { extractPdfPages } = await import("@/server/exam-import/extract-pdf");
    const examExtract = await extractPdfPages(examBytes);
    const answerExtract = answerBytes
      ? await extractPdfPages(answerBytes)
      : { pages: [], textExtractable: true, needsOcr: false };

    const { parseQuestionsFromText } = await import("@/lib/exam-import/parse-questions");
    const { associateAnswerKey } = await import("@/lib/exam-import/parse-answer-key");

    let { questions, alerts } = parseQuestionsFromText(examExtract.pages, {
      defaultSubject: data.metadata.defaultSubject || "",
      defaultTopic: data.metadata.defaultTopic || "",
      sourceFileName: data.examFileName,
    });
    const assoc = associateAnswerKey(questions, answerExtract.pages);
    questions = assoc.questions;
    alerts = [...alerts, ...assoc.alerts];

    if (examExtract.needsOcr) {
      alerts.push({
        code: "needs_ocr",
        message: "Texto insuficiente no PDF da prova. OCR não está habilitado — revise manualmente ou use PDF com texto.",
      });
    }

    const now = new Date().toISOString();
    return {
      id: batchId,
      createdAt: now,
      updatedAt: now,
      createdByEmail: data.actorEmail.toLowerCase(),
      status: examExtract.needsOcr && !questions.length ? ("failed" as const) : ("needs_review" as const),
      authorizationConfirmed: true,
      metadata: data.metadata,
      examFile: {
        fileName: data.examFileName,
        mimeType: data.examMimeType || "application/pdf",
        sizeBytes: examBytes.byteLength,
        sha256: examHash,
        storageKey: examStored.storageKey,
      },
      answerKeyFile:
        answerBytes && data.answerKeyFileName && answerHash
          ? {
              fileName: data.answerKeyFileName,
              mimeType: data.answerKeyMimeType || "application/pdf",
              sizeBytes: answerBytes.byteLength,
              sha256: answerHash,
              storageKey: answerStored?.storageKey ?? null,
            }
          : null,
      pages: examExtract.pages,
      answerKeyPages: answerExtract.pages,
      questions,
      alerts,
      textExtractable: examExtract.textExtractable,
      needsOcr: examExtract.needsOcr,
      error: examExtract.needsOcr && !questions.length ? "Sem texto extraível (possível PDF digitalizado)." : null,
      persistence: "mock-local" as const,
      accessMode: access.mode,
    };
  });

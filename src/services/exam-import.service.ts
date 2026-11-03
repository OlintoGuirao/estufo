import { ApiError } from "./api";
import {
  getExamImportAccess,
  processExamImport,
} from "./exam-import.fns";
import { examImportStore } from "./exam-import-store";
import { questionTaxonomyStore } from "./question-taxonomy-store";
import { canPublishQuestion } from "@/lib/exam-import/publish";
import { metadataFingerprint } from "@/lib/exam-import/hash";
import { db } from "./mock/data";
import type {
  ExamImportBatch,
  ExamImportCanAccess,
  ExamImportDraftQuestion,
  ExamImportMetadata,
} from "@/types/exam-import";
import type { Difficulty } from "@/types";

function parseErr(e: unknown): never {
  if (e instanceof Error && e.message.startsWith("{")) {
    try {
      const payload = JSON.parse(e.message) as { message?: string; status?: number };
      throw new ApiError(payload.message ?? "Erro na importação.", payload.status ?? 500);
    } catch (inner) {
      if (inner instanceof ApiError) throw inner;
    }
  }
  throw e instanceof Error ? new ApiError(e.message, 500) : new ApiError("Erro na importação.", 500);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export const examImportService = {
  async canAccess(actorEmail: string): Promise<ExamImportCanAccess> {
    try {
      return await getExamImportAccess({ data: { actorEmail } });
    } catch (e) {
      return parseErr(e);
    }
  },

  list(): ExamImportBatch[] {
    return examImportStore.list();
  },

  get(id: string): ExamImportBatch | null {
    return examImportStore.get(id);
  },

  checkDuplicate(meta: ExamImportMetadata, examSha256?: string): {
    byHash: ExamImportBatch | null;
    byMeta: ExamImportBatch | null;
  } {
    return {
      byHash: examSha256 ? examImportStore.findByExamHash(examSha256) : null,
      byMeta: examImportStore.findByMetadata(meta),
    };
  },

  async submit(
    input: {
      examFile: File;
      answerKeyFile?: File | null;
      metadata: ExamImportMetadata;
      authorizationConfirmed: boolean;
      actorEmail: string;
      /** Se true, permite reimportar mesmo com hash/meta duplicados. */
      force?: boolean;
    },
  ): Promise<ExamImportBatch> {
    if (!input.authorizationConfirmed) {
      throw new ApiError("Confirme a autorização para processar os arquivos.", 400);
    }

    const examPdfBase64 = await fileToBase64(input.examFile);
    // Pré-checagem de hash no cliente (Web Crypto) para duplicidade local.
    const examBytes = new Uint8Array(await input.examFile.arrayBuffer());
    const { sha256Hex } = await import("@/lib/exam-import/hash");
    const hash = await sha256Hex(examBytes);
    const dup = examImportService.checkDuplicate(input.metadata, hash);
    if (!input.force && (dup.byHash || dup.byMeta)) {
      const which = dup.byHash ? "hash do arquivo" : "metadados da prova";
      throw new ApiError(
        `Importação já existe (${which}): ${dup.byHash?.id ?? dup.byMeta?.id}. Use forçar reimportação se necessário.`,
        409,
      );
    }

    try {
      if (input.metadata.defaultSubject?.trim()) {
        questionTaxonomyStore.ensureSubject(input.metadata.defaultSubject);
        if (input.metadata.defaultTopic?.trim()) {
          questionTaxonomyStore.ensureTopic(
            input.metadata.defaultSubject,
            input.metadata.defaultTopic,
          );
        }
      }

      const result = await processExamImport({
        data: {
          examPdfBase64,
          examFileName: input.examFile.name,
          examMimeType: input.examFile.type || "application/pdf",
          answerKeyPdfBase64: input.answerKeyFile ? await fileToBase64(input.answerKeyFile) : null,
          answerKeyFileName: input.answerKeyFile?.name ?? null,
          answerKeyMimeType: input.answerKeyFile?.type || null,
          metadata: input.metadata,
          authorizationConfirmed: true as const,
          actorEmail: input.actorEmail,
        },
      });
      const { accessMode: _mode, ...batch } = result as ExamImportBatch & { accessMode?: string };

      const { flagPossibleDuplicates } = await import("@/lib/exam-import/duplicates");
      const questions = flagPossibleDuplicates(
        batch.questions,
        db.questions.map((q) => ({ id: q.id, statement: q.statement })),
      );
      const alerts = [
        ...batch.alerts,
        ...questions.flatMap((q) => q.alerts.filter((a) => a.code === "possible_duplicate")),
      ];

      return examImportStore.upsert({ ...batch, questions, alerts });
    } catch (e) {
      return parseErr(e);
    }
  },

  updateQuestion(
    batchId: string,
    questionId: string,
    patch: Partial<ExamImportDraftQuestion>,
  ): ExamImportBatch {
    const next = examImportStore.updateQuestion(batchId, questionId, patch);
    if (!next) throw new ApiError("Importação não encontrada.", 404);
    return next;
  },

  setQuestionStatus(
    batchId: string,
    questionId: string,
    status: ExamImportDraftQuestion["status"],
    patch?: Partial<ExamImportDraftQuestion>,
  ): ExamImportBatch {
    const batch = examImportStore.get(batchId);
    if (!batch) throw new ApiError("Importação não encontrada.", 404);
    const q0 = batch.questions.find((x) => x.id === questionId);
    if (!q0) throw new ApiError("Questão não encontrada.", 404);
    const q = { ...q0, ...patch, id: q0.id };

    if (status === "approved") {
      const check = canPublishQuestion({ ...q, status: "approved" });
      if (!check.ok) throw new ApiError(check.reason, 400);
    }

    let publishedQuestionId = q.publishedQuestionId;
    if (status === "approved" && !publishedQuestionId) {
      // Possível duplicata: publica como NOVO id — nunca sobrescreve a existente.
      publishedQuestionId = publishToMockQuestions(batch, { ...q, status: "approved" });
      if (q.subject.trim()) {
        questionTaxonomyStore.ensureSubject(q.subject);
        if (q.topic.trim()) questionTaxonomyStore.ensureTopic(q.subject, q.topic);
      }
    }

    const next = examImportStore.updateQuestion(batchId, questionId, {
      ...patch,
      status,
      publishedQuestionId,
    });
    if (!next) throw new ApiError("Falha ao atualizar.", 500);

    const approved = next.questions.filter((x) => x.status === "approved").length;
    const statusBatch =
      approved > 0 ? ("partially_published" as const) : next.status;

    return examImportStore.upsert({ ...next, status: statusBatch });
  },

  metadataFingerprint,
};

/** Publica no banco mock de questões (visível em /questoes). Não sobrescreve IDs existentes. */
function publishToMockQuestions(batch: ExamImportBatch, q: ExamImportDraftQuestion): string {
  const id = `impq_${q.id}`;
  if (db.questions.some((x) => x.id === id)) {
    return id;
  }
  const difficulty: Difficulty = "media";
  db.questions.push({
    id,
    statement: q.statement,
    alternatives: q.alternatives,
    board: batch.metadata.board,
    year: batch.metadata.year,
    contest: batch.metadata.examName,
    subject: q.subject,
    topic: q.topic || "Geral",
    difficulty,
    source: `import:${batch.id}`,
    favorite: false,
    markedForReview: false,
    answered: null,
    correctKey: q.correctKey!,
    explanation:
      q.explanationSource === "ai"
        ? `[Gerada por IA] ${q.explanation}`
        : q.explanation || "Sem explicação oficial cadastrada.",
  });
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("estufoo.mockdb", JSON.stringify(db));
    }
  } catch {
    /* ignore */
  }
  return id;
}

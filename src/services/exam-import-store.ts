import type { ExamImportBatch, ExamImportDraftQuestion } from "@/types/exam-import";
import { metadataFingerprint } from "@/lib/exam-import/hash";

const STORAGE_KEY = "estufoo.exam-imports";

function loadAll(): ExamImportBatch[] {
  if (typeof window === "undefined") return memoryFallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExamImportBatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Fallback em memória para SSR / testes Node. */
let memoryFallback: ExamImportBatch[] = [];

function saveAll(items: ExamImportBatch[]) {
  memoryFallback = items;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export const examImportStore = {
  list(): ExamImportBatch[] {
    return loadAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  get(id: string): ExamImportBatch | null {
    return loadAll().find((x) => x.id === id) ?? null;
  },

  upsert(batch: ExamImportBatch): ExamImportBatch {
    const all = loadAll();
    const i = all.findIndex((x) => x.id === batch.id);
    const next = { ...batch, updatedAt: new Date().toISOString() };
    if (i >= 0) all[i] = next;
    else all.unshift(next);
    saveAll(all);
    return next;
  },

  findByExamHash(sha256: string): ExamImportBatch | null {
    return loadAll().find((x) => x.examFile.sha256 === sha256) ?? null;
  },

  findByMetadata(meta: ExamImportBatch["metadata"]): ExamImportBatch | null {
    const fp = metadataFingerprint(meta);
    return (
      loadAll().find((x) => metadataFingerprint(x.metadata) === fp && x.status !== "failed") ?? null
    );
  },

  updateQuestion(
    batchId: string,
    questionId: string,
    patch: Partial<ExamImportDraftQuestion>,
  ): ExamImportBatch | null {
    const batch = examImportStore.get(batchId);
    if (!batch) return null;
    const questions = batch.questions.map((q) =>
      q.id === questionId ? { ...q, ...patch, id: q.id, number: patch.number ?? q.number } : q,
    );
    return examImportStore.upsert({ ...batch, questions });
  },

  /** Apenas testes. */
  _resetForTests() {
    memoryFallback = [];
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  },
};

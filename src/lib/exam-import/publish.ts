import type { ExamImportBatch, ExamImportDraftQuestion } from "@/types/exam-import";

/** Questões ainda não aprovadas não podem ir para o banco do aluno. */
export function canPublishQuestion(q: ExamImportDraftQuestion): { ok: true } | { ok: false; reason: string } {
  if (q.status !== "approved") {
    return { ok: false, reason: "Só questões com status aprovado (importada) podem ser publicadas." };
  }
  if (!q.statement.trim()) {
    return { ok: false, reason: "Enunciado obrigatório." };
  }
  if (q.alternatives.length < 2) {
    return { ok: false, reason: "São necessárias pelo menos 2 alternativas." };
  }
  if (!q.correctKey || !q.alternatives.some((a) => a.key === q.correctKey)) {
    return { ok: false, reason: "Gabarito ausente ou sem alternativa correspondente." };
  }
  if (!q.subject.trim()) {
    return { ok: false, reason: "Informe a matéria antes de publicar." };
  }
  return { ok: true };
}

export function studentVisibleQuestions(batch: ExamImportBatch): ExamImportDraftQuestion[] {
  return batch.questions.filter((q) => q.status === "approved" && q.publishedQuestionId);
}

export function assertDraftNotStudentVisible(q: ExamImportDraftQuestion): void {
  if (q.status === "draft" && q.publishedQuestionId) {
    throw new Error("Rascunho não pode ter publishedQuestionId.");
  }
  if (q.status === "rejected" && q.publishedQuestionId) {
    throw new Error("Questão rejeitada não pode estar publicada.");
  }
}

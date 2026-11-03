import type { DiagnosticAnalysis, DiagnosticItemResult } from "@/lib/study-plan-diagnostic";
import type { Question } from "@/types";

export type DiagnosticRun = {
  id: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  provaId: number | null;
  provaTitle: string | null;
  questionIds: string[];
  /** Índice da questão atual (0-based) — progresso da navegação. */
  currentIndex: number;
  /** Alternativa marcada ainda sem confirmar, por questionId. */
  drafts: Record<string, string>;
  /** Snapshot mínimo para a prova em andamento. */
  questions: Question[];
  answers: DiagnosticItemResult[];
  analysis: DiagnosticAnalysis | null;
  scheduledFocusKeys: string[];
};

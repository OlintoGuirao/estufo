/** Tipos do fluxo de importação manual de provas (PDF). */

/** pendente → draft | revisada → reviewed | importada → approved */
export type ExamImportItemStatus = "draft" | "reviewed" | "approved" | "rejected";

export type ExamImportQuestionKind = "multiple_choice" | "true_false";

export type ExamImportBatchStatus =
  | "uploaded"
  | "extracted"
  | "needs_review"
  | "partially_published"
  | "failed";

export type ExamImportAlertCode =
  | "missing_alternative"
  | "duplicate_number"
  | "answer_unmatched"
  | "low_confidence"
  | "needs_ocr"
  | "empty_statement"
  | "few_alternatives"
  | "possible_duplicate"
  | "uncertain_field";

export type ExamImportAlert = {
  code: ExamImportAlertCode;
  message: string;
  questionNumber?: number | null;
};

export type ExamImportFigureRef = {
  page: number;
  label: string;
  note?: string;
};

export type ExamImportDraftQuestion = {
  id: string;
  number: number;
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string | null;
  subject: string;
  topic: string;
  status: ExamImportItemStatus;
  kind: ExamImportQuestionKind;
  pageStart: number | null;
  pageEnd: number | null;
  confidence: number;
  alerts: ExamImportAlert[];
  figureRefs: ExamImportFigureRef[];
  /** Explicações oficiais nunca são inventadas; campo reservado / futuro IA. */
  explanation: string;
  explanationSource: "none" | "official" | "ai";
  publishedQuestionId: string | null;
  /** Nome do PDF de origem (quando em fila multi-arquivo). */
  sourceFileName: string;
  /** IDs de questões já publicadas com enunciado semelhante — nunca sobrescreve. */
  possibleDuplicateIds: string[];
};

export type ExamImportMetadata = {
  board: string;
  organ: string;
  role: string;
  year: number;
  examName: string;
  bookletType: string;
  sourceUrl: string;
  /** Matéria sugerida no upload (cadastrável; editável na revisão). */
  defaultSubject?: string;
  /** Assunto sugerido no upload. */
  defaultTopic?: string;
};

export type ExamImportPage = {
  page: number;
  text: string;
  charCount: number;
};

export type ExamImportFileMeta = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Caminho privado no servidor (nunca público). */
  storageKey: string | null;
};

export type ExamImportBatch = {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  status: ExamImportBatchStatus;
  authorizationConfirmed: boolean;
  metadata: ExamImportMetadata;
  examFile: ExamImportFileMeta;
  answerKeyFile: ExamImportFileMeta | null;
  pages: ExamImportPage[];
  answerKeyPages: ExamImportPage[];
  questions: ExamImportDraftQuestion[];
  alerts: ExamImportAlert[];
  textExtractable: boolean;
  needsOcr: boolean;
  error: string | null;
  persistence: "mock-local";
};

export type ExamImportSubmitInput = {
  examPdfBase64: string;
  examFileName: string;
  examMimeType: string;
  answerKeyPdfBase64?: string | null;
  answerKeyFileName?: string | null;
  answerKeyMimeType?: string | null;
  metadata: ExamImportMetadata;
  authorizationConfirmed: boolean;
  /** E-mail do usuário logado (autorização server-side). */
  actorEmail: string;
};

export type ExamImportCanAccess = {
  allowed: boolean;
  reason: string;
  mode: "allowlist" | "local-open";
};

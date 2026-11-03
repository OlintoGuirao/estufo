import { request, qs } from "./api";
import type {
  ErrorNote,
  ErrorReasonCode,
  MindLink,
  MindMap,
  MindMapSummary,
  MindNode,
  MockExam,
  MockExamResult,
  Question,
  Review,
  StudySession,
} from "@/types";

export { authService } from "./auth.service";

export { contestsService } from "./contests.service";
export { questionsService } from "./questions.service";

export { providerQuestionsService } from "./provider-questions.service";
export { examImportService } from "./exam-import.service";
export { supabaseService } from "./supabase.service";
export { tutorService } from "./tutor.service";

export const studyPlansService = {
  sessions: (f: { from: string; to: string }) => request<StudySession[]>("GET", `/study-plan/sessions${qs(f)}`),
  create: (d: Omit<StudySession, "id">) => request<StudySession>("POST", "/study-plan/sessions", d),
  update: (id: string, d: Partial<StudySession>) => request<StudySession>("PATCH", `/study-plan/sessions/${id}`, d),
  remove: (id: string) => request<void>("DELETE", `/study-plan/sessions/${id}`),
  reschedule: (id: string, d: { date: string }) => request<StudySession>("POST", `/study-plan/sessions/${id}/reschedule`, d),
  split: (id: string, d: { parts: number; dates?: string[] }) =>
    request<{ original: StudySession; sessions: StudySession[] }>("POST", `/study-plan/sessions/${id}/split`, d),
};

export const errorNotesService = {
  list: (f?: { subject?: string; topic?: string; origin?: string }) =>
    request<ErrorNote[]>("GET", `/error-notes${qs(f ?? {})}`),
  save: (d: {
    questionId: string;
    reasonCode: ErrorReasonCode;
    reasonCustom?: string;
    origin?: import("@/types").ErrorNoteOrigin;
    subject?: string;
    topic?: string;
    yourKey?: string;
    correctKey?: string;
    statement?: string;
    explanation?: string;
    sourceLabel?: string;
    /** Permite salvar enunciado/gabarito sem depender de db.questions. */
    snapshot?: boolean;
  }) => request<ErrorNote>("POST", "/error-notes", d),
  remove: (id: string) => request<void>("DELETE", `/error-notes/${id}`),
  scheduleReview: (id: string) =>
    request<{ note: ErrorNote; review: Review }>("POST", `/error-notes/${id}/schedule-review`),
};

export const examsService = {
  list: () => request<MockExam[]>("GET", "/mock-exams"),
  create: (d: Omit<MockExam, "id" | "createdAt" | "status" | "score">) => request<MockExam>("POST", "/mock-exams", d),
  get: (id: string) => request<MockExam & { questions: Question[] }>("GET", `/mock-exams/${id}`),
  submit: (id: string, d: { answers: Record<string, string>; timeUsedSec: number }) =>
    request<MockExamResult>("POST", `/mock-exams/${id}/submit`, d),
  result: (id: string) => request<MockExamResult>("GET", `/mock-exams/${id}/result`),
};

export type MindMapCreateInput = {
  title: string;
  subject: string;
  fromNotice?: boolean;
  ai?: boolean;
  mocked?: boolean;
  material?: string;
  summary?: string;
  warnings?: string[];
  flashcards?: import("@/types").Flashcard[];
  practiceQuestions?: import("@/types").MindPracticeQuestion[];
  /** Pacote completo (mapa estilo caderno + flashcards). */
  studyPack?: {
    centralTitle: string;
    nodes: {
      tempId: string;
      title: string;
      kind: import("@/types").MindNodeKind;
      summary: string;
      keywords: string[];
      parentTempId: string | null;
    }[];
    links: { sourceTempId: string; targetTempId: string; label?: string }[];
  };
  /** Tópicos gerados pela IA (quando ai=true, legado). */
  outline?: {
    title: string;
    summary: string;
    children?: { title: string; summary: string }[];
  }[];
};

export const mindMapsService = {
  list: () => request<MindMapSummary[]>("GET", "/mind-maps"),
  create: (d: MindMapCreateInput) => request<MindMap>("POST", "/mind-maps", d),
  get: (id: string) => request<MindMap>("GET", `/mind-maps/${id}`),
  update: (id: string, d: Partial<MindMap>) => request<MindMap>("PATCH", `/mind-maps/${id}`, d),
  remove: (id: string) => request<void>("DELETE", `/mind-maps/${id}`),
  addNode: (id: string, n: MindNode) => request<MindNode>("POST", `/mind-maps/${id}/nodes`, n),
  updateNode: (id: string, nodeId: string, d: Partial<MindNode>) =>
    request<MindNode>("PATCH", `/mind-maps/${id}/nodes/${nodeId}`, d),
  removeNode: (id: string, nodeId: string) => request<void>("DELETE", `/mind-maps/${id}/nodes/${nodeId}`),
  addLink: (id: string, l: MindLink) => request<MindLink>("POST", `/mind-maps/${id}/links`, l),
  removeLink: (id: string, linkId: string) => request<void>("DELETE", `/mind-maps/${id}/links/${linkId}`),
};

export const reviewsService = {
  list: () => request<Review[]>("GET", "/reviews"),
  create: (d: { subject: string; topic: string; dueDate?: string; mastery?: Review["mastery"] }) =>
    request<Review>("POST", "/reviews", d),
  complete: (id: string, d: { confidence: number }) => request<Review>("POST", `/reviews/${id}/complete`, d),
};

export { dashboardService } from "./dashboard.service";

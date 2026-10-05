import { request, qs, upload } from "./api";
import type {
  AnswerResult,
  AuthResponse,
  Contest,
  DashboardData,
  MindLink,
  MindMap,
  MindMapSummary,
  MindNode,
  MockExam,
  MockExamResult,
  Notification,
  OnboardingInput,
  Paginated,
  PerformanceData,
  Question,
  QuestionFilters,
  Review,
  StudySession,
  User,
} from "@/types";

export const authService = {
  login: (d: { email: string; password: string }) => request<AuthResponse>("POST", "/auth/login", d),
  register: (d: { name: string; email: string; password: string }) => request<AuthResponse>("POST", "/auth/register", d),
  forgotPassword: (d: { email: string }) => request<{ ok: true }>("POST", "/auth/forgot-password", d),
  me: () => request<User>("GET", "/auth/me"),
  onboarding: (d: OnboardingInput) => request<User>("POST", "/onboarding", d),
  updateProfile: (d: Partial<User>) => request<User>("PATCH", "/auth/me", d),
};

export const contestsService = {
  list: (f: { search?: string; board?: string; status?: string }) => request<Contest[]>("GET", `/contests${qs(f)}`),
  get: (id: string) => request<Contest>("GET", `/contests/${id}`),
  setActive: (id: string) => request<User>("POST", `/contests/${id}/activate`),
  importNotice: (file: File, onProgress: (p: number) => void) => upload<Contest>("/contests/import", file, onProgress),
};

export const questionsService = {
  list: (f: QuestionFilters) => request<Paginated<Question>>("GET", `/questions${qs(f)}`),
  get: (id: string) => request<Question>("GET", `/questions/${id}`),
  answer: (id: string, d: { choice: string; timeSec: number }) => request<AnswerResult>("POST", `/questions/${id}/answers`, d),
  favorite: (id: string) => request<Question>("POST", `/questions/${id}/favorite`),
  review: (id: string) => request<Question>("POST", `/questions/${id}/review`),
};

export const studyPlansService = {
  sessions: (f: { from: string; to: string }) => request<StudySession[]>("GET", `/study-plan/sessions${qs(f)}`),
  create: (d: Omit<StudySession, "id">) => request<StudySession>("POST", "/study-plan/sessions", d),
  update: (id: string, d: Partial<StudySession>) => request<StudySession>("PATCH", `/study-plan/sessions/${id}`, d),
  remove: (id: string) => request<void>("DELETE", `/study-plan/sessions/${id}`),
};

export const examsService = {
  list: () => request<MockExam[]>("GET", "/mock-exams"),
  create: (d: Omit<MockExam, "id" | "createdAt" | "status" | "score">) => request<MockExam>("POST", "/mock-exams", d),
  get: (id: string) => request<MockExam & { questions: Question[] }>("GET", `/mock-exams/${id}`),
  submit: (id: string, d: { answers: Record<string, string>; timeUsedSec: number }) =>
    request<MockExamResult>("POST", `/mock-exams/${id}/submit`, d),
  result: (id: string) => request<MockExamResult>("GET", `/mock-exams/${id}/result`),
};

export const mindMapsService = {
  list: () => request<MindMapSummary[]>("GET", "/mind-maps"),
  create: (d: { title: string; subject: string; fromNotice?: boolean; ai?: boolean }) => request<MindMap>("POST", "/mind-maps", d),
  get: (id: string) => request<MindMap>("GET", `/mind-maps/${id}`),
  update: (id: string, d: Partial<MindMap>) => request<MindMap>("PATCH", `/mind-maps/${id}`, d),
  remove: (id: string) => request<void>("DELETE", `/mind-maps/${id}`),
  addNode: (id: string, n: MindNode) => request<MindNode>("POST", `/mind-maps/${id}/nodes`, n),
  updateNode: (id: string, nodeId: string, d: Partial<MindNode>) => request<MindNode>("PATCH", `/mind-maps/${id}/nodes/${nodeId}`, d),
  removeNode: (id: string, nodeId: string) => request<void>("DELETE", `/mind-maps/${id}/nodes/${nodeId}`),
  addLink: (id: string, l: MindLink) => request<MindLink>("POST", `/mind-maps/${id}/links`, l),
  removeLink: (id: string, linkId: string) => request<void>("DELETE", `/mind-maps/${id}/links/${linkId}`),
};

export const reviewsService = {
  list: () => request<Review[]>("GET", "/reviews"),
  complete: (id: string, d: { confidence: number }) => request<Review>("POST", `/reviews/${id}/complete`, d),
};

export const dashboardService = {
  get: () => request<DashboardData>("GET", "/dashboard"),
  performance: (period: "semanal" | "mensal") => request<PerformanceData>("GET", `/performance${qs({ period })}`),
  notifications: () => request<Notification[]>("GET", "/notifications"),
  readNotification: (id: string) => request<Notification>("POST", `/notifications/${id}/read`),
};

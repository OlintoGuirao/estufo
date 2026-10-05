export type User = {
  id: string;
  name: string;
  email: string;
  onboarded: boolean;
  activeContestId?: string | null;
};

export type AuthResponse = { token: string; user: User };

export type Subject = { id: string; name: string; topics: { id: string; name: string }[] };

export type ContestStatus = "aberto" | "previsto" | "encerrado";

export type Contest = {
  id: string;
  name: string;
  organ: string;
  role: string;
  board: string;
  status: ContestStatus;
  examDate: string;
  vacancies: number;
  salary: number;
  subjects: Subject[];
};

export type OnboardingInput = {
  contestId: string;
  role: string;
  board: string;
  examDate: string;
  hoursPerDay: number;
  weekDays: number[];
  level: "iniciante" | "intermediario" | "avancado";
  prioritySubjects: string[];
};

export type Difficulty = "facil" | "media" | "dificil";

export type Question = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  board: string;
  year: number;
  contest: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  source: string;
  favorite: boolean;
  markedForReview: boolean;
  answered?: { choice: string; correct: boolean } | null;
};

export type AnswerResult = { correct: boolean; correctKey: string; explanation: string };

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export type QuestionFilters = {
  contest?: string;
  board?: string;
  subject?: string;
  year?: string;
  difficulty?: string;
  status?: "todas" | "respondidas" | "nao-respondidas" | "erradas" | "favoritas";
  page?: number;
};

export type SessionStatus = "planejada" | "concluida" | "atrasada";
export type ActivityType = "teoria" | "questoes" | "revisao" | "simulado";

export type StudySession = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  subject: string;
  topic: string;
  activity: ActivityType;
  durationMin: number;
  priority: "alta" | "media" | "baixa";
  status: SessionStatus;
};

export type MockExam = {
  id: string;
  title: string;
  contestId: string;
  subjects: string[];
  questionCount: number;
  timeLimitMin: number;
  correctionMode: "ao-final" | "imediata";
  createdAt: string;
  status: "pendente" | "concluido";
  score?: number;
};

export type MockExamResult = {
  examId: string;
  score: number;
  correctPct: number;
  timeUsedSec: number;
  bySubject: { subject: string; pct: number }[];
  byTopic: { topic: string; pct: number }[];
  wrong: { id: string; statement: string; yourKey: string; correctKey: string }[];
  recommendations: string[];
};

export type Mastery = "nao-estudado" | "baixo" | "intermediario" | "bom" | "revisado";

export type MindNodeData = {
  title: string;
  description?: string;
  summary?: string;
  tags?: string[];
  relatedQuestions?: string[];
  lastReview?: string | null;
  mastery: Mastery;
  notes?: string;
  collapsed?: boolean;
  root?: boolean;
};

export type MindNode = { id: string; position: { x: number; y: number }; data: MindNodeData };
export type MindLink = { id: string; source: string; target: string };

export type MindMapSummary = { id: string; title: string; subject: string; updatedAt: string; nodeCount: number };
export type MindMap = MindMapSummary & { nodes: MindNode[]; links: MindLink[] };

export type Review = {
  id: string;
  subject: string;
  topic: string;
  dueDate: string;
  mastery: Mastery;
  lastConfidence?: number | null;
};

export type DashboardData = {
  contest: { name: string; examDate: string } | null;
  progress: number;
  weekHours: number;
  answered: number;
  accuracy: number;
  streak: number;
  upcomingReviews: Review[];
  weakest: { subject: string; pct: number }[];
  strongest: { subject: string; pct: number }[];
  today: StudySession[];
  weekly: { day: string; horas: number; acertos: number }[];
  distribution: { name: string; value: number }[];
};

export type PerformanceData = {
  accuracyEvolution: { label: string; acertos: number }[];
  bySubject: { subject: string; pct: number; answered: number }[];
  byTopic: { topic: string; subject: string; pct: number }[];
  avgTimeSec: number;
  answered: number;
  reviewRate: number;
  hours: number;
  monthly: { label: string; horas: number; questoes: number }[];
};

export type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string };

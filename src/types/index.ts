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

export type ErrorReasonCode = "nao-sabia" | "confundi" | "desatencao" | "falta-tempo" | "outro";

/** Origem do erro no caderno (liga Quest, plano, simulado, etc.). */
export type ErrorNoteOrigin =
  | "local"
  | "provider"
  | "simulado"
  | "quest"
  | "plano"
  | "diagnostico"
  | "revisao"
  | "video-aula";

/** Erro salvo no caderno (localStorage + sync Supabase `user_error_notes`). */
export type ErrorNote = {
  id: string;
  questionId: string;
  subject: string;
  topic: string;
  /** Vazio quando a origem é provedor (não persistimos enunciado da API). */
  statement: string;
  yourKey: string;
  correctKey: string;
  /** Vazio quando a origem é provedor. */
  explanation: string;
  reasonCode: ErrorReasonCode;
  reasonCustom?: string | null;
  createdAt: string;
  reviewId?: string | null;
  origin?: ErrorNoteOrigin;
  externalId?: string | null;
  /** Rótulo amigável da fonte (ex.: "Simulado geral", "Quest · Desafio"). */
  sourceLabel?: string | null;
};

export type StudyRecommendation = {
  title: string;
  reason: string;
  actionLabel: string;
  href: string;
  kind: "review" | "errors" | "questions" | "contest" | "plan";
  meta?: { subject?: string; topic?: string; reviewId?: string };
};

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

export type SessionHistoryEntry = {
  at: string;
  action: "created" | "completed" | "rescheduled" | "split" | "status";
  detail?: string;
};

export type StudySession = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  subject: string;
  topic: string;
  activity: ActivityType;
  durationMin: number;
  priority: "alta" | "media" | "baixa";
  status: SessionStatus;
  /** Sessão original quando esta veio de uma divisão. */
  parentId?: string | null;
  history?: SessionHistoryEntry[];
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
  /** IDs do banco de provas (TJSP 400) — simulado não usa IA. */
  questionIds?: string[];
  /** Origem das questões. */
  questionSource?: "tjsp-banco" | "mock";
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

/** Formas do mapa no estilo caderno de estudos. */
export type MindNodeKind = "hub" | "artigo" | "conceito" | "explicacao" | "topico";

export type MindNodeData = {
  title: string;
  description?: string;
  summary?: string;
  keywords?: string[];
  kind?: MindNodeKind;
  tags?: string[];
  relatedQuestions?: string[];
  lastReview?: string | null;
  mastery: Mastery;
  notes?: string;
  collapsed?: boolean;
  root?: boolean;
};

export type MindNode = { id: string; position: { x: number; y: number }; data: MindNodeData };
export type MindLink = {
  id: string;
  source: string;
  target: string;
  /** Rótulo da relação (ex.: “autoriza”, “prazo em dobro”). */
  label?: string;
};

export type FlashcardStatus = "novo" | "lembrei" | "revisar";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  topic: string;
  tags: string[];
  /** Nó do mapa de origem (opcional). */
  nodeId?: string | null;
  status: FlashcardStatus;
};

export type MindMapSummary = {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
  nodeCount: number;
  flashcardCount?: number;
};

/** Questão objetiva de treino ligada a um mapa (gerada por IA). */
export type MindPracticeQuestion = {
  id: string;
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  topic: string;
  nodeId?: string | null;
};

export type MindMap = MindMapSummary & {
  nodes: MindNode[];
  links: MindLink[];
  /** Material de origem (texto colado / PDF). */
  material?: string;
  /** Resumo estruturado gerado pela IA. */
  summary?: string;
  flashcards?: Flashcard[];
  /** Questões objetivas geradas pela IA a partir do material. */
  practiceQuestions?: MindPracticeQuestion[];
  warnings?: string[];
  aiGenerated?: boolean;
  mocked?: boolean;
};

export type Review = {
  id: string;
  subject: string;
  topic: string;
  dueDate: string;
  mastery: Mastery;
  lastConfidence?: number | null;
  /** Último intervalo aplicado (dias) — regra fixa SRS. */
  lastIntervalDays?: number | null;
  /** Explicação textual do agendamento. */
  scheduleNote?: string | null;
  confidenceHistory?: number[];
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
  /** Próxima ação sugerida por regras fixas (pode ser null se faltar dado). */
  recommendation: StudyRecommendation | null;
  /** Aviso de que parte dos dados ainda vem do mock local. */
  dataNote?: string;
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
  /** Erros por fonte (Quest, simulado, plano…). */
  wrongsBySource?: { source: string; count: number }[];
  /** Total de erros no caderno. */
  errorNotesCount?: number;
  /** Tentativas no TJSP Quest. */
  questAttempts?: number;
  questAccuracy?: number;
  dataNote?: string;
};

export type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string };

/**
 * Tipos TypeScript espelhando o schema SQL — NÃO executar no banco.
 * SQL real: db/migrations/001_init.sql + db/seed.sql
 */

export type ContestStatus = "aberto" | "previsto" | "encerrado";
export type Difficulty = "facil" | "media" | "dificil";
export type StudyLevel = "iniciante" | "intermediario" | "avancado";
export type SessionStatus = "planejada" | "concluida" | "atrasada";
export type ActivityType = "teoria" | "questoes" | "revisao" | "simulado";
export type PriorityLevel = "alta" | "media" | "baixa";
export type Mastery = "nao-estudado" | "baixo" | "intermediario" | "bom" | "revisado";
export type ExamStatus = "pendente" | "concluido";
export type CorrectionMode = "ao-final" | "imediata";
export type AnswerSource = "practice" | "exam" | "review";
export type ImportStatus = "pending" | "processing" | "done" | "failed";

export type DbUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  onboarded: boolean;
  active_contest_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DbContest = {
  id: string;
  name: string;
  organ: string;
  role: string;
  board: string;
  status: ContestStatus;
  exam_date: string | null;
  vacancies: number;
  salary: number;
  source_file: string | null;
  created_at: string;
  updated_at: string;
};

export type DbSubject = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type DbTopic = {
  id: string;
  subject_id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type DbUserStudyProfile = {
  user_id: string;
  contest_id: string;
  role: string;
  board: string;
  exam_date: string | null;
  hours_per_day: number;
  week_days: number[];
  level: StudyLevel;
  updated_at: string;
};

export type DbQuestion = {
  id: string;
  statement: string;
  board: string;
  year: number;
  contest_id: string | null;
  contest_label: string | null;
  subject_id: string;
  topic_id: string;
  difficulty: Difficulty;
  source: string;
  correct_key: string;
  explanation: string;
  created_at: string;
  updated_at: string;
};

export type DbQuestionAlternative = {
  id: string;
  question_id: string;
  key: string;
  text: string;
};

export type DbQuestionUserState = {
  user_id: string;
  question_id: string;
  favorite: boolean;
  marked_for_review: boolean;
  last_choice: string | null;
  last_correct: boolean | null;
  last_answered_at: string | null;
  last_time_sec: number | null;
  updated_at: string;
};

export type DbQuestionAnswer = {
  id: string;
  user_id: string;
  question_id: string;
  choice: string;
  correct: boolean;
  time_sec: number | null;
  source: AnswerSource;
  created_at: string;
};

export type DbStudySession = {
  id: string;
  user_id: string;
  contest_id: string | null;
  date: string;
  subject_id: string | null;
  topic_id: string | null;
  subject_name: string;
  topic_name: string;
  activity: ActivityType;
  duration_min: number;
  priority: PriorityLevel;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

export type DbMockExam = {
  id: string;
  user_id: string;
  contest_id: string;
  title: string;
  question_count: number;
  time_limit_min: number;
  correction_mode: CorrectionMode;
  status: ExamStatus;
  score: number | null;
  created_at: string;
  updated_at: string;
};

export type DbMockExamResult = {
  mock_exam_id: string;
  score: number;
  correct_pct: number;
  time_used_sec: number;
  by_subject: { subject: string; pct: number }[];
  by_topic: { topic: string; pct: number }[];
  recommendations: string[];
  created_at: string;
};

export type DbMindMap = {
  id: string;
  user_id: string;
  title: string;
  subject_id: string | null;
  subject_name: string;
  created_at: string;
  updated_at: string;
};

export type DbMindNode = {
  id: string;
  mind_map_id: string;
  pos_x: number;
  pos_y: number;
  title: string;
  description: string | null;
  summary: string | null;
  notes: string | null;
  tags: string[];
  mastery: Mastery;
  last_review: string | null;
  is_root: boolean;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
};

export type DbReview = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  subject_name: string;
  topic_name: string;
  due_date: string;
  mastery: Mastery;
  last_confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type DbNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

/** Intervalos SRS por confiança 1–5 (dias). */
export const SRS_INTERVALS_DAYS = [1, 1, 3, 7, 15] as const;

/** Schema futuro — ver db/migrations/002_exam_imports.sql */
export type ExamImportBatchStatusDb =
  | "uploaded"
  | "extracted"
  | "needs_review"
  | "partially_published"
  | "failed";

export type ExamImportItemStatusDb = "draft" | "approved" | "rejected";

export type DbExamImport = {
  id: string;
  created_by_user_id: string;
  status: ExamImportBatchStatusDb;
  authorization_confirmed: boolean;
  board: string;
  organ: string;
  role: string;
  year: number;
  exam_name: string;
  booklet_type: string;
  source_url: string;
  exam_file_name: string;
  exam_sha256: string;
  exam_storage_path: string | null;
  answer_sha256: string | null;
  text_extractable: boolean;
  needs_ocr: boolean;
  created_at: string;
  updated_at: string;
};

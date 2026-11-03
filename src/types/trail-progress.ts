/** Progresso do aluno na aula semanal da Trilha. */

export type TrailWeekStudyStatus = "pendente" | "em-andamento" | "concluida";

export type TrailPracticeAnswer = {
  choice: string;
  revealed: boolean;
};

export type TrailProfessorChatMessage = {
  role: "aluno" | "professor";
  text: string;
};

export type TrailWeekProgress = {
  trailId: string;
  week: number;
  status: TrailWeekStudyStatus;
  activeModuleId: string | null;
  /** Índice 1-based do módulo ativo (ex.: material 12). */
  activeModuleIndex?: number | null;
  completedModuleIds: string[];
  practiceAnswers: Record<string, TrailPracticeAnswer>;
  chat: TrailProfessorChatMessage[];
  /** Etapas ligadas a este dia (para rematch após remontar o cronograma). */
  topicIds?: string[];
  updatedAt: string;
};

/** Ponto de retomada na trilha. */
export type TrailResumePoint = {
  week: number;
  moduleId: string | null;
  moduleIndex: number | null;
  focus: string;
  dayLabel?: string;
  weekNumber?: number;
  status: TrailWeekStudyStatus;
};

import type { VideoQuizPayload, VideoQuizQuestion } from "@/lib/video-lessons/ai-quiz";

export type VideoLessonProgress = {
  lessonId: string;
  subjectId: string;
  /** Para o card "Continuar" no painel, sem refetch do catálogo. */
  subjectName?: string;
  lessonTitle?: string;
  lessonOrder?: number;
  currentTime: number;
  duration: number;
  /** true quando o aluno chegou perto do fim (≥95%) ou concluiu. */
  completed: boolean;
  updatedAt: string;
};

export type VideoLessonNote = {
  id: string;
  lessonId: string;
  subjectId: string;
  subjectName: string;
  lessonTitle: string;
  /** Obrigatório — ex.: "Português aula 1". */
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoLessonAnswer = {
  lessonId: string;
  questionId: string;
  choice: string;
  correct: boolean;
  tip?: string | null;
  at: string;
};

export type VideoLessonQuizCache = {
  lessonId: string;
  quiz: VideoQuizPayload;
  model: string;
  mocked: boolean;
  savedAt: string;
};

export type { VideoQuizPayload, VideoQuizQuestion };

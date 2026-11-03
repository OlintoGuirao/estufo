export type TutorDifficultyCode =
  "desconhecia" | "confundiu" | "enunciado" | "desatencao" | "falta-tempo" | "outro";

export const TUTOR_DIFFICULTY_OPTIONS: { code: TutorDifficultyCode; label: string }[] = [
  { code: "desconhecia", label: "Desconhecia o conteúdo" },
  { code: "confundiu", label: "Confundiu conceitos" },
  { code: "enunciado", label: "Não entendeu o enunciado" },
  { code: "desatencao", label: "Desatenção" },
  { code: "falta-tempo", label: "Falta de tempo" },
  { code: "outro", label: "Outra" },
];

export type TipRequestInput = {
  statement: string;
  alternatives: { key: string; text: string }[];
  /** Alternativa escolhida pelo aluno (errada). */
  studentChoice: string;
  subject?: string;
  topic?: string;
  tipLevel?: number;
  previousTips?: string[];
};

export type GeneratedPracticeQuestion = {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  subject: string;
  topic: string;
  aiGenerated: true;
  flagged?: boolean;
};

export type StudyAdviceItem = {
  title: string;
  reason: string;
  evidence: string[];
  provisional: boolean;
  kind: "review" | "errors" | "topic" | "plan";
  subject?: string;
  topic?: string;
};

export const MAX_PROMPT_CHARS = 6_000;

/** Redação — temas, agenda semanal, textos e correção com pontos a melhorar. */

/** 0 = domingo … 6 = sábado */
export type RedacaoWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RedacaoSchedule = {
  weekdays: RedacaoWeekday[];
  updatedAt: string;
};

export type RedacaoImprovementPoint = {
  id: string;
  area: string;
  tip: string;
  fromEssayId?: string;
  createdAt: string;
  status: "aberto" | "melhorou" | "resolvido";
};

export type RedacaoTheme = {
  id: string;
  title: string;
  prompt: string;
  context: string;
  genre: "dissertativa-argumentativa";
  likelihood: "alta" | "media";
  contestName?: string;
  board?: string;
  createdAt: string;
};

export type RedacaoCompetency = {
  name: string;
  score: number;
  max: number;
  feedback: string;
};

export type RedacaoCorrection = {
  score: number;
  maxScore: number;
  competencies: RedacaoCompetency[];
  strengths: string[];
  improvements: RedacaoImprovementPoint[];
  overallFeedback: string;
  correctedAt: string;
};

export type RedacaoEssayStatus = "rascunho" | "corrigida";

export type RedacaoEssay = {
  id: string;
  themeId: string;
  themeTitle: string;
  themePrompt: string;
  themeContext: string;
  body: string;
  status: RedacaoEssayStatus;
  focusPoints: RedacaoImprovementPoint[];
  correction?: RedacaoCorrection;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
};

export type RedacaoState = {
  schedule: RedacaoSchedule;
  themes: RedacaoTheme[];
  essays: RedacaoEssay[];
  openImprovements: RedacaoImprovementPoint[];
};

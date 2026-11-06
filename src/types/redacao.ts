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

/** Texto motivador no padrão VUNESP (TEXTO 1, 2, 3…). */
export type RedacaoSupportText = {
  /** Ex.: "TEXTO 1" */
  label: string;
  body: string;
  /** Citação no estilo da banca, ex.: (Autor. Título. site, data. Adaptado) */
  source: string;
};

export type RedacaoTheme = {
  id: string;
  /** Tema em destaque (pode ir em CAIXA ALTA na UI). */
  title: string;
  /**
   * Comando padrão da prova (após os textos).
   * Ex.: "Com base nos textos apresentados e em seus próprios conhecimentos…"
   */
  prompt: string;
  /** Resumo curto para o card da lista. */
  context: string;
  /** 2–3 textos motivadores como na prova VUNESP. */
  supportTexts?: RedacaoSupportText[];
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
  /** Cópia dos textos motivadores no momento em que o aluno começou a escrever. */
  supportTexts?: RedacaoSupportText[];
  body: string;
  status: RedacaoEssayStatus;
  focusPoints: RedacaoImprovementPoint[];
  correction?: RedacaoCorrection;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
};

/** Comando oficial estilo VUNESP (após os textos motivadores). */
export const VUNESP_REDACAO_COMMAND =
  "Com base nos textos apresentados e em seus próprios conhecimentos, escreva um texto dissertativo-argumentativo, empregando a norma-padrão da língua portuguesa, sobre o tema:";

export type RedacaoState = {
  schedule: RedacaoSchedule;
  themes: RedacaoTheme[];
  essays: RedacaoEssay[];
  openImprovements: RedacaoImprovementPoint[];
};

/** Plano gerado a partir do edital (Trilha da aprovação). */

export type TrailPhaseStatus = "pendente" | "em-andamento" | "concluida";

export type TrailTopic = {
  id: string;
  name: string;
  weightHint: "alta" | "media" | "baixa";
  notes: string;
  status: TrailPhaseStatus;
  /** Ex.: "293", "311-A" quando a etapa é um artigo. */
  articleRef?: string;
  kind?: "artigo" | "assunto" | "capitulo" | "bloco";
  /**
   * Material de estudo: o que o artigo/assunto significa (gerado pela IA).
   * Não é resumo do edital — é a explicação didática.
   */
  explanation?: string;
  /** Criado manualmente pelo aluno (+) — incluso no Gerar material. */
  custom?: boolean;
};

export type TrailSubject = {
  id: string;
  name: string;
  questionCountHint: number | null;
  topics: TrailTopic[];
  order: number;
};

export type TrailWeek = {
  /** Id sequencial da sessão (rota /trilha/semana/$week). */
  week: number;
  /** Número da semana no calendário de estudos (1, 2, 3…). */
  weekNumber?: number;
  /** Dia da semana JS (1=seg … 6=sáb), alinhado à agenda. */
  weekday?: number;
  /** Ex.: "Segunda". */
  dayLabel?: string;
  focus: string;
  subjectNames: string[];
  hoursSuggested: number;
  activities: string[];
  /** Etapas/tópicos desta sessão (normalmente 1 por dia). */
  topicIds?: string[];
};

export type ApprovalTrail = {
  id: string;
  createdAt: string;
  updatedAt: string;
  fileName: string;
  contestName: string;
  organ: string;
  role: string;
  board: string;
  examDate: string | null;
  summary: string;
  subjects: TrailSubject[];
  weeks: TrailWeek[];
  warnings: string[];
  /** Texto truncado usado na análise (auditoria local). */
  sourceTextChars: number;
  mocked: boolean;
  /** Preferências usadas ao montar o cronograma após Gerar material. */
  hoursPerWeek?: number;
  weeksTarget?: number;
  /** Liberado quando o aluno gera material — aí o cronograma aparece. */
  scheduleUnlocked?: boolean;
};

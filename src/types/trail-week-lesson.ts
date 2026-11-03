/** Aula modular gerada pelo Professor IA (Trilha da aprovação). */

export type TrailLessonPracticeQuestion = {
  id: string;
  statement: string;
  alternatives: { key: "A" | "B" | "C" | "D"; text: string }[];
  correctKey: "A" | "B" | "C" | "D";
  explanation: string;
  legalBasis: string;
};

/** Blocos didáticos — tudo gerado pela IA no papel de professor. */
export type ProfessorModuleKind =
  | "abertura"
  | "teoria"
  | "lei"
  | "memorizacao"
  | "material"
  | "pratica"
  | "fechamento";

export type ProfessorModule = {
  id: string;
  kind: ProfessorModuleKind;
  title: string;
  /** Fala do professor / conteúdo do módulo. */
  body: string;
  /** Tempo estimado deste módulo (minutos). Soma do dia ≈ 120. */
  minutesSuggested?: number;
  /** Definição objetiva do assunto (teoria/lei/memorização). */
  definition?: string;
  /** Macete de fixação. */
  mnemonic?: string;
  /** Exemplo de uso / aplicação. */
  example?: string;
  /** Assunto/etapa do edital ligado a este módulo. */
  topicLabel?: string;
  /**
   * Questões do módulo.
   * - teoria/lei/memorizacao: 5 de memorização do assunto
   * - pratica: ≥10 no dia (≥5 por assunto)
   */
  questions?: TrailLessonPracticeQuestion[];
};

export type TrailWeekLesson = {
  trailId: string;
  week: number;
  title: string;
  objective: string;
  /** Apresentação do professor (1º contato). */
  professorIntro: string;
  /** Percurso modular da aula (ordem importa). */
  modules: ProfessorModule[];
  warnings: string[];
  mocked: boolean;
  createdAt: string;

  /** @deprecated campos legados — preenchidos a partir dos módulos se a IA antiga responder */
  teachingSteps?: { title: string; body: string }[];
  lawMemory?: { title: string; tip: string; reference: string }[];
  materials?: { title: string; kind: string; detail: string }[];
  studyMethod?: string[];
  practiceQuestions?: TrailLessonPracticeQuestion[];
};

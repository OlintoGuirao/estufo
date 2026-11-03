/** Contrato interno do Estufoo — independente do fornecedor (seguro para o cliente). */

export type ProviderMatchQuality = "exact" | "partial" | "unknown";

export type ProviderQuestionFilters = {
  board?: string;
  institution?: string;
  role?: string;
  year?: number;
  subject?: string;
  topic?: string;
  /** Quando true, só questões com gabarito disponível no provedor. */
  requireAnswerKey?: boolean;
  page?: number;
  pageSize?: number;
};

export type ProviderAlternative = {
  key: string;
  /** HTML já sanitizado para exibição. */
  html: string;
};

export type ProviderImage = {
  url: string;
  alt: string;
};

/** DTO seguro para a UI (sem chave de API; conteúdo só em trânsito). */
export type ProviderQuestionDto = {
  /** ID externo do provedor (prefixado no app: `ext:{id}`). */
  id: string;
  externalId: string;
  statementHtml: string;
  supportHtml?: string;
  alternatives: ProviderAlternative[];
  images: ProviderImage[];
  board: string;
  year: number | null;
  institution: string;
  role: string;
  examName: string;
  subject: string;
  topic: string;
  difficulty: "facil" | "media" | "dificil" | null;
  source: string;
  annulled: boolean;
  hasAnswerKey: boolean;
  outdated: boolean;
  /** Estado do usuário (local) — não vem do provedor. */
  favorite: boolean;
  markedForReview: boolean;
  answered?: { choice: string; correct: boolean } | null;
};

export type ProviderListResult = {
  items: ProviderQuestionDto[];
  total: number;
  page: number;
  pageSize: number;
  matchQuality: ProviderMatchQuality;
  matchNote: string | null;
  providerConfigured: true;
  /** Nome lógico do adaptador (nunca a chave). */
  providerName: string;
};

export type ProviderStatus = {
  configured: boolean;
  providerName: string | null;
  cacheEnabled: boolean;
  targetPreset: {
    board: string;
    institution: string;
    role: string;
    label: string;
  };
};

export type ProviderCheckResult = {
  correct: boolean;
  correctKey: string | null;
  /** Explicação em trânsito; não persistir no cliente além da sessão de resposta. */
  explanationHtml: string | null;
  annulled: boolean;
  source: string;
};

/** Formato bruto esperado do HTTP licenciado (documentado em docs/question-provider.md). */
export type UpstreamQuestionRaw = {
  id: string;
  statement?: string;
  statementHtml?: string;
  supportText?: string;
  supportHtml?: string;
  alternatives?: { key: string; text?: string; html?: string }[];
  images?: { url: string; alt?: string }[];
  board?: string;
  year?: number | string | null;
  institution?: string;
  organ?: string;
  role?: string;
  position?: string;
  examName?: string;
  exam?: string;
  subject?: string;
  topic?: string;
  difficulty?: string | null;
  source?: string;
  attribution?: string;
  annulled?: boolean;
  hasAnswerKey?: boolean;
  outdated?: boolean;
};

export type UpstreamListResponse = {
  items?: UpstreamQuestionRaw[];
  total?: number;
  page?: number;
  pageSize?: number;
  matchQuality?: ProviderMatchQuality;
  matchNote?: string | null;
};

export interface QuestionProvider {
  readonly name: string;
  list(filters: ProviderQuestionFilters): Promise<{
    raw: UpstreamListResponse;
    matchQuality: ProviderMatchQuality;
    matchNote: string | null;
  }>;
  get(externalId: string): Promise<UpstreamQuestionRaw>;
  checkAnswer(
    externalId: string,
    choice: string,
  ): Promise<{
    correct: boolean;
    correctKey?: string | null;
    explanation?: string | null;
    explanationHtml?: string | null;
    annulled?: boolean;
    source?: string;
  }>;
}

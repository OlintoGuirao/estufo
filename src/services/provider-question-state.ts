/**
 * Persistência local só de desempenho / flags por ID externo.
 * Nunca armazena enunciado, alternativas, gabarito ou explicação do provedor.
 */

const KEY = "estufoo.provider-question-state";

export type ProviderQuestionUserState = {
  favorite: boolean;
  markedForReview: boolean;
  answered: { choice: string; correct: boolean; at: string } | null;
  /** Metadados leves para estatísticas — sem texto da questão. */
  meta?: {
    board?: string;
    year?: number | null;
    institution?: string;
    role?: string;
    examName?: string;
    subject?: string;
    topic?: string;
    source?: string;
  };
};

type Store = Record<string, ProviderQuestionUserState>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

export const providerQuestionState = {
  get(externalId: string): ProviderQuestionUserState {
    return read()[externalId] ?? { favorite: false, markedForReview: false, answered: null };
  },
  all(): Store {
    return read();
  },
  upsert(externalId: string, patch: Partial<ProviderQuestionUserState>) {
    const store = read();
    const prev = store[externalId] ?? { favorite: false, markedForReview: false, answered: null };
    const next: ProviderQuestionUserState = {
      favorite: patch.favorite ?? prev.favorite,
      markedForReview: patch.markedForReview ?? prev.markedForReview,
      answered: patch.answered !== undefined ? patch.answered : prev.answered,
    };
    if (patch.meta || prev.meta) {
      next.meta = { ...prev.meta, ...patch.meta };
    }
    store[externalId] = next;
    write(store);
    return next;
  },
  toggleFavorite(externalId: string) {
    const cur = this.get(externalId);
    return this.upsert(externalId, { favorite: !cur.favorite });
  },
  toggleReview(externalId: string) {
    const cur = this.get(externalId);
    return this.upsert(externalId, { markedForReview: !cur.markedForReview });
  },
};

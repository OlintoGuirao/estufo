/**
 * Estado (favorito / revisão / resposta) para questões do catálogo.
 * localStorage + sync Supabase (`user_question_local_state`) por device_id.
 */

import { studyUserDataDb, syncQuestionLocalState } from "@/services/study-user-data-db";

const KEY = "estufoo.local-question-state";

export type LocalQuestionUserState = {
  favorite: boolean;
  markedForReview: boolean;
  answered: { choice: string; correct: boolean } | null;
};

type Store = Record<string, LocalQuestionUserState>;

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
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    syncQuestionLocalState(store);
  } catch {
    /* ignore */
  }
}

let questionStateHydrated = false;

export const localQuestionState = {
  get(id: string): LocalQuestionUserState {
    return read()[id] ?? { favorite: false, markedForReview: false, answered: null };
  },
  upsert(id: string, patch: Partial<LocalQuestionUserState>) {
    const store = read();
    const prev = store[id] ?? { favorite: false, markedForReview: false, answered: null };
    const next: LocalQuestionUserState = {
      favorite: patch.favorite ?? prev.favorite,
      markedForReview: patch.markedForReview ?? prev.markedForReview,
      answered: patch.answered !== undefined ? patch.answered : prev.answered,
    };
    store[id] = next;
    write(store);
    return next;
  },
  toggleFavorite(id: string) {
    const cur = this.get(id);
    return this.upsert(id, { favorite: !cur.favorite });
  },
  toggleReview(id: string) {
    const cur = this.get(id);
    return this.upsert(id, { markedForReview: !cur.markedForReview });
  },

  async hydrate(): Promise<Store> {
    const local = read();
    if (questionStateHydrated) return local;
    questionStateHydrated = true;
    if (Object.keys(local).length) {
      syncQuestionLocalState(local);
      return local;
    }
    try {
      const remote = await studyUserDataDb.loadQuestionLocalState();
      if (remote && Object.keys(remote).length) {
        window.localStorage.setItem(KEY, JSON.stringify(remote));
        return remote;
      }
    } catch (err) {
      console.warn("[local-question-state] hydrate falhou", err);
    }
    return local;
  },
};

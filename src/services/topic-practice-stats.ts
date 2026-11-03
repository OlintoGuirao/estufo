/** Estatísticas de erro por matéria no Cronograma (prática das 20 questões). */

const KEY = "estufoo.topic-practice-stats";

export type TopicPracticeStats = {
  subject: string;
  answered: number;
  wrong: number;
  correct: number;
  /** % de erro acumulada (todas as práticas). */
  errorPct: number;
  updatedAt: string;
  /** Sessão atual das 20 questões. */
  sessionAnswered: number;
  sessionWrong: number;
  sessionErrorPct: number;
};

type Store = Record<string, TopicPracticeStats>;

function keyOf(subject: string) {
  return subject.trim().toLowerCase();
}

function pct(wrong: number, answered: number) {
  if (!answered) return 0;
  return Math.round((wrong / answered) * 100);
}

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export const topicPracticeStats = {
  get(subject: string): TopicPracticeStats | null {
    return read()[keyOf(subject)] ?? null;
  },

  /** Reinicia contadores da sessão de prática (as 20 questões). */
  startSession(subject: string) {
    const store = read();
    const k = keyOf(subject);
    const prev = store[k];
    store[k] = {
      subject,
      answered: prev?.answered ?? 0,
      wrong: prev?.wrong ?? 0,
      correct: prev?.correct ?? 0,
      errorPct: prev?.errorPct ?? 0,
      updatedAt: new Date().toISOString(),
      sessionAnswered: 0,
      sessionWrong: 0,
      sessionErrorPct: 0,
    };
    write(store);
    return store[k]!;
  },

  recordAnswer(subject: string, correct: boolean): TopicPracticeStats {
    const store = read();
    const k = keyOf(subject);
    const prev =
      store[k] ??
      ({
        subject,
        answered: 0,
        wrong: 0,
        correct: 0,
        errorPct: 0,
        updatedAt: new Date().toISOString(),
        sessionAnswered: 0,
        sessionWrong: 0,
        sessionErrorPct: 0,
      } satisfies TopicPracticeStats);

    const sessionAnswered = prev.sessionAnswered + 1;
    const sessionWrong = prev.sessionWrong + (correct ? 0 : 1);
    const answered = prev.answered + 1;
    const wrong = prev.wrong + (correct ? 0 : 1);
    const correctN = prev.correct + (correct ? 1 : 0);

    const next: TopicPracticeStats = {
      subject,
      answered,
      wrong,
      correct: correctN,
      errorPct: pct(wrong, answered),
      updatedAt: new Date().toISOString(),
      sessionAnswered,
      sessionWrong,
      sessionErrorPct: pct(sessionWrong, sessionAnswered),
    };
    store[k] = next;
    write(store);
    return next;
  },

  /**
   * % no card: sessão em andamento → prática da sessão;
   * senão prática acumulada; senão diagnóstico.
   */
  displayErrorPct(
    subject: string,
    diagnostic: { wrong: number; total: number },
  ): { errorPct: number; answered: number; wrong: number; source: "pratica" | "diagnostico" } {
    const s = this.get(subject);
    if (s && s.sessionAnswered > 0) {
      return {
        errorPct: s.sessionErrorPct,
        answered: s.sessionAnswered,
        wrong: s.sessionWrong,
        source: "pratica",
      };
    }
    if (s && s.answered > 0) {
      return {
        errorPct: s.errorPct,
        answered: s.answered,
        wrong: s.wrong,
        source: "pratica",
      };
    }
    return {
      errorPct: pct(diagnostic.wrong, diagnostic.total),
      answered: diagnostic.total,
      wrong: diagnostic.wrong,
      source: "diagnostico",
    };
  },
};

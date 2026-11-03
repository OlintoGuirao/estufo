import { studyPlansService } from "./study-plans.service";
import { tjspProvasCatalog } from "./tjsp-provas.catalog";
import { diagnosticDb, syncDiagnosticRun } from "./diagnostic-db";
import {
  analyzeDiagnostic,
  focusesToSchedule,
  addDaysIso,
} from "@/lib/study-plan-diagnostic";
import type { DiagnosticRun } from "@/types/diagnostic";
import type { Question } from "@/types";
import { ApiError } from "./api";

export type { DiagnosticRun } from "@/types/diagnostic";

const KEY = "estufoo.study-plan-diagnostic";

export type DiagnosticPhase = "idle" | "running" | "result";

type Store = {
  current: DiagnosticRun | null;
  history: DiagnosticRun[];
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeRun(run: DiagnosticRun | null): DiagnosticRun | null {
  if (!run) return null;
  const maxIdx = Math.max(0, (run.questions?.length ?? 1) - 1);
  const currentIndex = Math.min(Math.max(0, Number(run.currentIndex) || 0), maxIdx);
  return {
    ...run,
    updatedAt: run.updatedAt ?? run.startedAt ?? nowIso(),
    provaId: run.provaId ?? null,
    provaTitle: run.provaTitle ?? null,
    currentIndex,
    drafts: run.drafts && typeof run.drafts === "object" ? run.drafts : {},
    answers: Array.isArray(run.answers) ? run.answers : [],
    scheduledFocusKeys: run.scheduledFocusKeys ?? [],
  };
}

function read(): Store {
  if (typeof window === "undefined") return { current: null, history: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Store | null;
    if (!raw) return { current: null, history: [] };
    return {
      current: normalizeRun(raw.current ?? null),
      history: Array.isArray(raw.history)
        ? raw.history.map((h) => normalizeRun(h)!).filter(Boolean)
        : [],
    };
  } catch {
    return { current: null, history: [] };
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  if (store.current) syncDiagnosticRun(store.current);
}

function uid() {
  return `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const studyPlanDiagnosticService = {
  getCurrent(): DiagnosticRun | null {
    return read().current;
  },

  getLatestFinished(): DiagnosticRun | null {
    const cur = read().current;
    if (cur?.finishedAt) return cur;
    const h = read().history;
    return h[0] ?? null;
  },

  /**
   * Carrega prova em andamento (local → Supabase) e resultado recente.
   * Use no loader da página /questoes.
   */
  async hydrate(): Promise<DiagnosticRun | null> {
    const local = read();
    if (local.current && !local.current.finishedAt) {
      syncDiagnosticRun(local.current);
      return local.current;
    }
    if (local.current?.finishedAt) return local.current;

    try {
      const remoteRunning = await diagnosticDb.loadRunning();
      if (remoteRunning) {
        const store = read();
        store.current = normalizeRun(remoteRunning);
        write(store);
        return store.current;
      }
      const remoteFinished = await diagnosticDb.loadLatestFinished();
      if (remoteFinished) {
        const store = read();
        const finished = normalizeRun(remoteFinished)!;
        store.current = finished;
        store.history = [finished, ...store.history.filter((h) => h.id !== finished.id)].slice(0, 10);
        try {
          localStorage.setItem(KEY, JSON.stringify(store));
        } catch {
          /* ignore */
        }
        return finished;
      }
    } catch (err) {
      console.warn("[diagnostic] hydrate remoto falhou", err);
    }
    return local.current ?? local.history[0] ?? null;
  },

  /** Sorteia uma das 30 provas TJSP e inicia (22 questões + gabarito). */
  startRandomProva(): DiagnosticRun {
    const list = tjspProvasCatalog.listProvas();
    if (!list.length) throw new ApiError("Nenhuma prova TJSP disponível.", 400);
    const pick = list[Math.floor(Math.random() * list.length)]!;
    return this.startProva(pick.id);
  },

  /** Há prova em andamento (não finalizada)? */
  hasInProgress(): boolean {
    const cur = this.getCurrent();
    return !!cur && !cur.finishedAt;
  },

  /** Inicia uma prova TJSP específica (22 questões + gabarito). */
  startProva(provaId: number): DiagnosticRun {
    const prova = tjspProvasCatalog.getProva(provaId);
    const questions: Question[] = prova.questions.map((q) => ({
      ...q,
      answered: null,
      favorite: false,
      markedForReview: false,
    }));
    const started = nowIso();
    const run: DiagnosticRun = {
      id: uid(),
      startedAt: started,
      updatedAt: started,
      finishedAt: null,
      provaId: prova.id,
      provaTitle: prova.title,
      questionIds: questions.map((q) => q.id),
      currentIndex: 0,
      drafts: {},
      questions,
      answers: [],
      analysis: null,
      scheduledFocusKeys: [],
    };
    const store = read();
    store.current = run;
    write(store);
    return run;
  },

  async start(): Promise<DiagnosticRun> {
    return this.startRandomProva();
  },

  /** Salva a posição atual na prova. */
  setCurrentIndex(index: number): DiagnosticRun {
    const store = read();
    const run = store.current;
    if (!run || run.finishedAt) throw new ApiError("Nenhuma prova em andamento.", 400);
    const max = Math.max(0, run.questions.length - 1);
    const currentIndex = Math.min(Math.max(0, index), max);
    store.current = { ...run, currentIndex, updatedAt: nowIso() };
    write(store);
    return store.current;
  },

  /** Salva alternativa marcada (ainda sem confirmar). */
  setDraft(questionId: string, choice: string | null): DiagnosticRun {
    const store = read();
    const run = store.current;
    if (!run || run.finishedAt) throw new ApiError("Nenhuma prova em andamento.", 400);
    const drafts = { ...run.drafts };
    if (!choice) delete drafts[questionId];
    else drafts[questionId] = choice.toUpperCase();
    store.current = { ...run, drafts, updatedAt: nowIso() };
    write(store);
    return store.current;
  },

  answerCurrent(questionId: string, choice: string, correctKey: string, meta: { subject: string; topic: string }) {
    const store = read();
    const run = store.current;
    if (!run || run.finishedAt) throw new ApiError("Nenhuma prova em andamento.", 400);
    const correct = choice.toUpperCase() === correctKey.toUpperCase();
    const nextAnswers = run.answers.filter((a) => a.questionId !== questionId);
    nextAnswers.push({
      questionId,
      subject: meta.subject,
      topic: meta.topic,
      choice: choice.toUpperCase(),
      correctKey: correctKey.toUpperCase(),
      correct,
      answeredAt: nowIso(),
    });
    const questions = run.questions.map((q) =>
      q.id === questionId ? { ...q, answered: { choice: choice.toUpperCase(), correct } } : q,
    );
    const drafts = { ...run.drafts };
    delete drafts[questionId];
    const qIndex = run.questions.findIndex((q) => q.id === questionId);
    store.current = {
      ...run,
      answers: nextAnswers,
      questions,
      drafts,
      currentIndex: qIndex >= 0 ? qIndex : run.currentIndex,
      updatedAt: nowIso(),
    };
    write(store);
    return store.current;
  },

  finish(): DiagnosticRun {
    const store = read();
    const run = store.current;
    if (!run) throw new ApiError("Nenhuma prova em andamento.", 400);
    const analysis = analyzeDiagnostic(run.answers);
    const finished: DiagnosticRun = {
      ...run,
      finishedAt: nowIso(),
      updatedAt: nowIso(),
      analysis,
    };
    store.current = finished;
    store.history = [finished, ...store.history.filter((h) => h.id !== finished.id)].slice(0, 10);
    write(store);
    return finished;
  },

  clearCurrent() {
    const store = read();
    const prevId = store.current?.id;
    store.current = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
    if (prevId) {
      void diagnosticDb.deleteRun(prevId).catch((err) => {
        console.warn("[diagnostic] falha ao limpar remoto", err);
      });
    }
  },

  /** Cria sessões no cronograma (hoje + próximos dias). */
  async applyFocusToSchedule(run?: DiagnosticRun | null): Promise<{ created: number; focuses: ReturnType<typeof focusesToSchedule> }> {
    const target = run ?? read().current;
    if (!target?.analysis) throw new ApiError("Finalize a prova antes de gerar o plano.", 400);
    const focuses = focusesToSchedule(target.analysis);
    if (!focuses.length) {
      return { created: 0, focuses };
    }
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;
    const keys: string[] = [...target.scheduledFocusKeys];
    for (let i = 0; i < focuses.length; i++) {
      const f = focuses[i]!;
      const key = `${f.subject}::${f.topic}`;
      if (keys.includes(key)) continue;
      await studyPlansService.create({
        date: addDaysIso(today, i),
        subject: f.subject,
        topic: f.topic,
        activity: "questoes",
        durationMin: 45,
        priority: f.recurring ? "alta" : "media",
        status: "planejada",
      });
      keys.push(key);
      created += 1;
    }
    const store = read();
    if (store.current?.id === target.id) {
      store.current = { ...store.current, scheduledFocusKeys: keys };
    }
    store.history = store.history.map((h) =>
      h.id === target.id ? { ...h, scheduledFocusKeys: keys } : h,
    );
    write(store);
    return { created, focuses };
  },
};

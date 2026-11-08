import type { TrailWeekLesson } from "@/types/trail-week-lesson";
import { approvalTrailDb, syncTrailLesson, syncTrailLessonNow } from "./approval-trail-db";
import { idbKv } from "@/lib/idb-kv";

/** Chave antiga (localStorage) — migrada para o IndexedDB na primeira leitura. */
const LEGACY_KEY = "estufoo.trail-week-lessons.v2";
const IDB_KEY = "trail-week-lessons.v3";

type Bag = Record<string, TrailWeekLesson>;

function lessonKey(trailId: string, week: number): string {
  return `${trailId}::${week}`;
}

let memory: Bag = {};
let loaded: Promise<void> | null = null;

/**
 * O banco é a fonte da verdade. No aparelho fica só um CACHE pequeno:
 * as últimas aulas abertas que já estão salvas no banco. Aula ainda não
 * enviada nunca é descartada.
 */
const MAX_CACHED_LESSONS = 5;
const META_KEY = "trail-week-lessons.meta";
type Meta = Record<string, { usedAt: number; synced: boolean }>;
let meta: Meta = {};

function touch(key: string, synced?: boolean) {
  meta[key] = { usedAt: Date.now(), synced: synced ?? meta[key]?.synced ?? false };
}

/** Remove do aparelho as aulas antigas que já estão no banco. */
function prune() {
  const keys = Object.keys(memory);
  if (keys.length <= MAX_CACHED_LESSONS) return;
  const removable = keys
    .filter((k) => meta[k]?.synced)
    .sort((a, b) => (meta[a]?.usedAt ?? 0) - (meta[b]?.usedAt ?? 0));
  let excess = keys.length - MAX_CACHED_LESSONS;
  const next = { ...memory };
  for (const k of removable) {
    if (excess <= 0) break;
    delete next[k];
    delete meta[k];
    excess--;
  }
  memory = next;
}

function readLegacy(): Bag {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as Bag) : {};
  } catch {
    return {};
  }
}

/** Carrega IndexedDB (+ legado do localStorage) para a memória, uma vez. */
function ensureLoaded(): Promise<void> {
  if (loaded) return loaded;
  loaded = (async () => {
    const legacy = readLegacy();
    let fromIdb: Bag = {};
    if (idbKv.available()) {
      try {
        fromIdb = (await idbKv.get<Bag>(IDB_KEY)) ?? {};
        meta = (await idbKv.get<Meta>(META_KEY)) ?? {};
      } catch (err) {
        console.warn("[trail-week-lesson] IndexedDB indisponível — usando localStorage", err);
      }
    }
    memory = { ...legacy, ...fromIdb, ...memory };
    if (Object.keys(legacy).length && idbKv.available()) {
      try {
        await idbKv.set(IDB_KEY, memory);
        // Libera a cota do localStorage para o resto do app.
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* mantém o legado */
      }
    }
  })();
  return loaded;
}

if (typeof window !== "undefined") void ensureLoaded();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPromise: Promise<void> = Promise.resolve();

function persist(immediate = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const run = async () => {
    prune();
    if (idbKv.available()) {
      try {
        await idbKv.set(IDB_KEY, memory);
        await idbKv.set(META_KEY, meta);
        return;
      } catch (err) {
        console.warn("[trail-week-lesson] falha ao gravar no IndexedDB", err);
      }
    }
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(memory));
    } catch (err) {
      console.error(
        "[trail-week-lesson] sem espaço para guardar a aula no aparelho — ela fica só no banco",
        err,
      );
    }
  };
  if (persistTimer) clearTimeout(persistTimer);
  if (immediate) {
    persistPromise = persistPromise.then(run);
    return persistPromise;
  }
  persistTimer = setTimeout(() => {
    persistPromise = persistPromise.then(run);
  }, 150);
  return Promise.resolve();
}

export const trailWeekLessonStore = {
  /** Síncrono: devolve o que já está em memória (carregado do IndexedDB). */
  get(trailId: string, week: number): TrailWeekLesson | null {
    return memory[lessonKey(trailId, week)] ?? null;
  },
  listLocal(trailId: string): TrailWeekLesson[] {
    return Object.values(memory)
      .filter((l) => l.trailId === trailId)
      .sort((a, b) => a.week - b.week);
  },
  /** Marca como já salva no banco (pode sair do cache do aparelho). */
  markSynced(trailId: string, week: number): void {
    const key = lessonKey(trailId, week);
    if (!memory[key]) return;
    // Mantém a data de uso (não "rejuvenesce" aulas antigas).
    meta[key] = { usedAt: meta[key]?.usedAt ?? 0, synced: true };
    void persist();
  },
  /** Espera o IndexedDB carregar (use antes de decidir gerar uma aula nova). */
  ready(): Promise<void> {
    return ensureLoaded();
  },
  save(lesson: TrailWeekLesson): TrailWeekLesson {
    const key = lessonKey(lesson.trailId, lesson.week);
    memory = { ...memory, [key]: lesson };
    touch(key, false);
    void persist();
    syncTrailLesson(lesson);
    return lesson;
  },

  async saveNow(lesson: TrailWeekLesson): Promise<TrailWeekLesson> {
    await ensureLoaded();
    const key = lessonKey(lesson.trailId, lesson.week);
    memory = { ...memory, [key]: lesson };
    touch(key, false);
    try {
      await syncTrailLessonNow(lesson);
      touch(key, true);
      await persist(true);
    } catch (err) {
      await persist(true);
      console.error(
        "[trail-week-lesson] a aula NÃO foi salva no banco (fica só neste aparelho):",
        err,
      );
    }
    return lesson;
  },
  clearTrail(trailId: string): void {
    const next: Bag = {};
    for (const [k, v] of Object.entries(memory)) {
      if (!k.startsWith(`${trailId}::`)) next[k] = v;
    }
    memory = next;
    void persist(true);
    void approvalTrailDb.deleteLessonsForTrail(trailId).catch(() => {});
  },

  /**
   * Procura a aula salva: aparelho (IndexedDB) → banco. Só devolve null se
   * não existir em nenhum dos dois — aí sim o professor gera.
   */
  async hydrate(trailId: string, week: number): Promise<TrailWeekLesson | null> {
    await ensureLoaded();
    const key = lessonKey(trailId, week);
    const local = trailWeekLessonStore.get(trailId, week);
    if (local?.modules?.length) {
      touch(key);
      void persist();
      return local;
    }
    try {
      const remote = await approvalTrailDb.loadLesson(trailId, week);
      if (remote?.modules?.length) {
        memory = { ...memory, [key]: remote };
        touch(key, true);
        void persist();
        return remote;
      }
    } catch (err) {
      console.warn("[trail-week-lesson] hydrate falhou", err);
    }
    return local;
  },
};

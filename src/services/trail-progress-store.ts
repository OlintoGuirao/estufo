import type { TrailWeekProgress } from "@/types/trail-progress";
import { syncTrailProgress, approvalTrailDb } from "./approval-trail-db";

const KEY = "estufoo.trail-week-progress.v1";

type Bag = Record<string, TrailWeekProgress>;

function progressKey(trailId: string, week: number): string {
  return `${trailId}::${week}`;
}

let memory: Bag = {};

function read(): Bag {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory;
    return { ...memory, ...(JSON.parse(raw) as Bag) };
  } catch {
    return memory;
  }
}

function write(bag: Bag): void {
  memory = bag;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    /* quota */
  }
}

function empty(trailId: string, week: number): TrailWeekProgress {
  return {
    trailId,
    week,
    status: "pendente",
    activeModuleId: null,
    activeModuleIndex: null,
    completedModuleIds: [],
    practiceAnswers: {},
    chat: [],
    topicIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function topicSignature(ids: string[] | undefined): string {
  return (ids ?? []).slice().sort().join("|");
}

export const trailProgressStore = {
  get(trailId: string, week: number): TrailWeekProgress {
    return read()[progressKey(trailId, week)] ?? empty(trailId, week);
  },

  listLocal(trailId: string): TrailWeekProgress[] {
    const bag = read();
    return Object.values(bag)
      .filter((p) => p.trailId === trailId)
      .sort((a, b) => a.week - b.week);
  },

  save(progress: TrailWeekProgress): TrailWeekProgress {
    const next = { ...progress, updatedAt: new Date().toISOString() };
    const bag = read();
    bag[progressKey(next.trailId, next.week)] = next;
    write(bag);
    syncTrailProgress(next);
    return next;
  },

  clearTrail(trailId: string): void {
    const bag = read();
    for (const k of Object.keys(bag)) {
      if (k.startsWith(`${trailId}::`)) delete bag[k];
    }
    write(bag);
    void approvalTrailDb.deleteProgressForTrail(trailId).catch(() => {});
  },

  /**
   * Após remontar o cronograma, realinha progresso antigo pelas etapas (topicIds)
   * para os novos números de sessão — sem apagar o que o aluno já fez.
   */
  remapByTopics(
    trailId: string,
    sessions: Array<{ week: number; topicIds?: string[] }>,
  ): TrailWeekProgress[] {
    const bag = read();
    const previous = Object.values(bag).filter((p) => p.trailId === trailId);
    if (!previous.length) return [];

    const bySig = new Map<string, TrailWeekProgress>();
    const byTopic = new Map<string, TrailWeekProgress>();
    for (const p of previous) {
      const sig = topicSignature(p.topicIds);
      if (sig) bySig.set(sig, p);
      bySig.set(`week:${p.week}`, p);
      for (const tid of p.topicIds ?? []) {
        const cur = byTopic.get(tid);
        if (!cur || new Date(p.updatedAt) >= new Date(cur.updatedAt)) {
          byTopic.set(tid, p);
        }
      }
    }

    const nextBag: TrailWeekProgress[] = [];
    const keepKeys = new Set<string>();
    const usedProgress = new Set<string>();

    for (const s of sessions) {
      const sig = topicSignature(s.topicIds);
      let matched = sig ? bySig.get(sig) : undefined;
      if (!matched) {
        for (const tid of s.topicIds ?? []) {
          const hit = byTopic.get(tid);
          if (hit && !usedProgress.has(`${hit.trailId}::${hit.week}`)) {
            matched = hit;
            break;
          }
        }
      }
      if (!matched) matched = bySig.get(`week:${s.week}`);
      if (!matched) continue;
      usedProgress.add(`${matched.trailId}::${matched.week}`);
      const remapped: TrailWeekProgress = {
        ...matched,
        trailId,
        week: s.week,
        topicIds: s.topicIds ?? matched.topicIds ?? [],
        updatedAt: new Date().toISOString(),
      };
      const key = progressKey(trailId, s.week);
      bag[key] = remapped;
      keepKeys.add(key);
      nextBag.push(remapped);
      syncTrailProgress(remapped);
    }

    // Remove progresso órfão desta trilha (sessões que sumiram do cronograma).
    for (const k of Object.keys(bag)) {
      if (k.startsWith(`${trailId}::`) && !keepKeys.has(k)) {
        delete bag[k];
      }
    }
    write(bag);
    return nextBag;
  },

  async hydrate(trailId: string, week: number): Promise<TrailWeekProgress> {
    const local = trailProgressStore.get(trailId, week);
    const hasLocalWork =
      local.status !== "pendente" ||
      local.completedModuleIds.length > 0 ||
      local.chat.length > 0 ||
      Object.keys(local.practiceAnswers).length > 0;
    if (hasLocalWork) {
      syncTrailProgress(local);
      return local;
    }
    try {
      const remote = await approvalTrailDb.loadProgress(trailId, week);
      if (remote) {
        const bag = read();
        bag[progressKey(trailId, week)] = remote;
        write(bag);
        return remote;
      }
    } catch (err) {
      console.warn("[trail-progress] hydrate falhou", err);
    }
    return local;
  },

  async hydrateAll(trailId: string): Promise<TrailWeekProgress[]> {
    const local = trailProgressStore.listLocal(trailId);
    try {
      const remote = await approvalTrailDb.loadAllProgress(trailId);
      if (remote.length) {
        const bag = read();
        const byWeek = new Map<number, TrailWeekProgress>();
        for (const p of local) byWeek.set(p.week, p);
        for (const r of remote) {
          const cur = byWeek.get(r.week);
          if (!cur || new Date(r.updatedAt) > new Date(cur.updatedAt)) {
            byWeek.set(r.week, r);
          }
        }
        for (const p of byWeek.values()) {
          bag[progressKey(p.trailId, p.week)] = p;
        }
        write(bag);
        return [...byWeek.values()].sort((a, b) => a.week - b.week);
      }
    } catch (err) {
      console.warn("[trail-progress] hydrateAll falhou", err);
    }
    return local;
  },
};

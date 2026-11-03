import { trailProgressStore } from "./trail-progress-store";
import type {
  TrailPracticeAnswer,
  TrailProfessorChatMessage,
  TrailResumePoint,
  TrailWeekProgress,
  TrailWeekStudyStatus,
} from "@/types/trail-progress";

export const trailProgressService = {
  get(trailId: string, week: number): TrailWeekProgress {
    return trailProgressStore.get(trailId, week);
  },

  list(trailId: string): TrailWeekProgress[] {
    return trailProgressStore.listLocal(trailId);
  },

  async hydrate(trailId: string, week: number): Promise<TrailWeekProgress> {
    return trailProgressStore.hydrate(trailId, week);
  },

  async hydrateAll(trailId: string): Promise<TrailWeekProgress[]> {
    return trailProgressStore.hydrateAll(trailId);
  },

  bindTopics(trailId: string, week: number, topicIds: string[]): TrailWeekProgress {
    const cur = trailProgressStore.get(trailId, week);
    if (
      topicIds.length &&
      topicSignature(cur.topicIds) === topicSignature(topicIds)
    ) {
      return cur;
    }
    return trailProgressStore.save({ ...cur, topicIds });
  },

  setActiveModule(
    trailId: string,
    week: number,
    moduleId: string,
    moduleIndex?: number | null,
  ): TrailWeekProgress {
    const cur = trailProgressStore.get(trailId, week);
    const index =
      typeof moduleIndex === "number" && moduleIndex >= 1
        ? Math.floor(moduleIndex)
        : cur.activeModuleId === moduleId
          ? (cur.activeModuleIndex ?? null)
          : null;
    return trailProgressStore.save({
      ...cur,
      activeModuleId: moduleId,
      activeModuleIndex: index,
      status: cur.status === "pendente" ? "em-andamento" : cur.status,
    });
  },

  /**
   * Ponto para o card "Continuar de onde parei".
   * Prioriza dia em andamento mais recente; senão o primeiro dia ainda não concluído.
   */
  getResumePoint(
    trailId: string,
    weeks: Array<{
      week: number;
      focus: string;
      dayLabel?: string;
      weekNumber?: number;
    }>,
  ): TrailResumePoint | null {
    if (!weeks.length) return null;
    const list = trailProgressStore.listLocal(trailId);
    const byRecency = (a: TrailWeekProgress, b: TrailWeekProgress) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

    const inProgress = list.filter((p) => p.status === "em-andamento").sort(byRecency);
    const withModule = list
      .filter(
        (p) =>
          p.status !== "concluida" &&
          (!!p.activeModuleId || (p.activeModuleIndex ?? 0) >= 1),
      )
      .sort(byRecency);

    const picked = inProgress[0] ?? withModule[0];
    if (picked) {
      const meta = weeks.find((w) => w.week === picked.week);
      return {
        week: picked.week,
        moduleId: picked.activeModuleId,
        moduleIndex: picked.activeModuleIndex ?? null,
        focus: meta?.focus ?? `Dia ${picked.week}`,
        dayLabel: meta?.dayLabel,
        weekNumber: meta?.weekNumber,
        status: picked.status,
      };
    }

    const done = new Set(
      list.filter((p) => p.status === "concluida").map((p) => p.week),
    );
    const next = weeks.find((w) => !done.has(w.week));
    if (!next) return null;
    return {
      week: next.week,
      moduleId: null,
      moduleIndex: null,
      focus: next.focus,
      dayLabel: next.dayLabel,
      weekNumber: next.weekNumber,
      status: "pendente",
    };
  },

  markModuleDone(trailId: string, week: number, moduleId: string): TrailWeekProgress {
    const cur = trailProgressStore.get(trailId, week);
    const set = new Set(cur.completedModuleIds);
    set.add(moduleId);
    return trailProgressStore.save({
      ...cur,
      completedModuleIds: [...set],
      status: "em-andamento",
    });
  },

  setPracticeAnswer(
    trailId: string,
    week: number,
    questionId: string,
    answer: TrailPracticeAnswer,
  ): TrailWeekProgress {
    const cur = trailProgressStore.get(trailId, week);
    return trailProgressStore.save({
      ...cur,
      practiceAnswers: { ...cur.practiceAnswers, [questionId]: answer },
      status: cur.status === "pendente" ? "em-andamento" : cur.status,
    });
  },

  appendChat(
    trailId: string,
    week: number,
    messages: TrailProfessorChatMessage[],
  ): TrailWeekProgress {
    const cur = trailProgressStore.get(trailId, week);
    return trailProgressStore.save({
      ...cur,
      chat: [...cur.chat, ...messages].slice(-40),
      status: cur.status === "pendente" ? "em-andamento" : cur.status,
    });
  },

  setWeekStatus(
    trailId: string,
    week: number,
    status: TrailWeekStudyStatus,
  ): TrailWeekProgress {
    const cur = trailProgressStore.get(trailId, week);
    return trailProgressStore.save({ ...cur, status });
  },

  remapByTopics(
    trailId: string,
    sessions: Array<{ week: number; topicIds?: string[] }>,
  ): TrailWeekProgress[] {
    return trailProgressStore.remapByTopics(trailId, sessions);
  },

  clearTrail(trailId: string): void {
    trailProgressStore.clearTrail(trailId);
  },
};

function topicSignature(ids: string[] | undefined): string {
  return (ids ?? []).slice().sort().join("|");
}

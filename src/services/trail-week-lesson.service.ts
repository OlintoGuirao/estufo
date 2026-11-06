import { getStudentProfileText } from "./student-profile";
import { ApiError } from "./api";
import { askTrailProfessor, generateTrailWeekLesson } from "./trail-week-lesson.fns";
import { trailWeekLessonStore } from "./trail-week-lesson-store";
import { approvalTrailStore } from "./approval-trail-store";
import type { TrailWeekLesson } from "@/types/trail-week-lesson";
import type { ApprovalTrail } from "@/types/approval-trail";

function parseErr(e: unknown): never {
  if (e instanceof Error && e.message.startsWith("{")) {
    try {
      const payload = JSON.parse(e.message) as { message?: string; status?: number };
      throw new ApiError(payload.message ?? "Erro ao gerar aula.", payload.status ?? 500);
    } catch (inner) {
      if (inner instanceof ApiError) throw inner;
    }
  }
  throw e instanceof Error ? new ApiError(e.message, 500) : new ApiError("Erro ao gerar aula.", 500);
}

function relatedTopics(
  trail: ApprovalTrail,
  weekSubjects: string[],
  topicIds?: string[],
) {
  const idSet = topicIds?.length ? new Set(topicIds) : null;
  const want = new Set(weekSubjects.map((s) => s.toLowerCase()));
  const out: { subject: string; topic: string; notes: string; weightHint: string }[] = [];
  for (const s of trail.subjects) {
    for (const t of s.topics) {
      if (idSet) {
        if (!idSet.has(t.id)) continue;
      } else {
        const match =
          !want.size ||
          [...want].some(
            (w) => s.name.toLowerCase().includes(w) || w.includes(s.name.toLowerCase()),
          );
        if (!match && want.size) continue;
      }
      out.push({
        subject: s.name,
        topic: t.name,
        notes: [t.notes, t.explanation].filter(Boolean).join("\n\n"),
        weightHint: t.weightHint,
      });
    }
  }
  return out.slice(0, 60);
}

export const trailWeekLessonService = {
  getCached(trailId: string, week: number): TrailWeekLesson | null {
    return trailWeekLessonStore.get(trailId, week);
  },

  async ensureLesson(week: number, opts?: { force?: boolean }): Promise<TrailWeekLesson> {
    const trail = approvalTrailStore.get();
    if (!trail) throw new ApiError("Nenhuma trilha encontrada. Analise o edital primeiro.", 404);
    const w = trail.weeks.find((x) => x.week === week);
    if (!w) throw new ApiError(`Semana ${week} não existe nesta trilha.`, 404);

    if (!opts?.force) {
      const hydrated = await trailWeekLessonStore.hydrate(trail.id, week);
      // Aulas antigas sem modules[] precisam ser regeneradas (fluxo professor modular).
      if (hydrated?.modules?.length) return hydrated;
    }

    try {
      const lesson = await generateTrailWeekLesson({
        data: {
          trailId: trail.id,
          week: w.week,
          contestName: trail.contestName,
          board: trail.board,
          role: trail.role,
          weekFocus: w.focus,
          subjectNames: w.subjectNames,
          activities: w.activities,
          hoursSuggested: w.hoursSuggested,
          relatedTopics: relatedTopics(trail, w.subjectNames, w.topicIds),
        },
      });
      return trailWeekLessonStore.saveNow(lesson);
    } catch (e) {
      return parseErr(e);
    }
  },

  async askProfessor(input: {
    week: number;
    question: string;
    moduleTitle?: string;
    lessonContext?: string;
    history?: { role: "aluno" | "professor"; text: string }[];
  }): Promise<{ answer: string; mocked: boolean }> {
    const trail = approvalTrailStore.get();
    if (!trail) throw new ApiError("Nenhuma trilha encontrada.", 404);
    const w = trail.weeks.find((x) => x.week === input.week);
    if (!w) throw new ApiError(`Semana ${input.week} não encontrada.`, 404);
    try {
      return await askTrailProfessor({
        data: {
          week: w.week,
          weekFocus: w.focus,
          contestName: trail.contestName,
          board: trail.board,
          question: input.question,
          moduleTitle: input.moduleTitle ?? "",
          lessonContext: input.lessonContext ?? "",
          history: (input.history ?? []).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) })),
          studentProfile: await getStudentProfileText(),
        },
      });
    } catch (e) {
      return parseErr(e);
    }
  },
};

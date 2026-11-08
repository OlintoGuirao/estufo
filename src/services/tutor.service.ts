import {
  buildTutorRecommendations,
  generateFlashcardsFromNodes,
  generateMindMapOutline,
  explainMindNodeItems,
  generatePracticeQuestion,
  generateStudyPack,
  generateWeeklyReinforce,
  getTutorStatus,
  gradePracticeQuestion,
  requestTutorExplain,
  requestTutorMastigado,
  requestTutorTip,
} from "./tutor.fns";
import type { MindMapOutlineTopic } from "@/lib/tutor/mind-map";
import type { StudyPackAi } from "@/lib/tutor/study-pack";
import { ApiError } from "./api";
import type { TutorDifficultyCode } from "@/lib/tutor/types";
import { tutorDifficultyStore } from "./tutor-difficulty-store";
import { getStudentProfileText } from "./student-profile";

/** Anexa o perfil do aluno (erros/dificuldades) — o professor adapta a explicação. */
async function withProfile<T extends { subject?: string; studentProfile?: string }>(data: T): Promise<T> {
  if (data.studentProfile) return data;
  const studentProfile = await getStudentProfileText(data.subject);
  return studentProfile ? { ...data, studentProfile } : data;
}

function parseErr(e: unknown): never {
  if (e instanceof Error && e.message.startsWith("{")) {
    try {
      const p = JSON.parse(e.message) as { message?: string; status?: number };
      throw new ApiError(p.message ?? "Erro no tutor.", p.status ?? 503);
    } catch (inner) {
      if (inner instanceof ApiError) throw inner;
    }
  }
  throw e instanceof Error ? new ApiError(e.message, 503) : new ApiError("Erro no tutor.", 503);
}

export type TutorTipInput = {
  statement: string;
  alternatives: { key: string; text: string }[];
  studentChoice: string;
  subject?: string;
  topic?: string;
  tipLevel?: number;
  previousTips?: string[];
  correctKeyForValidationOnly?: string;
  studentProfile?: string;
};

export const tutorService = {
  async status() {
    try {
      return await getTutorStatus();
    } catch (e) {
      return parseErr(e);
    }
  },

  async tip(data: TutorTipInput) {
    try {
      return await requestTutorTip({ data: await withProfile(data) });
    } catch (e) {
      return parseErr(e);
    }
  },

  async explain(data: {
    statement: string;
    alternatives: { key: string; text: string }[];
    correctKey: string;
    studentChoice: string;
    subject?: string;
    topic?: string;
    studentProfile?: string;
  }) {
    try {
      return await requestTutorExplain({ data: await withProfile(data) });
    } catch (e) {
      return parseErr(e);
    }
  },

  async mastigado(data: {
    fonteUrl?: string;
    statement: string;
    subject?: string;
    topic?: string;
    explanationHint?: string;
    alternatives?: { key: string; text: string }[];
    questionId?: string;
    correctKey?: string;
    studentChoice?: string;
    studentProfile?: string;
  }) {
    try {
      return await requestTutorMastigado({ data: await withProfile(data) });
    } catch (e) {
      return parseErr(e);
    }
  },

  async explainNodeItems(data: {
    subject: string;
    mapTitle: string;
    nodeTitle: string;
    nodeSummary: string;
    existingChildren?: string[];
    material?: string;
  }) {
    try {
      return await explainMindNodeItems({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  async generatePractice(data: { subject: string; topic: string; conceptHint: string }) {
    try {
      return await generatePracticeQuestion({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  async generateMindMap(data: { title: string; subject: string }): Promise<{
    topics: MindMapOutlineTopic[];
    model: string;
    mocked: boolean;
  }> {
    try {
      return await generateMindMapOutline({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  async generateStudyPack(data: {
    title: string;
    subject: string;
    material: string;
    detail?: "resumo" | "padrao" | "detalhado";
    flashcardCount?: number;
    pdfBase64?: string;
    fileName?: string;
  }): Promise<{
    pack: StudyPackAi;
    model: string;
    mocked: boolean;
    materialChars: number;
  }> {
    try {
      return await generateStudyPack({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  async generateFlashcardsFromNodes(data: {
    subject: string;
    mapTitle: string;
    count?: number;
    nodes: { id: string; title: string; summary?: string; keywords?: string[] }[];
  }) {
    try {
      return await generateFlashcardsFromNodes({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  async gradePractice(data: { answerToken: string; choice: string }) {
    try {
      return await gradePracticeQuestion({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  async recommendations(data: {
    wrongByTopic: { subject: string; topic: string; wrongCount: number }[];
    difficultyEvents: {
      subject: string;
      topic: string;
      code: TutorDifficultyCode;
      at: string;
    }[];
    overdueReviews: { subject: string; topic: string; dueDate: string }[];
    lateSessionsCount: number;
    hoursPerDay?: number;
  }) {
    try {
      return await buildTutorRecommendations({ data });
    } catch (e) {
      return parseErr(e);
    }
  },

  recordDifficulty: (d: {
    subject: string;
    topic: string;
    code: TutorDifficultyCode;
    note?: string;
    questionId?: string;
  }) => tutorDifficultyStore.add(d),

  listDifficulties: () => tutorDifficultyStore.list(),

  async weeklyReinforce(data: { weekKey: string; summaryText: string }) {
    try {
      return await generateWeeklyReinforce({ data });
    } catch (e) {
      return parseErr(e);
    }
  },
};

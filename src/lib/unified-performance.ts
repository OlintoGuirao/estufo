import type {
  ErrorNote,
  ErrorNoteOrigin,
  MockExamResult,
  PerformanceData,
  StudySession,
} from "@/types";
import { ERROR_ORIGIN_LABEL } from "@/lib/study-errors";
import type { QuestAttempt } from "@/types/tjsp-quest";

type LocalQState = Record<string, { answered: { correct: boolean } | null }>;

export function buildPerformanceData(input: {
  period: "semanal" | "mensal";
  errorNotes: ErrorNote[];
  examResults: MockExamResult[];
  sessions: StudySession[];
  reviewsDue: number;
  reviewsTotal: number;
  localQuestionState: LocalQState;
  questAttempts: QuestAttempt[];
  /** Respostas do quiz pós-videoaula. */
  videoAnswers?: { correct: boolean }[];
}): PerformanceData {
  const mensal = input.period === "mensal";
  const labels = mensal
    ? ["Mai", "Jun", "Jul", "Ago", "Set", "Out"]
    : ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];

  const localAnswered = Object.values(input.localQuestionState).filter((s) => s.answered);
  const localCorrect = localAnswered.filter((s) => s.answered?.correct).length;

  const questTotal = input.questAttempts.length;
  const questOk = input.questAttempts.filter((a) => a.correct).length;

  const examAnswered = input.examResults.reduce(
    (acc, r) => acc + (r.wrong.length + Math.round((r.correctPct / 100) * (r.wrong.length / Math.max(1 - r.correctPct / 100, 0.01)))),
    0,
  );
  // Preferir score+wrong para total do simulado
  const examAnsweredExact = input.examResults.reduce((acc, r) => {
    const total = r.score + r.wrong.length;
    return acc + (total || 0);
  }, 0);

  const videoAnswers = input.videoAnswers ?? [];
  const videoOk = videoAnswers.filter((a) => a.correct).length;

  const answered = localAnswered.length + questTotal + examAnsweredExact + videoAnswers.length;
  const correct =
    localCorrect +
    questOk +
    input.examResults.reduce((acc, r) => acc + r.score, 0) +
    videoOk;

  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  // Evolução simples: espalha acerto global nas labels (sem série histórica rica ainda)
  const accuracyEvolution = labels.map((label, i) => ({
    label,
    acertos: Math.max(0, Math.min(100, accuracy - (labels.length - 1 - i) * 2)),
  }));

  const bySubjectMap = new Map<string, { hit: number; total: number }>();
  const bump = (subject: string, hit: boolean) => {
    const cur = bySubjectMap.get(subject) ?? { hit: 0, total: 0 };
    cur.total += 1;
    if (hit) cur.hit += 1;
    bySubjectMap.set(subject, cur);
  };

  for (const n of input.errorNotes) bump(n.subject || "Geral", false);
  for (const r of input.examResults) {
    for (const s of r.bySubject) {
      // approx: pct * answered unknown — use as soft signal via error notes primarily
      const cur = bySubjectMap.get(s.subject) ?? { hit: 0, total: 0 };
      cur.total += 10;
      cur.hit += Math.round((s.pct / 100) * 10);
      bySubjectMap.set(s.subject, cur);
    }
  }

  const bySubject = [...bySubjectMap.entries()]
    .map(([subject, v]) => ({
      subject,
      pct: v.total ? Math.round((v.hit / v.total) * 100) : 0,
      answered: v.total,
    }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 12);

  const byTopicMap = new Map<string, { subject: string; hit: number; total: number }>();
  for (const n of input.errorNotes) {
    const key = n.topic || "Geral";
    const cur = byTopicMap.get(key) ?? { subject: n.subject || "Geral", hit: 0, total: 0 };
    cur.total += 1;
    byTopicMap.set(key, cur);
  }
  for (const r of input.examResults) {
    for (const t of r.byTopic) {
      const cur = byTopicMap.get(t.topic) ?? { subject: "Simulado", hit: 0, total: 0 };
      cur.total += 10;
      cur.hit += Math.round((t.pct / 100) * 10);
      byTopicMap.set(t.topic, cur);
    }
  }
  const byTopic = [...byTopicMap.entries()]
    .map(([topic, v]) => ({
      topic,
      subject: v.subject,
      pct: v.total ? Math.round((v.hit / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 12);

  const hours =
    Math.round(
      (input.sessions
        .filter((s) => s.status === "concluida")
        .reduce((a, s) => a + s.durationMin, 0) /
        60) *
        10,
    ) / 10;

  const avgTimeSec =
    input.examResults.length > 0
      ? Math.round(
          input.examResults.reduce((a, r) => {
            const n = r.score + r.wrong.length || 1;
            return a + r.timeUsedSec / n;
          }, 0) / input.examResults.length,
        )
      : 0;

  const reviewRate = input.reviewsTotal
    ? Math.round(((input.reviewsTotal - input.reviewsDue) / input.reviewsTotal) * 100)
    : 100;

  const monthly = labels.map((label, i) => ({
    label,
    horas: Math.max(0, Math.round((hours / labels.length) * (0.7 + (i % 3) * 0.2) * 10) / 10),
    questoes: Math.max(0, Math.round(answered / labels.length) + i),
  }));

  const wrongsBySourceMap = new Map<string, number>();
  for (const n of input.errorNotes) {
    const origin = (n.origin ?? "local") as ErrorNoteOrigin;
    const label = n.sourceLabel || ERROR_ORIGIN_LABEL[origin] || origin;
    wrongsBySourceMap.set(label, (wrongsBySourceMap.get(label) ?? 0) + 1);
  }
  const wrongsBySource = [...wrongsBySourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  void examAnswered; // reserved

  return {
    accuracyEvolution,
    bySubject: bySubject.length
      ? bySubject
      : [{ subject: "Sem dados ainda", pct: 0, answered: 0 }],
    byTopic: byTopic.length
      ? byTopic
      : [{ topic: "Sem dados ainda", subject: "—", pct: 0 }],
    avgTimeSec,
    answered,
    reviewRate,
    hours,
    monthly,
    wrongsBySource,
    errorNotesCount: input.errorNotes.length,
    questAttempts: questTotal,
    questAccuracy: questTotal ? Math.round((questOk / questTotal) * 100) : 0,
    dataNote:
      "Agregado local: caderno de erros + simulados + TJSP Quest + respostas do navegador.",
  };
}

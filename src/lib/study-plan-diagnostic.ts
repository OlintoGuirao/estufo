/** Análise da prova diagnóstica → focos de estudo (regras fixas, não IA). */

export type DiagnosticItemResult = {
  questionId: string;
  subject: string;
  topic: string;
  choice: string;
  correctKey: string;
  correct: boolean;
  answeredAt?: string;
};

export type TopicFocus = {
  subject: string;
  topic: string;
  wrongCount: number;
  totalInTopic: number;
  /** true se errou ≥2 no mesmo tópico (recorrente). */
  recurring: boolean;
};

export type SubjectStat = {
  subject: string;
  correct: number;
  total: number;
  pct: number;
};

export type DiagnosticAnalysis = {
  total: number;
  correct: number;
  wrong: number;
  accuracyPct: number;
  bySubject: SubjectStat[];
  focuses: TopicFocus[];
  /** Tópicos com só 1 erro — sugeridos, mas não tratados como recorrentes. */
  singleErrorTopics: TopicFocus[];
};

const RECURRING_MIN = 2;

export function analyzeDiagnostic(items: DiagnosticItemResult[]): DiagnosticAnalysis {
  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const wrong = total - correct;

  const subMap = new Map<string, { correct: number; total: number }>();
  const topicMap = new Map<string, { subject: string; topic: string; wrong: number; total: number }>();

  for (const i of items) {
    const s = subMap.get(i.subject) ?? { correct: 0, total: 0 };
    s.total += 1;
    if (i.correct) s.correct += 1;
    subMap.set(i.subject, s);

    const key = `${i.subject}::${i.topic}`;
    const t = topicMap.get(key) ?? { subject: i.subject, topic: i.topic, wrong: 0, total: 0 };
    t.total += 1;
    if (!i.correct) t.wrong += 1;
    topicMap.set(key, t);
  }

  const bySubject = [...subMap.entries()]
    .map(([subject, v]) => ({
      subject,
      correct: v.correct,
      total: v.total,
      pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const topicStats: TopicFocus[] = [...topicMap.values()]
    .filter((t) => t.wrong > 0)
    .map((t) => ({
      subject: t.subject,
      topic: t.topic,
      wrongCount: t.wrong,
      totalInTopic: t.total,
      recurring: t.wrong >= RECURRING_MIN,
    }))
    .sort((a, b) => b.wrongCount - a.wrongCount || a.topic.localeCompare(b.topic));

  const focuses = topicStats.filter((t) => t.recurring);
  const singleErrorTopics = topicStats.filter((t) => !t.recurring);

  return {
    total,
    correct,
    wrong,
    accuracyPct: total ? Math.round((correct / total) * 100) : 0,
    bySubject,
    focuses,
    singleErrorTopics,
  };
}

/** Sessões sugeridas: recorrentes primeiro; se vazio, até 3 singles. */
export function focusesToSchedule(analysis: DiagnosticAnalysis): TopicFocus[] {
  if (analysis.focuses.length) return analysis.focuses;
  return analysis.singleErrorTopics.slice(0, 3);
}

export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(`${fromIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export { RECURRING_MIN };

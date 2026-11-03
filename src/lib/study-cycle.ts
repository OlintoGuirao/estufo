/**
 * Regras do ciclo de estudo (recomendação, SRS, caderno de erros).
 * Funções puras — usadas pelo mock e pelos testes. Não são "IA".
 */

export const SRS_INTERVALS_DAYS = [1, 1, 3, 7, 15] as const;

export type ErrorReasonCode = "nao-sabia" | "confundi" | "desatencao" | "falta-tempo" | "outro";

export const ERROR_REASON_OPTIONS: { code: ErrorReasonCode; label: string }[] = [
  { code: "nao-sabia", label: "Não sabia o conteúdo" },
  { code: "confundi", label: "Confundi conceitos" },
  { code: "desatencao", label: "Desatenção" },
  { code: "falta-tempo", label: "Falta de tempo" },
  { code: "outro", label: "Outro motivo" },
];

export function intervalForConfidence(confidence: number): number {
  const idx = Math.min(Math.max(Math.round(confidence), 1), 5) - 1;
  return SRS_INTERVALS_DAYS[idx] ?? 1;
}

/** Explica o intervalo fixo aplicado (transparência — não é algoritmo adaptativo). */
export function explainSrsInterval(confidence: number, intervalDays: number): string {
  return `Com confiança ${confidence}/5, a próxima revisão fica em ${intervalDays} dia${intervalDays === 1 ? "" : "s"} (regra fixa: 1→1d, 2→1d, 3→3d, 4→7d, 5→15d).`;
}

export function addDaysIso(fromIsoDate: string, days: number): string {
  const d = new Date(`${fromIsoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function masteryFromConfidence(confidence: number): "baixo" | "intermediario" | "bom" {
  if (confidence >= 4) return "bom";
  if (confidence >= 3) return "intermediario";
  return "baixo";
}

export type TopicWrongStat = { subject: string; topic: string; wrongCount: number };
export type ReviewDue = { id: string; subject: string; topic: string; dueDate: string; daysUntil: number };

export type RecommendationInput = {
  today: string;
  examDate?: string | null;
  overdueReviews: ReviewDue[];
  upcomingReviews: ReviewDue[];
  recentWrongByTopic: TopicWrongStat[];
  hasActiveContest: boolean;
  unansweredCount: number;
  lateSessionsCount: number;
};

export type StudyRecommendation = {
  title: string;
  reason: string;
  actionLabel: string;
  href: string;
  kind: "review" | "errors" | "questions" | "contest" | "plan";
  meta?: { subject?: string; topic?: string; reviewId?: string };
};

/**
 * Prioridade: revisão vencida com erros no tópico > revisão vencida >
 * erros recentes > sessão atrasada > questões não respondidas > sem concurso.
 * Só usa os dados fornecidos — não inventa números.
 */
export function buildRecommendation(input: RecommendationInput): StudyRecommendation | null {
  const overdue = [...input.overdueReviews].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const wrongMap = new Map(input.recentWrongByTopic.map((w) => [`${w.subject}::${w.topic}`, w]));

  for (const r of overdue) {
    const w = wrongMap.get(`${r.subject}::${r.topic}`);
    if (w && w.wrongCount > 0) {
      const daysLate = Math.abs(r.daysUntil);
      return {
        title: `Revisar ${r.topic}`,
        reason: `Há uma revisão vencida há ${daysLate} dia${daysLate === 1 ? "" : "s"} e você errou ${w.wrongCount} questão${w.wrongCount === 1 ? "" : "ões"} desse tópico recentemente.`,
        actionLabel: "Abrir revisão",
        href: "/revisoes",
        kind: "review",
        meta: { subject: r.subject, topic: r.topic, reviewId: r.id },
      };
    }
  }

  if (overdue[0]) {
    const r = overdue[0];
    const daysLate = Math.abs(r.daysUntil);
    return {
      title: `Revisar ${r.topic}`,
      reason: `Revisão de ${r.subject} está vencida há ${daysLate} dia${daysLate === 1 ? "" : "s"}.`,
      actionLabel: "Abrir revisão",
      href: "/revisoes",
      kind: "review",
      meta: { subject: r.subject, topic: r.topic, reviewId: r.id },
    };
  }

  const soon = input.upcomingReviews.filter((r) => r.daysUntil >= 0 && r.daysUntil <= 1);
  if (soon[0]) {
    const r = soon[0];
    const when = r.daysUntil === 0 ? "hoje" : "amanhã";
    return {
      title: `Revisar ${r.topic}`,
      reason: `Revisão de ${r.subject} vence ${when}.`,
      actionLabel: "Abrir revisão",
      href: "/revisoes",
      kind: "review",
      meta: { subject: r.subject, topic: r.topic, reviewId: r.id },
    };
  }

  const topWrong = [...input.recentWrongByTopic].sort((a, b) => b.wrongCount - a.wrongCount)[0];
  if (topWrong && topWrong.wrongCount > 0) {
    let reason = `Você errou ${topWrong.wrongCount} questão${topWrong.wrongCount === 1 ? "" : "ões"} de ${topWrong.topic} recentemente. Revise no caderno de erros.`;
    if (input.examDate) {
      const days = daysBetween(input.today, input.examDate);
      if (days >= 0 && days <= 60) {
        reason += ` Faltam ${days} dia${days === 1 ? "" : "s"} para a prova.`;
      }
    }
    return {
      title: `Corrigir erros em ${topWrong.topic}`,
      reason,
      actionLabel: "Abrir caderno de erros",
      href: "/erros",
      kind: "errors",
      meta: { subject: topWrong.subject, topic: topWrong.topic },
    };
  }

  if (input.lateSessionsCount > 0) {
    return {
      title: "Reorganizar o plano",
      reason: `Há ${input.lateSessionsCount} sessão${input.lateSessionsCount === 1 ? "" : "ões"} atrasada${input.lateSessionsCount === 1 ? "" : "s"} no plano. Reagende ou divida em blocos menores.`,
      actionLabel: "Abrir plano",
      href: "/plano",
      kind: "plan",
    };
  }

  if (!input.hasActiveContest) {
    return {
      title: "Escolha um concurso",
      reason: "Sem concurso ativo não dá para priorizar o edital. Defina um em Concursos.",
      actionLabel: "Ver concursos",
      href: "/concursos",
      kind: "contest",
    };
  }

  if (input.unansweredCount > 0) {
    return {
      title: "Resolver questões",
      reason: `Há ${input.unansweredCount} questão${input.unansweredCount === 1 ? "" : "ões"} ainda sem resposta no banco. Pratique para gerar dados de desempenho.`,
      actionLabel: "Ir às questões",
      href: "/questoes",
      kind: "questions",
    };
  }

  return null;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function aggregateWrongByTopic(
  items: { subject: string; topic: string; answered?: { correct: boolean } | null }[],
): TopicWrongStat[] {
  const map = new Map<string, TopicWrongStat>();
  for (const q of items) {
    if (!q.answered || q.answered.correct) continue;
    const key = `${q.subject}::${q.topic}`;
    const cur = map.get(key) ?? { subject: q.subject, topic: q.topic, wrongCount: 0 };
    cur.wrongCount += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.wrongCount - a.wrongCount);
}

export function accuracyBySubject(
  items: { subject: string; answered?: { correct: boolean } | null }[],
): { subject: string; pct: number; answered: number }[] {
  const map = new Map<string, { ok: number; total: number }>();
  for (const q of items) {
    if (!q.answered) continue;
    const cur = map.get(q.subject) ?? { ok: 0, total: 0 };
    cur.total += 1;
    if (q.answered.correct) cur.ok += 1;
    map.set(q.subject, cur);
  }
  return [...map.entries()]
    .map(([subject, { ok, total }]) => ({ subject, pct: Math.round((ok / total) * 100), answered: total }))
    .sort((a, b) => a.pct - b.pct);
}

export function splitDuration(totalMin: number, parts: number): number[] {
  const n = Math.max(2, Math.min(parts, 6));
  const base = Math.floor(totalMin / n);
  const rem = totalMin - base * n;
  if (base < 10) return [totalMin];
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

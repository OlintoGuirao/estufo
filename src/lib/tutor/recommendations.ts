import type { StudyAdviceItem, TutorDifficultyCode } from "./types";

export type DifficultyEvent = {
  subject: string;
  topic: string;
  code: TutorDifficultyCode;
  at: string;
};

export type TutorAdviceInput = {
  wrongByTopic: { subject: string; topic: string; wrongCount: number }[];
  difficultyEvents: DifficultyEvent[];
  overdueReviews: { subject: string; topic: string; dueDate: string }[];
  lateSessionsCount: number;
  hoursPerDay?: number | null;
};

const RECURRING_MIN = 2;

/**
 * Recomendações baseadas só nos dados fornecidos.
 * Um único erro NÃO gera diagnóstico de dificuldade recorrente.
 */
export function buildTutorAdvice(input: TutorAdviceInput): StudyAdviceItem[] {
  const items: StudyAdviceItem[] = [];

  for (const r of input.overdueReviews.slice(0, 3)) {
    items.push({
      title: `Revisar ${r.topic}`,
      reason: `Há revisão pendente/atrasada de ${r.subject}.`,
      evidence: [`Revisão com vencimento em ${r.dueDate}`, `Tópico: ${r.topic}`],
      provisional: false,
      kind: "review",
      subject: r.subject,
      topic: r.topic,
    });
  }

  for (const w of input.wrongByTopic.filter((x) => x.wrongCount >= RECURRING_MIN).slice(0, 4)) {
    const diffs = input.difficultyEvents.filter(
      (d) => d.subject === w.subject && d.topic === w.topic,
    );
    const evidence = [
      `${w.wrongCount} erros registrados neste tópico`,
      diffs.length
        ? `Dificuldades informadas: ${summarizeCodes(diffs.map((d) => d.code))}`
        : "Ainda sem tipo de dificuldade informado pelo aluno",
    ];
    items.push({
      title: `Reforçar ${w.topic}`,
      reason: `Erros recorrentes em ${w.subject} (mínimo ${RECURRING_MIN} ocorrências).`,
      evidence,
      provisional: diffs.length < RECURRING_MIN,
      kind: "errors",
      subject: w.subject,
      topic: w.topic,
    });
  }

  // Padrão de dificuldade só com 2+ eventos no mesmo tópico+código
  const patternKey = new Map<string, number>();
  for (const d of input.difficultyEvents) {
    const k = `${d.subject}::${d.topic}::${d.code}`;
    patternKey.set(k, (patternKey.get(k) ?? 0) + 1);
  }
  for (const [k, n] of patternKey) {
    if (n < RECURRING_MIN) continue;
    const [subject, topic, code] = k.split("::");
    if (!subject || !topic || !code) continue;
    if (items.some((i) => i.topic === topic && i.kind === "topic")) continue;
    items.push({
      title: `Atenção ao padrão em ${topic}`,
      reason: `O aluno reportou “${labelCode(code as TutorDifficultyCode)}” mais de uma vez neste tópico.`,
      evidence: [`${n} registros do mesmo tipo de dificuldade`, `Matéria: ${subject}`],
      provisional: false,
      kind: "topic",
      subject,
      topic,
    });
  }

  if (input.lateSessionsCount > 0) {
    items.push({
      title: "Reorganizar sessões atrasadas",
      reason:
        "Há sessões atrasadas no plano. Horas no calendário não medem aprendizado — só sinalizam atraso de execução.",
      evidence: [`${input.lateSessionsCount} sessão(ões) atrasada(s)`],
      provisional: true,
      kind: "plan",
    });
  }

  if (!items.length) {
    items.push({
      title: "Ainda há poucos dados",
      reason: "Sem erros recorrentes nem revisões vencidas suficientes para um diagnóstico sólido.",
      evidence: ["Menos de 2 erros por tópico", "Nenhuma revisão atrasada informada"],
      provisional: true,
      kind: "errors",
    });
  }

  return items.slice(0, 8);
}

function summarizeCodes(codes: TutorDifficultyCode[]): string {
  const counts = new Map<string, number>();
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()]
    .map(([c, n]) => `${labelCode(c as TutorDifficultyCode)} (${n})`)
    .join(", ");
}

function labelCode(code: TutorDifficultyCode): string {
  const map: Record<TutorDifficultyCode, string> = {
    desconhecia: "desconhecia o conteúdo",
    confundiu: "confundiu conceitos",
    enunciado: "não entendeu o enunciado",
    desatencao: "desatenção",
    "falta-tempo": "falta de tempo",
    outro: "outra",
  };
  return map[code] ?? code;
}

/** Um único evento nunca é "recorrente". */
export function isRecurringDifficulty(
  events: DifficultyEvent[],
  subject: string,
  topic: string,
  code: TutorDifficultyCode,
): boolean {
  return (
    events.filter((e) => e.subject === subject && e.topic === topic && e.code === code).length >=
    RECURRING_MIN
  );
}

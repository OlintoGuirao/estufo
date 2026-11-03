import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  aggregateWrongByTopic,
  buildRecommendation,
  explainSrsInterval,
  intervalForConfidence,
  masteryFromConfidence,
  splitDuration,
} from "./study-cycle";

describe("intervalForConfidence / SRS", () => {
  it("usa a tabela fixa 1,1,3,7,15", () => {
    expect([1, 2, 3, 4, 5].map(intervalForConfidence)).toEqual([1, 1, 3, 7, 15]);
  });

  it("explica o intervalo sem chamar de IA", () => {
    const text = explainSrsInterval(4, 7);
    expect(text).toContain("confiança 4/5");
    expect(text).toContain("7 dia");
    expect(text.toLowerCase()).not.toContain("inteligente");
  });

  it("mapeia mastery a partir da confiança", () => {
    expect(masteryFromConfidence(2)).toBe("baixo");
    expect(masteryFromConfidence(3)).toBe("intermediario");
    expect(masteryFromConfidence(5)).toBe("bom");
  });

  it("avança datas em ISO", () => {
    expect(addDaysIso("2026-10-19", 3)).toBe("2026-10-22");
  });
});

describe("aggregateWrongByTopic", () => {
  it("conta apenas erros", () => {
    const stats = aggregateWrongByTopic([
      { subject: "Português", topic: "Crase", answered: { correct: false } },
      { subject: "Português", topic: "Crase", answered: { correct: false } },
      { subject: "Português", topic: "Crase", answered: { correct: true } },
      { subject: "RL", topic: "Probabilidade", answered: { correct: false } },
      { subject: "RL", topic: "Probabilidade", answered: null },
    ]);
    expect(stats[0]).toMatchObject({ subject: "Português", topic: "Crase", wrongCount: 2 });
    expect(stats[1]).toMatchObject({ topic: "Probabilidade", wrongCount: 1 });
  });
});

describe("buildRecommendation", () => {
  const base = {
    today: "2026-10-19",
    examDate: "2026-12-01",
    overdueReviews: [] as { id: string; subject: string; topic: string; dueDate: string; daysUntil: number }[],
    upcomingReviews: [] as { id: string; subject: string; topic: string; dueDate: string; daysUntil: number }[],
    recentWrongByTopic: [] as { subject: string; topic: string; wrongCount: number }[],
    hasActiveContest: true,
    unansweredCount: 10,
    lateSessionsCount: 0,
  };

  it("prioriza revisão vencida com erros no tópico", () => {
    const rec = buildRecommendation({
      ...base,
      overdueReviews: [{ id: "r1", subject: "Língua Portuguesa", topic: "Crase", dueDate: "2026-10-17", daysUntil: -2 }],
      recentWrongByTopic: [{ subject: "Língua Portuguesa", topic: "Crase", wrongCount: 5 }],
    });
    expect(rec?.kind).toBe("review");
    expect(rec?.title).toContain("Crase");
    expect(rec?.reason).toContain("errou 5");
    expect(rec?.reason).toContain("vencida");
  });

  it("sugere caderno de erros quando há erros e não há revisão vencida", () => {
    const rec = buildRecommendation({
      ...base,
      recentWrongByTopic: [{ subject: "RL", topic: "Probabilidade", wrongCount: 3 }],
    });
    expect(rec?.kind).toBe("errors");
    expect(rec?.href).toBe("/erros");
  });

  it("retorna null quando não há sinais úteis", () => {
    const rec = buildRecommendation({
      ...base,
      hasActiveContest: true,
      unansweredCount: 0,
      lateSessionsCount: 0,
    });
    expect(rec).toBeNull();
  });

  it("pede concurso quando não há ativo", () => {
    const rec = buildRecommendation({ ...base, hasActiveContest: false, unansweredCount: 0 });
    expect(rec?.kind).toBe("contest");
  });
});

describe("splitDuration", () => {
  it("divide em blocos >= 10 min", () => {
    expect(splitDuration(60, 2)).toEqual([30, 30]);
    expect(splitDuration(45, 2)).toEqual([23, 22]);
  });

  it("não divide se ficar curto demais", () => {
    expect(splitDuration(15, 2)).toEqual([15]);
  });
});

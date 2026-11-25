import { VUNESP_DIREITO_AREAS, type VunespArea, type VunespTema } from "@/data/vunesp-direito-temas";

export type HotTopic = VunespTema & {
  areaId: string;
  areaName: string;
  /** Quantas questões caíram sobre o assunto. */
  count: number;
  /** Anos de prova em que apareceu (crescente). */
  years: number[];
};

export type HotTopicProgress = { answered: number; correct: number };

/** Total de provas oficiais na base (2018, 2021, 2023, 2024, 2025). */
export const VUNESP_PROVA_YEARS = [2018, 2021, 2023, 2024, 2025] as const;

function yearOf(id: string): number {
  const m = /tjsp-oficial-(\d{4})-/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Ranking: mais questões primeiro; empate → presente em mais provas. */
export function rankHotTopics(
  areas: VunespArea[] = VUNESP_DIREITO_AREAS,
  areaId?: string | null,
): HotTopic[] {
  const out: HotTopic[] = [];
  for (const a of areas) {
    if (areaId && a.id !== areaId) continue;
    for (const t of a.temas) {
      out.push({
        ...t,
        areaId: a.id,
        areaName: a.name,
        count: t.questionIds.length,
        years: [...new Set(t.questionIds.map(yearOf))].filter(Boolean).sort(),
      });
    }
  }
  return out.sort(
    (x, y) => y.count - x.count || y.years.length - x.years.length || x.name.localeCompare(y.name),
  );
}

export function areaTotals(areas: VunespArea[] = VUNESP_DIREITO_AREAS) {
  return areas
    .map((a) => ({
      id: a.id,
      name: a.name,
      count: a.temas.reduce((n, t) => n + t.questionIds.length, 0),
    }))
    .sort((x, y) => y.count - x.count);
}

/** Questões dos N assuntos do topo, intercaladas para não virar bloco de um tema só. */
export function pickTopTopicQuestionIds(topics: HotTopic[], topN = 5, max = 20): string[] {
  const lists = topics.slice(0, topN).map((t) => shuffle(t.questionIds));
  const out: string[] = [];
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      if (i < l.length && out.length < max) out.push(l[i]!);
    }
  }
  return shuffle(out);
}

export function topicProgress(
  topic: Pick<VunespTema, "questionIds">,
  getAnswered: (id: string) => { correct: boolean } | null | undefined,
): HotTopicProgress {
  let answered = 0;
  let correct = 0;
  for (const id of topic.questionIds) {
    const a = getAnswered(id);
    if (!a) continue;
    answered++;
    if (a.correct) correct++;
  }
  return { answered, correct };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

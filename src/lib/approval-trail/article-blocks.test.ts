/**
 * Trilha da Fabiola (27/11): "Arts. 404 a 413" era UMA etapa (bloco de 10) e a
 * aula explicava o bloco, não cada artigo.
 */
import { describe, expect, it } from "vitest";
import { expandSegmentToArticleTokens, stagesFromLawItem } from "./study-stages";
import { expandArticleBlockTopics } from "./extract-program";
import { buildWeeksFromSubjects } from "./build-weeks";
import { lessonMatchesDay } from "@/services/trail-week-lesson.service";
import type { TrailSubject, TrailTopic } from "@/types/approval-trail";

const art = (n: number, extra: Partial<TrailTopic> = {}): TrailTopic => ({
  id: `t${n}`,
  name: `Art. ${n}`,
  weightHint: "media",
  notes: "Edital (Código de Processo Penal)",
  status: "concluida",
  articleRef: String(n),
  kind: "artigo",
  explanation: `material do ${n}`,
  ...extra,
});

describe("extrator: toda faixa vira artigo por artigo", () => {
  it("CPP 394 a 497 → 104 etapas individuais (antes: blocos de 10)", () => {
    const toks = expandSegmentToArticleTokens("394 a 497");
    expect(toks).toHaveLength(104);
    expect(toks.every((t) => /^\d+$/.test(t))).toBe(true);
    const st = stagesFromLawItem({ subjectName: "Direito Processual Penal", body: "Código de Processo Penal – artigos 394 a 497." });
    expect(st.some((s) => /Arts\. \d+ a \d+/.test(s.name))).toBe(false);
    expect(st.find((s) => s.articleRef === "404")?.name).toBe("Art. 404 (CPP)");
  });
});

describe("trilha já criada com blocos", () => {
  const bloco: TrailTopic = {
    id: "blk",
    name: "Arts. 404 a 413",
    weightHint: "media",
    notes: "Edital (Código de Processo Penal): estudar e explicar CADA artigo de 404 a 413.",
    status: "concluida",
    articleRef: "404-413",
    kind: "artigo",
    explanation: "material do bloco",
  };

  it("cada bloco vira 10 artigos; o 1º herda o id (progresso continua ligado)", () => {
    const { topics, changed } = expandArticleBlockTopics([art(403), bloco, art(414)]);
    expect(changed).toBe(true);
    expect(topics.map((t) => t.name)).toEqual([
      "Art. 403",
      ...Array.from({ length: 10 }, (_, i) => `Art. ${404 + i}`),
      "Art. 414",
    ]);
    expect(topics[1]!.id).toBe("blk");
    expect(new Set(topics.map((t) => t.id)).size).toBe(topics.length);
    // herda status e material: não some do cronograma nem "desconclui"
    expect(topics.slice(1, 11).every((t) => t.status === "concluida" && t.explanation === "material do bloco")).toBe(true);
    expect(topics[2]!.notes).toMatch(/Art\. 405/);
  });

  it("mantém prefixo 'Etapa 3.1 —' e o rótulo da lei", () => {
    const { topics } = expandArticleBlockTopics([{ ...bloco, name: "Etapa 3.1 — Arts. 404 a 413 (CPC)" }]);
    expect(topics[0]!.name).toBe("Etapa 3.1 — Art. 404 (CPC)");
  });

  it("trilha sem blocos não muda", () => {
    expect(expandArticleBlockTopics([art(1), art(2)]).changed).toBe(false);
  });

  it("os dias ANTES do bloco continuam iguais (progresso concluído preservado)", () => {
    const singles = Array.from({ length: 30 }, (_, i) => art(364 + i)); // 364–393
    const subj = (topics: TrailTopic[]): TrailSubject => ({
      id: "pp",
      name: "Direito Processual Penal",
      questionCountHint: null,
      order: 1,
      topics,
    });
    const opts = { weeksTarget: 40, hoursPerWeek: 10, studyDays: [1, 2, 3, 4, 5] as const, onlyWithMaterial: true };
    const antes = buildWeeksFromSubjects({ ...opts, studyDays: [...opts.studyDays], subjects: [subj([...singles, bloco])] });
    const depois = buildWeeksFromSubjects({
      ...opts,
      studyDays: [...opts.studyDays],
      subjects: [subj(expandArticleBlockTopics([...singles, bloco]).topics)],
    });
    for (let i = 0; i < 3; i++) expect(depois[i]!.topicIds).toEqual(antes[i]!.topicIds);
    // e o dia do bloco agora tem artigos individuais
    const diaBloco = depois.find((w) => w.topicIds?.includes("blk"))!;
    expect(diaBloco.topicIds).toHaveLength(10);
    expect(diaBloco.topicIds?.[1]).toBe("blk-a405");
    expect(diaBloco.focus).toBe("Direito Processual Penal — Arts. 404–413");
  });
});

describe("aula guardada pelo número do dia", () => {
  it("é refeita quando o dia passou a ter outro conteúdo", () => {
    expect(lessonMatchesDay({ focus: "Proc. Penal — Arts. 394–403" }, "Proc. Penal — Arts. 394–403")).toBe(true);
    expect(lessonMatchesDay({ focus: "Proc. Penal — Arts. 394–403" }, "Proc. Penal — Arts. 404–413")).toBe(false);
    // aula antiga (sem focus): pelo título "Sessão N: <foco>"
    expect(lessonMatchesDay({ title: "Sessão 18: Proc. Penal — Arts. 365–404–413" }, "Proc. Penal — Arts. 365–374")).toBe(false);
    expect(lessonMatchesDay({ title: "Sessão 18: Proc. Penal — Arts. 365–374" }, "Proc. Penal — Arts. 365–374")).toBe(true);
  });
});

/**
 * Artigos do edital: únicos, completos e ligados à lei certa.
 *
 * Trecho REAL do Anexo VIII do Edital de Abertura nº 02/2026 (Escrevente TJSP),
 * com as quebras de linha que a extração do PDF produz.
 */
import { describe, expect, it } from "vitest";
import {
  dedupeTopics,
  extractProgramFromEditalText,
  findProgramStart,
  mergeOrphanLawSubjects,
} from "./extract-program";
import { articleSpecToTokens, shortLawLabel, stagesFromLawItem } from "./study-stages";
import { buildWeeksFromSubjects } from "./build-weeks";
import type { TrailSubject } from "@/types/approval-trail";

const CORPO_DO_EDITAL = `
4. A prova objetiva versará sobre o conteúdo
programático constante do Anexo VIII deste edital, que faz parte integrante deste edital.
5. Das decisões da Comissão Recursal não caberá recurso.
6. A Comissão Recursal em suas decisões considerará a documentação apresentada.
`;

const ANEXO_VIII = `
ANEXO VIII
CONTEÚDO PROGRAMÁTICO
Toda legislação deve ser considerada com as alterações e atualizações vigentes até a data
da publicação deste edital de abertura de inscrições.
BLOCO II: Conhecimentos em Direito
30 questões:
1. DIREITO PENAL: Código Penal – artigos 293 a 305; 307; 308; 311-A; 312 a 317; 319 a
333; 336 e 337; 339 a 347; 357 e 359.
2. DIREITO PROCESSUAL PENAL: Código de Processo Penal – artigos 251 a 258; 261 a
267; 274; 351 a 372; 394 a 497; 531 a 538; 541 a 548; 574 a 667 e Lei n.º 9.099 de 26.09.1995
(artigos 60 a 83; 88 e 89).
3. DIREITO PROCESSUAL CIVIL:
3.1. Código de Processo Civil – artigos 144 a 155; 188 a 275; 294 a 311 e do 318 a 538; 994
a 1026;
3.2. Lei n.º 9.099 de 26.09.1995 (artigos 3º ao 19) e
3.3. Lei n.º 12.153 de 22/12/2009.
4. DIREITO CONSTITUCIONAL: Constituição Federal – Título II – Capítulos I, II e III; e Título
III – Capítulo VII com Seções I e II; e também o artigo 92.
5. DIREITO ADMINISTRATIVO:
5.1. Estatuto dos Funcionários Públicos Civis do Estado de São Paulo (Lei n.º 10.261/68) –
artigos 1º a 86; 171 a 175; 239 a 323 e
5.2. Lei Federal n.º 8.429/92 (Lei de Improbidade Administrativa).
`;

const EDITAL = `${CORPO_DO_EDITAL}\n${ANEXO_VIII}`;

function subject(name: RegExp) {
  const s = extractProgramFromEditalText(EDITAL).subjects.find((x) => name.test(x.name));
  expect(s, `matéria ${name}`).toBeTruthy();
  return s!;
}

function identity(t: { articleRef?: string; lawRef?: string; name: string }) {
  return `${t.lawRef ?? ""}|${t.articleRef ?? t.name}`;
}

describe("conteúdo programático: onde começa", () => {
  it("usa o título do Anexo, não a menção no corpo do edital", () => {
    const start = findProgramStart(EDITAL);
    expect(EDITAL.slice(start, start + 40)).toMatch(/^CONTEÚDO PROGRAMÁTICO/);
    // As regras do concurso não viram "matéria".
    const names = extractProgramFromEditalText(EDITAL).subjects.map((s) => s.name).join(" | ");
    expect(names).not.toMatch(/Comiss|recurso|Conteúdo programático/i);
  });
});

describe("artigos únicos e ligados à lei", () => {
  it("nenhuma matéria tem etapa repetida (mesma lei + mesmo artigo)", () => {
    for (const s of extractProgramFromEditalText(EDITAL).subjects) {
      const keys = s.topics.map(identity);
      expect(new Set(keys).size, s.name).toBe(keys.length);
    }
  });

  it("Processual Penal: CPP e Lei 9.099 separados (o Art. 60 é da Lei 9.099)", () => {
    const pp = subject(/processual penal/i);
    const art60 = pp.topics.filter((t) => t.articleRef === "60");
    expect(art60).toHaveLength(1);
    expect(art60[0]!.lawRef).toBe("Lei 9.099/1995");
    expect(art60[0]!.name).toBe("Art. 60 (Lei 9.099/1995)");
    expect(pp.topics.some((t) => t.lawRef === "CPP" && t.articleRef === "351")).toBe(true);
    expect(pp.topics.some((t) => t.lawRef === "Lei 9.099/1995" && t.articleRef === "89")).toBe(true);
  });

  it("Processual Civil: faixas completas, mesmo com quebra de linha no PDF", () => {
    const pc = subject(/processual civil/i);
    const cpc = pc.topics.filter((t) => t.lawRef === "CPC").map((t) => t.articleRef);
    // "294 a 311 e do 318 a 538" e "994⏎a 1026" sumiam.
    expect(cpc).toContain("300");
    expect(cpc).toContain("1026");
    expect(cpc.filter((r) => r === "994")).toHaveLength(1);
    expect(pc.topics.some((t) => /538 a 538/.test(t.name))).toBe(false);
    // "artigos 3º ao 19" da Lei 9.099 e a Lei 12.153 inteira.
    expect(pc.topics.filter((t) => t.lawRef === "Lei 9.099/1995").map((t) => t.articleRef)).toEqual(
      Array.from({ length: 17 }, (_, i) => String(i + 3)),
    );
    expect(pc.topics.some((t) => t.lawRef === "Lei 12.153/2009")).toBe(true);
  });

  it("Constitucional: capítulos do edital viram etapas com os artigos certos", () => {
    const cf = subject(/constitucional/i);
    const names = cf.topics.map((t) => t.name);
    expect(names.some((n) => /Título II, Cap\. I .*art\. 5º/.test(n))).toBe(true);
    expect(names.some((n) => /Título II, Cap\. III .*Nacionalidade/.test(n))).toBe(true);
    expect(names.some((n) => /Título III, Cap\. VII, Seção II .*Servidores/.test(n))).toBe(true);
    expect(names).toContain("Art. 92 (CF)");
  });

  it("Administrativo: '1º a 86' e o 'e' no fim da lista não somem; Lei 8.429 entra", () => {
    const adm = subject(/administrativo/i);
    const est = adm.topics.filter((t) => t.lawRef === "Lei 10.261/68");
    expect(est.some((t) => t.articleRef === "1")).toBe(true);
    expect(est.some((t) => t.articleRef === "86")).toBe(true);
    expect(est.some((t) => t.articleRef === "171")).toBe(true);
    expect(est.some((t) => t.articleRef === "323")).toBe(true);
    expect(adm.topics.some((t) => t.lawRef === "Lei 8.429/92" && /Improbidade/.test(t.name))).toBe(true);
  });
});

describe("tokens e rótulos", () => {
  it("lista de artigos com º, 'ao', 'do', milhar e 'e' solto", () => {
    expect(articleSpecToTokens("5º ao 7")).toEqual(["5", "6", "7"]);
    expect(articleSpecToTokens("336 e 337; 311-A")).toEqual(["336", "337", "311-A"]);
    expect(articleSpecToTokens("1.010 a 1.012")).toEqual(["1010", "1011", "1012"]);
    expect(articleSpecToTokens("239 a 241 e")).toEqual(["239", "240", "241"]);
  });

  it("rótulo da lei: data por extenso não vira ano", () => {
    expect(shortLawLabel("Lei n.º 12.153 de 22/12/2009")).toBe("Lei 12.153/2009");
    expect(shortLawLabel("Lei n.º 9.099 de 26.09.1995")).toBe("Lei 9.099/1995");
    expect(shortLawLabel("Lei Federal n.º 8.429/92")).toBe("Lei 8.429/92");
    expect(shortLawLabel("Código de Processo Penal")).toBe("CPP");
  });

  it("o mesmo artigo citado duas vezes no item vira uma etapa só", () => {
    const st = stagesFromLawItem({
      subjectName: "Direito Penal",
      body: "Código Penal – artigos 312 a 314; 313 e 314.",
    });
    expect(st.map((s) => s.articleRef)).toEqual(["312", "313", "314"]);
  });
});

describe("fusão de matérias e cronograma", () => {
  it("lei órfã fundida ao ramo não duplica etapas", () => {
    const merged = mergeOrphanLawSubjects([
      { name: "Direito Processual Civil", topics: [{ name: "Art. 144 (CPC)", articleRef: "144", lawRef: "CPC" }] },
      { name: "Código de Processo Civil", topics: [{ name: "Art. 144 (CPC)", articleRef: "144", lawRef: "CPC" }] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.topics).toHaveLength(1);
    expect(dedupeTopics([{ name: "Etapa 3.1 — Arts. 1 a 10" }, { name: "Arts. 1 a 10" }])).toHaveLength(1);
  });

  it("um dia de estudo não mistura artigos de leis diferentes", () => {
    const pp = subject(/processual penal/i);
    const subj: TrailSubject = {
      id: "s",
      name: pp.name,
      questionCountHint: null,
      order: 1,
      topics: pp.topics.map((t, i) => ({
        id: `t${i}`,
        name: t.name,
        weightHint: t.weightHint,
        notes: t.notes,
        status: "pendente" as const,
        explanation: "x",
        ...(t.articleRef ? { articleRef: t.articleRef } : {}),
        ...(t.lawRef ? { lawRef: t.lawRef } : {}),
        kind: t.kind ?? "artigo",
      })),
    };
    const byId = new Map(subj.topics.map((t) => [t.id, t]));
    const weeks = buildWeeksFromSubjects({
      subjects: [subj],
      weeksTarget: 30,
      hoursPerWeek: 10,
      studyDays: [1, 2, 3, 4, 5],
      onlyWithMaterial: true,
    });
    expect(weeks.length).toBeGreaterThan(0);
    for (const w of weeks) {
      const laws = new Set((w.topicIds ?? []).map((id) => byId.get(id)?.lawRef));
      expect(laws.size, w.focus).toBe(1);
    }
  });
});

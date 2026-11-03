import { describe, expect, it } from "vitest";
import {
  expandSegmentToArticleTokens,
  splitArticleSegments,
  stagesFromLawItem,
} from "./study-stages";
import { extractProgramFromEditalText } from "./extract-program";

describe("expandSegmentToArticleTokens", () => {
  it("expande faixa 293 a 305 em artigos individuais", () => {
    const toks = expandSegmentToArticleTokens("293 a 305");
    expect(toks[0]).toBe("293");
    expect(toks[toks.length - 1]).toBe("305");
    expect(toks).toHaveLength(13);
  });

  it("mantém 311-A", () => {
    expect(expandSegmentToArticleTokens("311-A")).toEqual(["311-A"]);
  });
});

describe("stagesFromLawItem", () => {
  it("cria uma etapa por artigo do Direito Penal", () => {
    const stages = stagesFromLawItem({
      subjectName: "Direito Penal",
      body: "DIREITO PENAL: Código Penal – artigos 293 a 305; 307; 308; 311-A; 312 a 317; 319 a 333; 336 e 337; 339 a 347; 357 e 359.",
      itemCode: "1",
    });
    expect(stages.length).toBeGreaterThanOrEqual(40);
    expect(stages.some((s) => s.name === "Art. 293")).toBe(true);
    expect(stages.some((s) => s.name === "Art. 311-A")).toBe(true);
    expect(stages.filter((s) => s.kind === "artigo").length).toBe(stages.length);
  });
});

describe("splitArticleSegments", () => {
  it("parte por ponto e vírgula", () => {
    const segs = splitArticleSegments(
      "Código Penal – artigos 293 a 305; 307; 308; 311-A; 312 a 317.",
    );
    expect(segs.length).toBeGreaterThanOrEqual(5);
  });
});

describe("extractProgramFromEditalText", () => {
  it("separa matérias e expande artigos", () => {
    const sample = `
CONTEÚDO PROGRAMÁTICO
BLOCO I: Língua Portuguesa
16 questões:
1. Análise, compreensão e interpretação de diversos tipos de textos.
2. Crase.
3. Pontuação.

BLOCO II: Conhecimentos em Direito
30 questões:
1. DIREITO PENAL: Código Penal – artigos 293 a 295; 307; 311-A.

Matemática
04 questões:
1. Porcentagem.
2. Juros simples.
`;
    const r = extractProgramFromEditalText(sample);
    expect(r.subjects.some((s) => /portuguesa/i.test(s.name))).toBe(true);
    expect(r.subjects.some((s) => /matem/i.test(s.name))).toBe(true);
    const penal = r.subjects.find((s) => /penal/i.test(s.name) && !/processual/i.test(s.name));
    expect(penal).toBeTruthy();
    expect(penal!.topics.some((t) => t.name === "Art. 293")).toBe(true);
    expect(penal!.topics.some((t) => t.name === "Art. 311-A")).toBe(true);
  });

  it("extrai Legislação Interna 6.1–6.4 com resoluções e normas", () => {
    const sample = `
CONTEÚDO PROGRAMÁTICO
BLOCO II: Conhecimentos em Direito
30 questões:
1. DIREITO PENAL: Código Penal – artigos 293 a 295.
6. LEGISLAÇÃO INTERNA:
6.1. Resolução TJSP nº 850/2021 (Regulamenta o teletrabalho no âmbito do Tribunal de Justiça do Estado de São Paulo). Disponível em: https://esaj.tjsp.jus.br/gcn-frontend-vue/legislacao/find/196070
6.2. Resolução TJSP nº 963/2025 (Dispõe sobre a governança e utilização do sistema eproc). Disponível em: https://esaj.tjsp.jus.br/gcn-frontend-vue/legislacao/find/229313
6.2. Lei Complementar n° 1.111/2010 (Institui o Plano de Cargos e Carreiras dos servidores do Tribunal de Justiça).
6.3. Regimento Interno do Tribunal de Justiça. Disponível em: https://www.tjsp.jus.br/Download/Portal/Biblioteca/Biblioteca/Legislacao/RegimentoInternoTJSP.pdf
6.4. Normas da Corregedoria Geral da Justiça: Tomo I - Capítulo II: Seção I - subseções I e II; Tomo I - Capítulo III: Seções I, II, V; Tomo I - Capítulo XI: Seção I a VII. Disponível em: https://www.tjsp.jus.br/Corregedoria/Comunicados/NormasJudiciais
`;
    const r = extractProgramFromEditalText(sample);
    const leg = r.subjects.find((s) => /legisla/i.test(s.name));
    expect(leg).toBeTruthy();
    expect(leg!.topics.length).toBeGreaterThanOrEqual(4);
    expect(leg!.topics.some((t) => /850/i.test(t.name))).toBe(true);
    expect(leg!.topics.some((t) => /963|eproc/i.test(t.name))).toBe(true);
    expect(leg!.topics.some((t) => /Regimento/i.test(t.name))).toBe(true);
    expect(leg!.topics.some((t) => /Corregedoria|Tomo/i.test(t.name))).toBe(true);
    expect(leg!.topics.some((t) => /Fontes oficiais|https?:\/\//i.test(t.notes))).toBe(true);
  });

  it("gera etapas de Informática e Raciocínio Lógico em texto corrido", () => {
    const sample = `
CONTEÚDO PROGRAMÁTICO
Informática
09 questões:
MS-Windows 10 ou superior: conceitos de pastas, diretórios, arquivos, atalhos, área de trabalho, área de transferência, manipulação de arquivos e pastas, uso dos menus, programas e aplicativos. Microsoft 365: interação com o conjunto de aplicativos. MS-Word: estrutura básica dos documentos, edição e formatação de textos, cabeçalhos, parágrafos, fontes, colunas, marcadores simbólicos e numéricos, tabelas, impressão, controle de quebras e numeração de páginas, legendas, índices, inserção de objetos, campos predefinidos, caixas de texto. MS-Excel: estrutura básica das planilhas, conceitos de células, linhas, colunas, pastas e gráficos, elaboração de tabelas e gráficos, uso de fórmulas, funções e macros, impressão, inserção de objetos, campos predefinidos, controle de quebras e numeração de páginas, obtenção de dados externos, classificação de dados. Correio Eletrônico: uso de correio eletrônico, preparo e envio de mensagens, anexação de arquivos. Internet: navegação internet, conceitos de URL, links, sites, busca e impressão de páginas. MS Teams: chats, chamadas de áudio e vídeo, criação de grupos, trabalho em equipe (Word, Excel, PowerPoint, SharePoint e OneNote), agendamento de reuniões e gravação. OneDrive: armazenamento e compartilhamento de arquivos.

Raciocínio Lógico
07 questões:
Compreensão de estrutura lógica de relações arbitrárias entre pessoas, lugares, coisas ou eventos fictícios; deduzir novas informações das relações fornecidas e avaliar as condições usadas para estabelecer a estrutura daquelas relações. Identificar regularidades como a indicação de elementos de uma sequência (numérica ou figural) para indicar o elemento que deveria ocupar determinada posição na referida sequência. As questões da prova poderão tratar das seguintes áreas: estruturas lógicas; lógica da argumentação; diagramas lógicos; sequências.
`;
    const r = extractProgramFromEditalText(sample);
    const info = r.subjects.find((s) => /inform/i.test(s.name));
    const logic = r.subjects.find((s) => /racioc|l[oó]gic/i.test(s.name));
    expect(info).toBeTruthy();
    expect(logic).toBeTruthy();
    expect(info!.topics.length).toBeGreaterThanOrEqual(5);
    expect(info!.topics.some((t) => /Windows/i.test(t.name))).toBe(true);
    expect(info!.topics.some((t) => /Word/i.test(t.name))).toBe(true);
    expect(info!.topics.some((t) => /Excel/i.test(t.name))).toBe(true);
    expect(logic!.topics.length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Lei seca do edital TJSP Escrevente (VUNESP) — fontes oficiais.
 * Lista montada a partir das fontes usadas no banco de questões e no Quest.
 * Confira com o edital vigente e acrescente o que faltar.
 *
 * `keywords` ajuda a escolher a lei certa quando a pergunta não cita o diploma.
 */
export type LegalSource = {
  id: string;
  name: string;
  url: string;
  format: "html" | "pdf";
  keywords: string[];
};

export const LEGAL_SOURCES: LegalSource[] = [
  {
    id: "cf88",
    name: "Constituição Federal de 1988",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    format: "html",
    keywords: ["constituição", "constitucional", "direitos fundamentais", "poder judiciário", "cf"],
  },
  {
    id: "cp",
    name: "Código Penal (Decreto-Lei 2.848/1940)",
    url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
    format: "html",
    keywords: ["penal", "crime", "peculato", "concussão", "corrupção", "prevaricação", "pena"],
  },
  {
    id: "cpp",
    name: "Código de Processo Penal (Decreto-Lei 3.689/1941)",
    url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
    format: "html",
    keywords: ["processo penal", "inquérito", "citação", "intimação", "ação penal", "cpp"],
  },
  {
    id: "cpc",
    name: "Código de Processo Civil (Lei 13.105/2015)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
    format: "html",
    keywords: [
      "processo civil",
      "cpc",
      "prazo",
      "citação",
      "intimação",
      "escrivão",
      "chefe de secretaria",
    ],
  },
  {
    id: "l9099",
    name: "Lei 9.099/1995 (Juizados Especiais)",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l9099.htm",
    format: "html",
    keywords: ["juizado especial", "juizados", "9.099", "transação penal", "conciliação"],
  },
  {
    id: "l12153",
    name: "Lei 12.153/2009 (Juizados da Fazenda Pública)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12153.htm",
    format: "html",
    keywords: ["fazenda pública", "12.153", "juizado da fazenda"],
  },
  {
    id: "l8429",
    name: "Lei 8.429/1992 (Improbidade Administrativa)",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm",
    format: "html",
    keywords: ["improbidade", "8.429", "enriquecimento ilícito", "dano ao erário"],
  },
  {
    id: "l13146",
    name: "Lei 13.146/2015 (Estatuto da Pessoa com Deficiência)",
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm",
    format: "html",
    keywords: ["pessoa com deficiência", "13.146", "acessibilidade", "inclusão"],
  },
  {
    id: "l6830",
    name: "Lei 6.830/1980 (Execução Fiscal)",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l6830.htm",
    format: "html",
    keywords: ["execução fiscal", "dívida ativa", "6.830"],
  },
  {
    id: "sp-l10261",
    name: "Lei SP 10.261/1968 (Estatuto dos Funcionários Públicos Civis do Estado de SP)",
    url: "https://www.al.sp.gov.br/repositorio/legislacao/lei/1968/compilacao-lei-10261-28.10.1968.html",
    format: "html",
    keywords: [
      "funcionário público",
      "estatuto",
      "10.261",
      "servidor estadual",
      "licença",
      "férias",
    ],
  },
  {
    id: "sp-l11608",
    name: "Lei SP 11.608/2003 (Taxa Judiciária)",
    url: "https://www.al.sp.gov.br/repositorio/legislacao/lei/2003/compilacao-lei-11608-29.12.2003.html",
    format: "html",
    keywords: ["taxa judiciária", "custas", "11.608"],
  },
  {
    id: "tjsp-nscgj",
    name: "Normas de Serviço da Corregedoria Geral da Justiça (TJSP)",
    url: "https://api.tjsp.jus.br/Handlers/Handler/FileFetch.ashx?codigo=131806",
    format: "pdf",
    keywords: ["normas da corregedoria", "nscgj", "corregedoria", "cartório", "ofício judicial"],
  },
  {
    id: "sp-lc1111",
    name: "Lei Complementar SP nº 1.111/2010 (Plano de Cargos e Carreiras do TJSP)",
    url: "https://www.al.sp.gov.br/repositorio/legislacao/lei.complementar/2010/compilacao-lei.complementar-1111-25.05.2010.html",
    format: "html",
    keywords: ["1.111", "plano de cargos", "carreira", "escrevente técnico"],
  },
  {
    id: "tjsp-regimento",
    name: "Regimento Interno do Tribunal de Justiça de São Paulo",
    url: "https://www.tjsp.jus.br/Download/Portal/Biblioteca/Biblioteca/Legislacao/RegimentoInternoTJSP.pdf",
    format: "pdf",
    keywords: ["regimento interno", "órgão especial", "câmaras", "presidente do tribunal"],
  },
  {
    // Página do e-SAJ (Vue): se o ingest não conseguir ler o HTML, baixe o PDF e use --only.
    id: "tjsp-res850",
    name: "Resolução TJSP nº 850/2021 (teletrabalho)",
    url: "https://esaj.tjsp.jus.br/gcn-frontend-vue/legislacao/find/196070",
    format: "html",
    keywords: ["teletrabalho", "850/2021", "trabalho remoto"],
  },
  {
    id: "tjsp-res963",
    name: "Resolução TJSP nº 963/2025 (eproc)",
    url: "https://esaj.tjsp.jus.br/gcn-frontend-vue/legislacao/find/229313",
    format: "html",
    keywords: ["eproc", "963/2025", "processo eletrônico"],
  },
];

/** Escolhe leis prováveis pela pergunta (para filtrar a busca). */
export function guessLawIds(query: string): string[] {
  const q = query.toLowerCase();
  return LEGAL_SOURCES.filter((l) => l.keywords.some((k) => q.includes(k))).map((l) => l.id);
}

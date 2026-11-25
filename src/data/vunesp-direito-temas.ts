/**
 * Assuntos de Direito cobrados pela VUNESP nas provas oficiais de
 * Escrevente Técnico Judiciário do TJSP (2018, 2021, 2023, 2024, 2025).
 *
 * Classificação feita à mão, questão a questão, a partir do enunciado e das
 * alternativas (o JSON das provas só traz a matéria, sem o assunto).
 * Os ids abaixo são sufixos de `tjsp-oficial-<ano>-q<nº>`.
 */

export type VunespTema = {
  id: string;
  name: string;
  /** Base legal para o aluno revisar. */
  base: string;
  questionIds: string[];
};

export type VunespArea = {
  id: string;
  name: string;
  temas: VunespTema[];
};

const ids = (...s: string[]) => s.map((x) => `tjsp-oficial-${x}`);

export const VUNESP_DIREITO_AREAS: VunespArea[] = [
  {
    id: "penal",
    name: "Direito Penal",
    temas: [
      {
        id: "penal-falsidade",
        name: "Falsificação de papéis, selos e documentos",
        base: "CP, arts. 293 a 305",
        questionIds: ids(
          "2018-q025",
          "2021-q025",
          "2021-q026",
          "2021-q027",
          "2023-q025",
          "2024-q025",
          "2024-q026",
          "2025-q017",
        ),
      },
      {
        id: "penal-falsa-identidade",
        name: "Falsa identidade e fraude em certames",
        base: "CP, arts. 307, 308 e 311-A",
        questionIds: ids(
          "2018-q026",
          "2021-q028",
          "2021-q029",
          "2023-q026",
          "2023-q027",
          "2024-q027",
          "2025-q018",
        ),
      },
      {
        id: "penal-funcionario",
        name: "Crimes de funcionário público contra a Administração",
        base: "CP, arts. 312 a 327 (peculato, concussão, excesso de exação, condescendência…)",
        questionIds: ids("2018-q027", "2023-q028", "2024-q028", "2025-q019", "2025-q020"),
      },
      {
        id: "penal-justica",
        name: "Crimes contra a Administração da Justiça",
        base: "CP, arts. 338 a 359 (autoacusação falsa, exploração de prestígio…)",
        questionIds: ids("2018-q029", "2018-q030", "2021-q030", "2023-q030", "2024-q030"),
      },
      {
        id: "penal-particular",
        name: "Crimes de particular contra a Administração",
        base: "CP, arts. 328 a 337-A (usurpação, resistência, desacato…)",
        questionIds: ids("2018-q028", "2023-q029", "2024-q029"),
      },
    ],
  },
  {
    id: "processo-penal",
    name: "Direito Processual Penal",
    temas: [
      {
        id: "pp-procedimento",
        name: "Procedimento comum (ordinário e sumário)",
        base: "CPP, arts. 394 a 405 e 531 a 538",
        questionIds: ids(
          "2018-q034",
          "2021-q033",
          "2021-q035",
          "2023-q034",
          "2023-q035",
          "2024-q035",
          "2025-q024",
        ),
      },
      {
        id: "pp-impedimento",
        name: "Impedimento, suspeição e incompatibilidade",
        base: "CPP, arts. 252 a 256 e 274",
        questionIds: ids(
          "2018-q031",
          "2021-q031",
          "2023-q031",
          "2024-q031",
          "2024-q033",
          "2025-q021",
        ),
      },
      {
        id: "pp-citacao",
        name: "Citação e intimação do acusado",
        base: "CPP, arts. 351 a 372",
        questionIds: ids("2018-q033", "2021-q032", "2023-q033", "2024-q034", "2025-q023"),
      },
      {
        id: "pp-jecrim",
        name: "Juizado Especial Criminal",
        base: "Lei 9.099/95, arts. 60 a 83, 88 e 89",
        questionIds: ids("2018-q037", "2021-q037", "2023-q037", "2024-q037", "2025-q025"),
      },
      {
        id: "pp-acusado",
        name: "Acusado e defensor",
        base: "CPP, arts. 259 a 267",
        questionIds: ids("2018-q032", "2023-q032", "2024-q032", "2025-q022"),
      },
      {
        id: "pp-juri",
        name: "Tribunal do Júri",
        base: "CPP, arts. 406 a 497",
        questionIds: ids("2018-q035", "2021-q036", "2024-q036"),
      },
      {
        id: "pp-recursos",
        name: "Recursos no processo penal",
        base: "CPP, arts. 574 a 667",
        questionIds: ids("2018-q036", "2021-q034", "2023-q036"),
      },
    ],
  },
  {
    id: "processo-civil",
    name: "Direito Processual Civil",
    temas: [
      {
        id: "pc-jec",
        name: "Juizado Especial Cível",
        base: "Lei 9.099/95, arts. 1º a 59",
        questionIds: ids("2018-q039", "2021-q043", "2023-q043", "2024-q043", "2025-q029"),
      },
      {
        id: "pc-jefp",
        name: "Juizado Especial da Fazenda Pública",
        base: "Lei 12.153/2009",
        questionIds: ids("2018-q043", "2021-q044", "2023-q044", "2024-q044", "2025-q030"),
      },
      {
        id: "pc-recursos",
        name: "Recursos (embargos, agravo, preparo, multas)",
        base: "CPC, arts. 994 a 1.044",
        questionIds: ids("2018-q042", "2021-q042", "2023-q042", "2024-q041", "2024-q042"),
      },
      {
        id: "pc-juiz-auxiliares",
        name: "Juiz e auxiliares da justiça (deveres, prazos, impedimento)",
        base: "CPC, arts. 139 a 175 e 226 a 235",
        questionIds: ids("2018-q038", "2021-q038", "2023-q038", "2024-q038", "2024-q039"),
      },
      {
        id: "pc-tutela",
        name: "Tutela provisória (urgência e evidência)",
        base: "CPC, arts. 294 a 311",
        questionIds: ids("2018-q040", "2021-q040", "2023-q040", "2024-q040"),
      },
      {
        id: "pc-atos",
        name: "Atos processuais: tempo, lugar, citação e segredo de justiça",
        base: "CPC, arts. 188 a 275",
        questionIds: ids("2018-q041", "2021-q039", "2023-q039", "2025-q026"),
      },
      {
        id: "pc-sentenca",
        name: "Sentença, cumprimento e suspensão do processo",
        base: "CPC, arts. 313, 497 a 538 e 911",
        questionIds: ids("2023-q041", "2025-q027", "2025-q028"),
      },
      {
        id: "pc-inicial",
        name: "Petição inicial, pedido e improcedência liminar",
        base: "CPC, arts. 319 a 332",
        questionIds: ids("2018-q044", "2021-q041"),
      },
    ],
  },
  {
    id: "constitucional",
    name: "Direito Constitucional",
    temas: [
      {
        id: "cf-administracao",
        name: "Administração Pública e servidores",
        base: "CF, arts. 37 a 41",
        questionIds: ids(
          "2018-q048",
          "2021-q050",
          "2021-q051",
          "2023-q047",
          "2023-q049",
          "2023-q050",
          "2024-q049",
          "2024-q050",
          "2024-q051",
          "2025-q034",
        ),
      },
      {
        id: "cf-individuais",
        name: "Direitos e garantias individuais",
        base: "CF, art. 5º",
        questionIds: ids(
          "2018-q045",
          "2018-q046",
          "2021-q045",
          "2021-q046",
          "2024-q045",
          "2025-q031",
        ),
      },
      {
        id: "cf-remedios",
        name: "Remédios constitucionais (HC, MS, ação popular…)",
        base: "CF, art. 5º, LXVIII a LXXIII e LXXVII",
        questionIds: ids("2018-q050", "2018-q051", "2024-q046", "2024-q047", "2025-q032"),
      },
      {
        id: "cf-sociais",
        name: "Direitos sociais dos trabalhadores",
        base: "CF, arts. 6º a 11",
        questionIds: ids("2018-q049", "2021-q047", "2023-q048", "2024-q048", "2025-q035"),
      },
      {
        id: "cf-nacionalidade",
        name: "Nacionalidade",
        base: "CF, arts. 12 e 13",
        questionIds: ids("2018-q047", "2021-q048", "2021-q049", "2023-q045", "2025-q033"),
      },
      {
        id: "cf-organizacao",
        name: "Símbolos nacionais e Poder Judiciário",
        base: "CF, art. 13 e arts. 92 a 126",
        questionIds: ids("2023-q046", "2023-q051"),
      },
    ],
  },
  {
    id: "administrativo",
    name: "Direito Administrativo",
    temas: [
      {
        id: "adm-improbidade",
        name: "Improbidade administrativa",
        base: "Lei 8.429/92 (com a Lei 14.230/2021)",
        questionIds: ids(
          "2018-q056",
          "2018-q057",
          "2018-q058",
          "2018-q059",
          "2021-q057",
          "2021-q058",
          "2021-q059",
          "2023-q057",
          "2023-q059",
          "2024-q057",
          "2024-q058",
          "2024-q059",
          "2025-q039",
          "2025-q040",
          "2025-q041",
        ),
      },
      {
        id: "adm-processo",
        name: "Estatuto SP: processo administrativo, recursos e revisão",
        base: "Lei 10.261/68, arts. 264 a 323",
        questionIds: ids(
          "2018-q054",
          "2018-q055",
          "2021-q054",
          "2021-q055",
          "2021-q056",
          "2023-q054",
          "2023-q055",
          "2023-q056",
          "2024-q053",
          "2024-q055",
          "2024-q056",
        ),
      },
      {
        id: "adm-penalidades",
        name: "Estatuto SP: penalidades disciplinares e prescrição",
        base: "Lei 10.261/68, arts. 251 a 263",
        questionIds: ids(
          "2018-q052",
          "2018-q053",
          "2021-q053",
          "2023-q052",
          "2023-q053",
          "2024-q052",
          "2024-q054",
        ),
      },
      {
        id: "adm-estatuto-direitos",
        name: "Estatuto SP: posse, exercício, afastamentos e reintegração",
        base: "Lei 10.261/68, arts. 1º a 250",
        questionIds: ids("2021-q052", "2023-q058", "2025-q036", "2025-q037", "2025-q038"),
      },
    ],
  },
  {
    id: "normas-tjsp",
    name: "Normas da Corregedoria e Legislação do TJSP",
    temas: [
      {
        id: "nscgj-eletronico",
        name: "Processo eletrônico, protocolo e sistemas",
        base: "NSCGJ (Tomo I) — processo eletrônico e Sistema Informatizado Oficial",
        questionIds: ids(
          "2018-q060",
          "2018-q064",
          "2023-q061",
          "2023-q062",
          "2023-q063",
          "2023-q064",
          "2024-q062",
          "2024-q064",
          "2025-q042",
        ),
      },
      {
        id: "nscgj-escrituracao",
        name: "Escrituração, autos, mandados e ofícios",
        base: "NSCGJ (Tomo I) — ofícios de justiça",
        questionIds: ids(
          "2018-q061",
          "2018-q062",
          "2018-q063",
          "2021-q062",
          "2021-q063",
          "2021-q064",
          "2024-q061",
          "2024-q063",
          "2025-q046",
        ),
      },
      {
        id: "nscgj-correicoes",
        name: "Correições e apuração disciplinar",
        base: "NSCGJ (Tomo I) — correições",
        questionIds: ids("2021-q060", "2021-q061", "2023-q060", "2024-q060"),
      },
      {
        id: "tjsp-legislacao",
        name: "Regimento Interno, LC 1.111/2010 e teletrabalho",
        base: "RITJSP, LC estadual 1.111/2010 e normas de teletrabalho",
        questionIds: ids("2025-q043", "2025-q044", "2025-q045"),
      },
    ],
  },
];

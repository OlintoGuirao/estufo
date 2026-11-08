import type { QuestPhase } from "@/types/tjsp-quest";
import { editalPhase } from "./lesson";

/**
 * Expansão do catálogo para cobrir o edital TJSP Escrevente (Blocos I–III)
 * com trilhas 1…N + Chefão. Conteúdo pleno é gerado por IA na 1ª visita.
 */
export const editalExpandPhases: QuestPhase[] = [
  // —— Direito Penal ——
  editalPhase({
    id: "penal-2",
    subjectId: "penal",
    number: 2,
    title: "Crimes contra a Administração Pública",
    objective:
      "Dominar peculato, concussão, corrupção, prevaricação e correlatos (CP arts. 312–317, 319–333, 336 e 337).",
    unlockRequiresPhaseIds: ["penal-1"],
    sources: [
      {
        label: "CP — arts. 312 a 317; 319 a 333; 336 e 337",
        url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
      },
    ],
  }),
  editalPhase({
    id: "penal-3",
    subjectId: "penal",
    number: 3,
    title: "Administração da Justiça e crimes correlatos",
    objective:
      "Aplicar tipificações dos arts. 339 a 347, 357 e 359 do CP (denunciação caluniosa, falso testemunho, fuga, etc.).",
    unlockRequiresPhaseIds: ["penal-2"],
    sources: [
      {
        label: "CP — arts. 339 a 347; 357 e 359",
        url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
      },
    ],
  }),
  editalPhase({
    id: "penal-4",
    subjectId: "penal",
    number: 4,
    title: "Chefão — Direito Penal integrado",
    objective:
      "Revisar todo o recorte penal do edital: fé pública, Administração Pública e Administração da Justiça.",
    unlockRequiresPhaseIds: ["penal-3"],
    sources: [{ label: "Edital TJSP — Bloco II item 1 Direito Penal (CP)" }],
    estimatedMinutes: 16,
  }),

  // —— Processo Penal ——
  editalPhase({
    id: "procpen-2",
    subjectId: "procpen",
    number: 2,
    title: "Procedimentos penais",
    objective:
      "Dominar procedimento comum e especiais (CPP arts. 394 a 497; 531 a 538; 541 a 548).",
    unlockRequiresPhaseIds: ["procpen-1"],
    sources: [
      {
        label: "CPP — arts. 394–497; 531–538; 541–548",
        url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm",
      },
    ],
  }),
  editalPhase({
    id: "procpen-3",
    subjectId: "procpen",
    number: 3,
    title: "Recursos e Juizado Criminal",
    objective:
      "Aplicar recursos no CPP (arts. 574 a 667) e Lei 9.099/95 (arts. 60 a 83; 88 e 89).",
    unlockRequiresPhaseIds: ["procpen-2"],
    sources: [
      {
        label: "CPP arts. 574–667 · Lei 9.099/95 arts. 60–83, 88 e 89",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l9099.htm",
      },
    ],
  }),
  editalPhase({
    id: "procpen-4",
    subjectId: "procpen",
    number: 4,
    title: "Chefão — Processo Penal integrado",
    objective:
      "Integrar sujeitos, atos, procedimentos, recursos e Juizado Criminal do edital.",
    unlockRequiresPhaseIds: ["procpen-3"],
    sources: [{ label: "Edital TJSP — Bloco II item 2 Processo Penal" }],
    estimatedMinutes: 16,
  }),

  // —— Processo Civil ——
  editalPhase({
    id: "procciv-2",
    subjectId: "procciv",
    number: 2,
    title: "Procedimento comum e recursos (CPC)",
    objective:
      "Aplicar procedimento comum e recursos (CPC arts. 318 a 538; 994 a 1026).",
    unlockRequiresPhaseIds: ["procciv-1"],
    sources: [
      {
        label: "CPC — arts. 318–538; 994–1026",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
      },
    ],
  }),
  editalPhase({
    id: "procciv-3",
    subjectId: "procciv",
    number: 3,
    title: "Juizados Cíveis e da Fazenda",
    objective:
      "Dominar Lei 9.099/95 (arts. 3º ao 19) e Lei 12.153/2009 (Juizados da Fazenda Pública).",
    unlockRequiresPhaseIds: ["procciv-2"],
    sources: [
      {
        label: "Lei 9.099/95 arts. 3º–19 · Lei 12.153/2009",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12153.htm",
      },
    ],
  }),
  editalPhase({
    id: "procciv-4",
    subjectId: "procciv",
    number: 4,
    title: "Chefão — Processo Civil integrado",
    objective:
      "Revisar atos, tutelas, procedimento, recursos e Juizados do recorte civil do edital.",
    unlockRequiresPhaseIds: ["procciv-3"],
    sources: [{ label: "Edital TJSP — Bloco II item 3 Processo Civil" }],
    estimatedMinutes: 16,
  }),

  // —— Administrativo ——
  editalPhase({
    id: "admin-2",
    subjectId: "admin",
    number: 2,
    title: "Improbidade administrativa",
    objective:
      "Aplicar a Lei 8.429/92 (atos de improbidade, sujeitos e sanções na redação vigente).",
    unlockRequiresPhaseIds: ["admin-1"],
    sources: [
      {
        label: "Lei 8.429/92 — Improbidade Administrativa",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm",
      },
    ],
  }),
  editalPhase({
    id: "admin-3",
    subjectId: "admin",
    number: 3,
    title: "Chefão — Administrativo integrado",
    objective:
      "Integrar Estatuto estadual (Lei 10.261/68) e improbidade (Lei 8.429/92).",
    unlockRequiresPhaseIds: ["admin-2"],
    sources: [{ label: "Edital TJSP — Bloco II item 5 Direito Administrativo" }],
    estimatedMinutes: 14,
  }),

  // —— Legislação Interna ——
  editalPhase({
    id: "legis-2",
    subjectId: "legis",
    number: 2,
    title: "Carreira e Regimento Interno",
    objective:
      "Dominar LC 1.111/2010 (Plano de Cargos e Carreiras) e o Regimento Interno do TJSP.",
    unlockRequiresPhaseIds: ["legis-1"],
    sources: [
      { label: "LC 1.111/2010 — Plano de Cargos e Carreiras do TJSP" },
      {
        label: "Regimento Interno do TJSP",
        url: "https://www.tjsp.jus.br/Download/Portal/Biblioteca/Biblioteca/Legislacao/RegimentoInternoTJSP.pdf",
      },
    ],
  }),
  editalPhase({
    id: "legis-3",
    subjectId: "legis",
    number: 3,
    title: "Normas da Corregedoria (CGJ)",
    objective:
      "Aplicar as Normas da CGJ, Tomo I: Cap. II (Seção I, Subs. I e II); Cap. III (Seções I, II, V, VI, VII; Seção VIII, Subs. I a III; Seções IX a XIX); Cap. XI (Seções I a VII).",
    unlockRequiresPhaseIds: ["legis-2"],
    sources: [
      {
        label: "Normas da CGJ — Tomo I (Caps. II, III e XI)",
        url: "https://www.tjsp.jus.br/Corregedoria/Comunicados/NormasJudiciais",
      },
    ],
  }),
  editalPhase({
    id: "legis-4",
    subjectId: "legis",
    number: 4,
    title: "Chefão — Legislação interna integrada",
    objective:
      "Integrar teletrabalho (850/2021), eproc (963/2025), carreira, Regimento e Normas da CGJ.",
    unlockRequiresPhaseIds: ["legis-3"],
    sources: [{ label: "Edital TJSP — Bloco II item 6 Legislação Interna" }],
    estimatedMinutes: 14,
  }),

  // —— Atualidades ——
  editalPhase({
    id: "atual-2",
    subjectId: "atual",
    number: 2,
    title: "Atualidades (1º semestre/2026)",
    objective:
      "Treinar fatos políticos, econômicos, sociais e culturais (nacionais e internacionais) a partir do 1º semestre de 2026.",
    unlockRequiresPhaseIds: ["atual-1"],
    sources: [{ label: "Edital TJSP — Atualidades (mídia local/nacional, 1º sem/2026)" }],
  }),
  editalPhase({
    id: "atual-3",
    subjectId: "atual",
    number: 3,
    title: "Chefão — Atualidades e PCD",
    objective:
      "Integrar Lei 13.146/2015 (arts. 1º–13 e 34–38) com atualidades do período do edital.",
    unlockRequiresPhaseIds: ["atual-2"],
    sources: [
      {
        label: "Lei 13.146/2015 · Atualidades 1º sem/2026",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm",
      },
    ],
  }),

  // —— Matemática ——
  editalPhase({
    id: "mat-3",
    subjectId: "mat",
    number: 3,
    title: "Médias, medidas e situações-problema",
    objective:
      "Resolver médias aritmética simples/ponderada, relação entre grandezas em tabelas e gráficos, sistemas de medidas usuais e situações-problema.",
    unlockRequiresPhaseIds: ["mat-2"],
    sources: [{ label: "Edital TJSP — Matemática itens 6, 10, 11 e 13" }],
  }),
  editalPhase({
    id: "mat-4",
    subjectId: "mat",
    number: 4,
    title: "Chefão — Matemática integrada",
    objective:
      "Integrar os 13 itens: reais, MMC/MDC, razão/proporção, %, regra de três, médias, juros simples, equações, sistemas, tabelas/gráficos, medidas, geometria e situações-problema.",
    unlockRequiresPhaseIds: ["mat-3"],
    sources: [{ label: "Edital TJSP — Bloco III Matemática (itens 1–13)" }],
    estimatedMinutes: 16,
  }),

  // —— Informática (edital: 9 questões · 7 temas + chefão) ——
  editalPhase({
    id: "info-1",
    subjectId: "info",
    number: 1,
    title: "Windows 10+",
    objective:
      "Dominar pastas, diretórios, arquivos, atalhos, área de trabalho, área de transferência, manipulação de arquivos/pastas e uso de menus/programas (Windows 10 ou superior).",
    unlockRequiresPhaseIds: [],
    sources: [{ label: "Edital TJSP — Informática item 1: MS-Windows 10+" }],
  }),
  editalPhase({
    id: "info-2",
    subjectId: "info",
    number: 2,
    title: "Microsoft Word",
    objective:
      "Aplicar estrutura do documento, edição/formatação, cabeçalhos, parágrafos, fontes, colunas, marcadores, tabelas, impressão, quebras, numeração, legendas, índices, objetos, campos e caixas de texto.",
    unlockRequiresPhaseIds: ["info-1"],
    sources: [{ label: "Edital TJSP — Informática item 2: MS-Word" }],
  }),
  editalPhase({
    id: "info-3",
    subjectId: "info",
    number: 3,
    title: "Microsoft Excel",
    objective:
      "Dominar células, linhas, colunas, pastas, tabelas, gráficos, fórmulas, funções, macros, impressão, objetos, campos, quebras, dados externos e classificação.",
    unlockRequiresPhaseIds: ["info-2"],
    sources: [{ label: "Edital TJSP — Informática item 3: MS-Excel" }],
  }),
  editalPhase({
    id: "info-4",
    subjectId: "info",
    number: 4,
    title: "Correio eletrônico",
    objective:
      "Usar correio eletrônico: preparar e enviar mensagens e anexar arquivos.",
    unlockRequiresPhaseIds: ["info-3"],
    sources: [{ label: "Edital TJSP — Informática item 4: Correio eletrônico" }],
  }),
  editalPhase({
    id: "info-5",
    subjectId: "info",
    number: 5,
    title: "Internet",
    objective:
      "Navegar na internet com domínio de URL, links, sites, busca e impressão de páginas.",
    unlockRequiresPhaseIds: ["info-4"],
    sources: [{ label: "Edital TJSP — Informática item 5: Internet" }],
  }),
  editalPhase({
    id: "info-6",
    subjectId: "info",
    number: 6,
    title: "Microsoft Teams",
    objective:
      "Usar chats, chamadas de áudio/vídeo, grupos, colaboração (Word, Excel, PowerPoint, SharePoint, OneNote), agendamento e gravação de reuniões.",
    unlockRequiresPhaseIds: ["info-5"],
    sources: [{ label: "Edital TJSP — Informática item 6: MS Teams" }],
  }),
  editalPhase({
    id: "info-7",
    subjectId: "info",
    number: 7,
    title: "OneDrive",
    objective:
      "Armazenar e compartilhar arquivos na nuvem com OneDrive (permissões e sincronização).",
    unlockRequiresPhaseIds: ["info-6"],
    sources: [{ label: "Edital TJSP — Informática item 7: OneDrive" }],
  }),
  editalPhase({
    id: "info-8",
    subjectId: "info",
    number: 8,
    title: "Chefão — Informática integrada",
    objective:
      "Integrar Windows, Word, Excel, e-mail, Internet, Teams e OneDrive no padrão VUNESP do edital.",
    unlockRequiresPhaseIds: ["info-7"],
    sources: [{ label: "Edital TJSP — Bloco III Informática (itens 1–7)" }],
    estimatedMinutes: 16,
  }),

  // —— Raciocínio Lógico (edital: 7 questões · 4 temas + chefão) ——
  editalPhase({
    id: "rlm-1",
    subjectId: "rlm",
    number: 1,
    title: "Estruturas lógicas e relações",
    objective:
      "Entender relações arbitrárias entre pessoas, lugares, coisas e eventos; deduzir informações e avaliar as condições da estrutura.",
    unlockRequiresPhaseIds: [],
    sources: [{ label: "Edital TJSP — RLM item 1: estruturas lógicas e relações" }],
  }),
  editalPhase({
    id: "rlm-2",
    subjectId: "rlm",
    number: 2,
    title: "Lógica de argumentação",
    objective:
      "Analisar e avaliar argumentos lógicos (validade, premissas e conclusão).",
    unlockRequiresPhaseIds: ["rlm-1"],
    sources: [{ label: "Edital TJSP — RLM item 2: lógica de argumentação" }],
  }),
  editalPhase({
    id: "rlm-3",
    subjectId: "rlm",
    number: 3,
    title: "Diagramas lógicos",
    objective:
      "Representar e analisar relações por diagramas (todos/alguns/nenhum e correlatos).",
    unlockRequiresPhaseIds: ["rlm-2"],
    sources: [{ label: "Edital TJSP — RLM item 3: diagramas lógicos" }],
  }),
  editalPhase({
    id: "rlm-4",
    subjectId: "rlm",
    number: 4,
    title: "Sequências",
    objective:
      "Identificar regularidades em sequências numéricas ou figurais e achar o elemento de uma posição dada.",
    unlockRequiresPhaseIds: ["rlm-3"],
    sources: [{ label: "Edital TJSP — RLM item 4: sequências" }],
  }),
  editalPhase({
    id: "rlm-5",
    subjectId: "rlm",
    number: 5,
    title: "Chefão — Raciocínio lógico integrado",
    objective:
      "Integrar estruturas/relações, argumentação, diagramas e sequências do edital.",
    unlockRequiresPhaseIds: ["rlm-4"],
    sources: [{ label: "Edital TJSP — Bloco III Raciocínio Lógico (itens 1–4)" }],
    estimatedMinutes: 14,
  }),
];

import type { QuestCatalog, QuestPhase, QuestSubject } from "@/types/tjsp-quest";
import { buildLessonBlocks, phase, q } from "@/data/tjsp-quest/lesson";
import { portPhases } from "@/data/tjsp-quest/phases-port";
import { constExtraPhases } from "@/data/tjsp-quest/phases-const-extra";
import { direitoPhases } from "@/data/tjsp-quest/phases-direito";
import { geraisPhases } from "@/data/tjsp-quest/phases-gerais";
import { editalExpandPhases } from "@/data/tjsp-quest/phases-edital-expand";

/**
 * Catálogo TJSP Quest — metadados das fases (título, objetivo, fontes, unlock).
 * Material da aula + questões são gerados por IA no padrão VUNESP (A–E) na primeira
 * visita à fase (cache local). O conteúdo estático abaixo serve de fallback/mock.
 * Trilhas alinhadas ao edital TJSP Escrevente (Blocos I–III).
 */

const subjects: QuestSubject[] = [
  {
    id: "port",
    name: "Língua Portuguesa",
    shortName: "Português",
    color: "#9b2226",
    icon: "pen",
    description: "Bloco I — interpretação, classes, sintaxe, semântica e pontuação (16 q).",
    phaseIds: ["port-1", "port-2", "port-3", "port-4", "port-5", "port-6"],
  },
  {
    id: "const",
    name: "Direito Constitucional",
    shortName: "Constitucional",
    color: "#e85d04",
    icon: "scale",
    description: "Título II Caps. I–III; Título III Cap. VII Seções I–II; art. 92.",
    phaseIds: ["const-1", "const-2", "const-3", "const-4"],
  },
  {
    id: "penal",
    name: "Direito Penal",
    shortName: "Penal",
    color: "#6a040f",
    icon: "gavel",
    description: "CP — fé pública, Administração Pública e Administração da Justiça.",
    phaseIds: ["penal-1", "penal-2", "penal-3", "penal-4"],
  },
  {
    id: "procpen",
    name: "Processo Penal",
    shortName: "Proc. Penal",
    color: "#370617",
    icon: "gavel",
    description: "CPP (sujeitos, rito, recursos) e Juizado Criminal (Lei 9.099/95).",
    phaseIds: ["procpen-1", "procpen-2", "procpen-3", "procpen-4"],
  },
  {
    id: "procciv",
    name: "Processo Civil",
    shortName: "Proc. Civil",
    color: "#03045e",
    icon: "landmark",
    description: "CPC, Lei 9.099/95 (cível) e Lei 12.153/2009.",
    phaseIds: ["procciv-1", "procciv-2", "procciv-3", "procciv-4"],
  },
  {
    id: "admin",
    name: "Direito Administrativo",
    shortName: "Administrativo",
    color: "#7b2cbf",
    icon: "landmark",
    description: "Lei 10.261/68 (Estatuto) e Lei 8.429/92 (improbidade).",
    phaseIds: ["admin-1", "admin-2", "admin-3"],
  },
  {
    id: "legis",
    name: "Legislação Interna",
    shortName: "Legislação",
    color: "#5a189a",
    icon: "book",
    description: "Res. 850 e 963, LC 1.111/2010, Regimento e Normas da CGJ.",
    phaseIds: ["legis-1", "legis-2", "legis-3", "legis-4"],
  },
  {
    id: "atual",
    name: "Atualidades e PCD",
    shortName: "Atualidades",
    color: "#2d6a4f",
    icon: "globe",
    description: "Lei 13.146/2015 e atualidades do 1º semestre/2026.",
    phaseIds: ["atual-1", "atual-2", "atual-3"],
  },
  {
    id: "mat",
    name: "Matemática",
    shortName: "Matemática",
    color: "#0077b6",
    icon: "calculator",
    description: "Operações, %, juros, equações, geometria e situações-problema.",
    phaseIds: ["mat-1", "mat-2", "mat-3", "mat-4"],
  },
  {
    id: "info",
    name: "Informática",
    shortName: "Informática",
    color: "#00b4d8",
    icon: "monitor",
    description: "Windows, Word, Excel, e-mail, Internet, Teams e OneDrive (9 q).",
    phaseIds: [
      "info-1",
      "info-2",
      "info-3",
      "info-4",
      "info-5",
      "info-6",
      "info-7",
      "info-8",
    ],
  },
  {
    id: "rlm",
    name: "Raciocínio Lógico",
    shortName: "Lógica",
    color: "#2a9d8f",
    icon: "calculator",
    description: "Estruturas, argumentação, diagramas e sequências (7 q).",
    phaseIds: ["rlm-1", "rlm-2", "rlm-3", "rlm-4", "rlm-5"],
  },
];

const const1: QuestPhase = phase({
  id: "const-1",
  subjectId: "const",
  number: 1,
  title: "Direitos individuais e coletivos",
  objective:
    "Dominar o Título II, Cap. I da CF (direitos e deveres individuais e coletivos) — núcleo cobrado no edital do TJSP.",
  estimatedMinutes: 12,
  conceptsCount: 5,
  unlockRequiresPhaseIds: [],
  sources: [
    {
      label: "Constituição Federal — art. 1º (Planalto)",
      url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    },
  ],
  lessonBlocks: buildLessonBlocks({
    prefix: "c1",
    contexto:
      "Todo país precisa dizer em que pilares se apoia. No Brasil, esses pilares estão no art. 1º da Constituição Federal de 1988.",
    explicacao:
      "Fundamento = base. Imagine a República como um prédio: o art. 1º lista as colunas. Você vai memorizar a lista e entender o sentido de cada item.",
    baseLegal: "CF/1988, Título I — art. 1º, caput e incisos I a V, e parágrafo único.",
    textoLegal:
      "“A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos: I – a soberania; II – a cidadania; III – a dignidade da pessoa humana; IV – os valores sociais do trabalho e da livre iniciativa; V – o pluralismo político. Parágrafo único. Todo o poder emana do povo…”",
    traducao:
      "Soberania, cidadania, dignidade, valores do trabalho/livre iniciativa e pluralismo político. O poder emana do povo.",
    exemplo:
      "Quando você vota, exerce cidadania. Quando a lei proíbe tortura, protege a dignidade da pessoa humana.",
    prova:
      "Não misture fundamentos (art. 1º) com objetivos (art. 3º) ou princípios das relações internacionais (art. 4º).",
    memorizar: "SO-CI-DI-VA-PLU. Poder emana do povo (parágrafo único).",
    miniRevisao:
      "1) Quantos fundamentos? (5) 2) Poder emana do povo onde? (Parágrafo único) 3) Objetivos? (Art. 3º)",
  }),
  questions: [
    q({
      id: "c1-q1",
      difficulty: "facil",
      statement:
        "Segundo o art. 1º da Constituição Federal, são fundamentos da República Federativa do Brasil, EXCETO:",
      alternatives: [
        { key: "A", text: "A soberania" },
        { key: "B", text: "A cidadania" },
        { key: "C", text: "A dignidade da pessoa humana" },
        { key: "D", text: "A separação dos Poderes" },
      ],
      correctKey: "D",
      legalBasis: "CF/1988, art. 1º, I a V",
      whyCorrect: "A separação dos Poderes é princípio do art. 2º, não fundamento do art. 1º.",
      whyWrong: {
        A: "Fundamento (inciso I).",
        B: "Fundamento (inciso II).",
        C: "Fundamento (inciso III).",
      },
      memoryTip: "Art. 1º = fundamentos; art. 2º = Poderes.",
    }),
    q({
      id: "c1-q2",
      difficulty: "facil",
      statement: "O parágrafo único do art. 1º da CF estabelece que:",
      alternatives: [
        { key: "A", text: "Todo o poder emana do Presidente da República" },
        { key: "B", text: "Todo o poder emana do povo" },
        { key: "C", text: "Todo o poder emana do Congresso Nacional" },
        { key: "D", text: "Todo o poder emana do Supremo Tribunal Federal" },
      ],
      correctKey: "B",
      legalBasis: "CF/1988, art. 1º, parágrafo único",
      whyCorrect: "O texto diz que todo o poder emana do povo.",
      whyWrong: {
        A: "Não é o que diz o parágrafo único.",
        C: "O Congresso representa, mas o poder emana do povo.",
        D: "O STF não é a fonte do poder nesse dispositivo.",
      },
    }),
    q({
      id: "c1-q3",
      difficulty: "media",
      statement:
        "A República Federativa do Brasil constitui-se em Estado Democrático de Direito e tem como um de seus fundamentos:",
      alternatives: [
        { key: "A", text: "O pluralismo político" },
        { key: "B", text: "A construção de uma sociedade livre, justa e solidária" },
        { key: "C", text: "A prevalência dos direitos humanos nas relações internacionais" },
        { key: "D", text: "A independência nacional" },
      ],
      correctKey: "A",
      legalBasis: "CF/1988, art. 1º, V",
      whyCorrect: "Pluralismo político é fundamento (inciso V).",
      whyWrong: {
        B: "Objetivo fundamental (art. 3º, I).",
        C: "Relações internacionais (art. 4º).",
        D: "Também art. 4º.",
      },
    }),
    q({
      id: "c1-q4",
      difficulty: "media",
      statement: "Os valores sociais do trabalho e da livre iniciativa:",
      alternatives: [
        { key: "A", text: "Não constam da Constituição" },
        { key: "B", text: "São objetivos fundamentais do art. 3º" },
        { key: "C", text: "São fundamentos da República no art. 1º" },
        { key: "D", text: "Aplicam-se apenas ao Direito do Trabalho infraconstitucional" },
      ],
      correctKey: "C",
      legalBasis: "CF/1988, art. 1º, IV",
      whyCorrect: "Estão no inciso IV do art. 1º.",
      whyWrong: {
        A: "Constam do art. 1º, IV.",
        B: "Não estão no rol do art. 3º.",
        D: "Têm status constitucional de fundamento.",
      },
    }),
  ],
  bossQuestions: [
    q({
      id: "c1-b-q1",
      difficulty: "dificil",
      statement:
        "Assinale a alternativa que elenca CORRETAMENTE apenas fundamentos da República previstos no art. 1º:",
      alternatives: [
        {
          key: "A",
          text: "Soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa, pluralismo político",
        },
        {
          key: "B",
          text: "Soberania, cidadania, dignidade da pessoa humana, separação dos Poderes, pluralismo político",
        },
        {
          key: "C",
          text: "Soberania, cidadania, erradicação da pobreza, dignidade da pessoa humana, pluralismo político",
        },
        {
          key: "D",
          text: "Independência nacional, cidadania, dignidade da pessoa humana, livre iniciativa, pluralismo político",
        },
      ],
      correctKey: "A",
      legalBasis: "CF/1988, art. 1º, I a V",
      whyCorrect: "Reproduz os cinco fundamentos.",
      whyWrong: {
        B: "Separação dos Poderes = art. 2º.",
        C: "Erradicação da pobreza = art. 3º.",
        D: "Independência nacional = art. 4º.",
      },
    }),
    q({
      id: "c1-b-q2",
      difficulty: "media",
      statement: "A união dos Estados, Municípios e Distrito Federal, segundo o art. 1º, é:",
      alternatives: [
        { key: "A", text: "Dissolúvel por plebiscito estadual" },
        { key: "B", text: "Indissolúvel" },
        { key: "C", text: "Temporária até nova Constituinte" },
        { key: "D", text: "Facultativa para os Municípios" },
      ],
      correctKey: "B",
      legalBasis: "CF/1988, art. 1º, caput",
      whyCorrect: "O caput fala em união indissolúvel.",
      whyWrong: {
        A: "Não há essa hipótese no art. 1º.",
        C: "Sem limitação temporal nesse dispositivo.",
        D: "Municípios integram a união indissolúvel.",
      },
    }),
    q({
      id: "c1-b-q3",
      difficulty: "dificil",
      statement: "O povo exerce o poder, nos termos do art. 1º, parágrafo único, por meio de:",
      alternatives: [
        { key: "A", text: "Apenas representantes eleitos" },
        { key: "B", text: "Apenas mecanismos diretos, como o referendo" },
        { key: "C", text: "Representantes eleitos ou diretamente, nos termos da Constituição" },
        { key: "D", text: "Decretos do Chefe do Executivo" },
      ],
      correctKey: "C",
      legalBasis: "CF/1988, art. 1º, parágrafo único",
      whyCorrect: "O texto admite representantes ou exercício direto.",
      whyWrong: {
        A: "Também há exercício direto.",
        B: "Também há representação.",
        D: "Não é o que diz o parágrafo único.",
      },
    }),
  ],
});

const const2: QuestPhase = phase({
  id: "const-2",
  subjectId: "const",
  number: 2,
  title: "Direitos sociais e nacionalidade",
  objective:
    "Aplicar Título II, Caps. II e III da CF: direitos sociais e nacionalidade (edital TJSP).",
  estimatedMinutes: 10,
  conceptsCount: 3,
  unlockRequiresPhaseIds: ["const-1"],
  sources: [
    {
      label: "Constituição Federal — art. 2º (Planalto)",
      url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
    },
  ],
  lessonBlocks: buildLessonBlocks({
    prefix: "c2",
    contexto:
      "Concentrar todo o poder em uma só mão é risco de abuso. A Constituição separa funções típicas em três Poderes.",
    explicacao:
      "Legislativo cria leis. Executivo administra. Judiciário julga. Independência com freios e contrapesos.",
    baseLegal: "CF/1988, art. 2º.",
    textoLegal:
      "“Art. 2º São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.”",
    traducao: "Três Poderes da União — independentes e harmônicos.",
    exemplo:
      "Congresso aprova lei; Presidente sanciona/aplica; juiz decide conflitos.",
    prova: "São três Poderes — não quatro com o MP.",
    memorizar: "Art. 2º = LEJ — independentes e harmônicos.",
    miniRevisao:
      "1) Quantos Poderes? (3) 2) Relação? (Independentes e harmônicos) 3) Fundamentos? (Art. 1º)",
  }),
  questions: [
    q({
      id: "c2-q1",
      difficulty: "facil",
      statement: "Nos termos do art. 2º da CF, são Poderes da União:",
      alternatives: [
        { key: "A", text: "Legislativo, Executivo e Judiciário" },
        { key: "B", text: "Legislativo, Executivo e Ministério Público" },
        { key: "C", text: "Executivo, Judiciário e Tribunais de Contas" },
        { key: "D", text: "Legislativo, Forças Armadas e Judiciário" },
      ],
      correctKey: "A",
      legalBasis: "CF/1988, art. 2º",
      whyCorrect: "O art. 2º enumera Legislativo, Executivo e Judiciário.",
      whyWrong: {
        B: "MP não é Poder no art. 2º.",
        C: "TCs não são Poder no art. 2º.",
        D: "Forças Armadas não são Poder no art. 2º.",
      },
    }),
    q({
      id: "c2-q2",
      difficulty: "facil",
      statement: "Os Poderes da União, segundo o art. 2º, são:",
      alternatives: [
        { key: "A", text: "Dependentes entre si" },
        { key: "B", text: "Independentes e harmônicos entre si" },
        { key: "C", text: "Hierarquizados sob o Executivo" },
        { key: "D", text: "Subordinados ao Legislativo" },
      ],
      correctKey: "B",
      legalBasis: "CF/1988, art. 2º",
      whyCorrect: "Fórmula constitucional: independentes e harmônicos.",
      whyWrong: {
        A: "São independentes.",
        C: "Sem hierarquia entre Poderes no art. 2º.",
        D: "Sem subordinação geral.",
      },
    }),
    q({
      id: "c2-q3",
      difficulty: "media",
      statement: "A separação dos Poderes (art. 2º) NÃO se confunde com:",
      alternatives: [
        { key: "A", text: "Os fundamentos da República do art. 1º" },
        { key: "B", text: "A existência do Legislativo" },
        { key: "C", text: "A existência do Executivo" },
        { key: "D", text: "A existência do Judiciário" },
      ],
      correctKey: "A",
      legalBasis: "CF/1988, arts. 1º e 2º",
      whyCorrect: "Fundamentos e Poderes são dispositivos distintos.",
      whyWrong: {
        B: "Legislativo é Poder do art. 2º.",
        C: "Executivo é Poder do art. 2º.",
        D: "Judiciário é Poder do art. 2º.",
      },
    }),
  ],
  bossQuestions: [
    q({
      id: "c2-b-q1",
      difficulty: "media",
      statement: "Assinale a afirmativa correta sobre o art. 2º da CF:",
      alternatives: [
        { key: "A", text: "Há quatro Poderes da União, incluindo o Ministério Público" },
        {
          key: "B",
          text: "Legislativo, Executivo e Judiciário são independentes e harmônicos entre si",
        },
        { key: "C", text: "O Judiciário é subordinado ao Executivo" },
        { key: "D", text: "Só o Legislativo é independente" },
      ],
      correctKey: "B",
      legalBasis: "CF/1988, art. 2º",
      whyCorrect: "Reproduz o texto constitucional.",
      whyWrong: {
        A: "São três Poderes.",
        C: "Sem essa subordinação.",
        D: "Os três são independentes.",
      },
    }),
    q({
      id: "c2-b-q2",
      difficulty: "dificil",
      statement: "O art. 2º da CF trata de Poderes:",
      alternatives: [
        { key: "A", text: "Dos Municípios apenas" },
        { key: "B", text: "Da União" },
        { key: "C", text: "Exclusivamente dos Estados" },
        { key: "D", text: "Do Distrito Federal apenas" },
      ],
      correctKey: "B",
      legalBasis: "CF/1988, art. 2º",
      whyCorrect: "O dispositivo fala em Poderes da União.",
      whyWrong: {
        A: "Não restringe aos Municípios.",
        C: "Não é exclusivo dos Estados nesse artigo.",
        D: "Não é só do DF.",
      },
    }),
  ],
});

export const tjspQuestCatalog: QuestCatalog = {
  version: 4,
  subjects,
  phases: [
    ...portPhases,
    const1,
    const2,
    ...constExtraPhases,
    ...direitoPhases,
    ...geraisPhases,
    ...editalExpandPhases,
  ],
};

export function getQuestPhase(id: string): QuestPhase | undefined {
  return tjspQuestCatalog.phases.find((p) => p.id === id);
}

export function getQuestSubject(id: string): QuestSubject | undefined {
  return tjspQuestCatalog.subjects.find((s) => s.id === id);
}

export function phasesForSubject(subjectId: string): QuestPhase[] {
  return tjspQuestCatalog.phases
    .filter((p) => p.subjectId === subjectId)
    .sort((a, b) => a.number - b.number);
}

/** Contagem rápida do banco didático. */
export function countQuestQuestions(): number {
  return tjspQuestCatalog.phases.reduce(
    (acc, p) => acc + p.questions.length + p.bossQuestions.length,
    0,
  );
}

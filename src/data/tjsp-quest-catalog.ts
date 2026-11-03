import type { QuestCatalog, QuestPhase, QuestSubject } from "@/types/tjsp-quest";
import { buildLessonBlocks, phase, q } from "@/data/tjsp-quest/lesson";
import { portPhases } from "@/data/tjsp-quest/phases-port";
import { constExtraPhases } from "@/data/tjsp-quest/phases-const-extra";
import { direitoPhases } from "@/data/tjsp-quest/phases-direito";
import { geraisPhases } from "@/data/tjsp-quest/phases-gerais";

/**
 * Catálogo TJSP Quest — metadados das fases (título, objetivo, fontes, unlock).
 * Material da aula + questões são gerados por IA no padrão VUNESP (A–E) na primeira
 * visita à fase (cache local). O conteúdo estático abaixo serve de fallback/mock.
 */

const subjects: QuestSubject[] = [
  {
    id: "port",
    name: "Língua Portuguesa",
    shortName: "Português",
    color: "#9b2226",
    icon: "pen",
    description: "Bloco I — interpretação, gramática, crase e coesão.",
    phaseIds: ["port-1", "port-2"],
  },
  {
    id: "const",
    name: "Direito Constitucional",
    shortName: "Constitucional",
    color: "#e85d04",
    icon: "scale",
    description: "Título II (Caps. I–III), Administração Pública e art. 92.",
    phaseIds: ["const-1", "const-2", "const-3", "const-4"],
  },
  {
    id: "penal",
    name: "Direito Penal",
    shortName: "Penal",
    color: "#6a040f",
    icon: "gavel",
    description: "Crimes contra a fé pública e a Administração (CP).",
    phaseIds: ["penal-1"],
  },
  {
    id: "procpen",
    name: "Processo Penal",
    shortName: "Proc. Penal",
    color: "#370617",
    icon: "gavel",
    description: "CPP e Juizado Criminal (Lei 9.099/95).",
    phaseIds: ["procpen-1"],
  },
  {
    id: "procciv",
    name: "Processo Civil",
    shortName: "Proc. Civil",
    color: "#03045e",
    icon: "landmark",
    description: "CPC, Juizados Cíveis e da Fazenda Pública.",
    phaseIds: ["procciv-1"],
  },
  {
    id: "admin",
    name: "Direito Administrativo",
    shortName: "Administrativo",
    color: "#7b2cbf",
    icon: "landmark",
    description: "Estatuto estadual (10.261/68) e improbidade (8.429/92).",
    phaseIds: ["admin-1"],
  },
  {
    id: "legis",
    name: "Legislação Interna",
    shortName: "Legislação",
    color: "#5a189a",
    icon: "book",
    description: "Teletrabalho, eproc, carreira, Regimento e CGJ.",
    phaseIds: ["legis-1"],
  },
  {
    id: "atual",
    name: "Atualidades e PCD",
    shortName: "Atualidades",
    color: "#2d6a4f",
    icon: "globe",
    description: "Fatos do 1º semestre/2026 e Lei 13.146/2015.",
    phaseIds: ["atual-1"],
  },
  {
    id: "mat",
    name: "Matemática",
    shortName: "Matemática",
    color: "#0077b6",
    icon: "calculator",
    description: "Porcentagem, juros, equações e geometria.",
    phaseIds: ["mat-1", "mat-2"],
  },
  {
    id: "info",
    name: "Informática",
    shortName: "Informática",
    color: "#00b4d8",
    icon: "monitor",
    description: "Windows, Word, Excel, Teams, OneDrive e Internet.",
    phaseIds: ["info-1", "info-2"],
  },
  {
    id: "rlm",
    name: "Raciocínio Lógico",
    shortName: "Lógica",
    color: "#2a9d8f",
    icon: "calculator",
    description: "Sequências, argumentação e diagramas lógicos.",
    phaseIds: ["rlm-1", "rlm-2"],
  },
];

const const1: QuestPhase = phase({
  id: "const-1",
  subjectId: "const",
  number: 1,
  title: "Fundamentos da República",
  objective:
    "Compreender os fundamentos da República Federativa do Brasil (art. 1º da CF) e o sentido de soberania, cidadania e dignidade da pessoa humana.",
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
  title: "Separação dos Poderes",
  objective: "Entender o art. 2º da CF: independência e harmonia entre Legislativo, Executivo e Judiciário.",
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

const info1: QuestPhase = phase({
  id: "info-1",
  subjectId: "info",
  number: 1,
  title: "Excel — referências e gráficos",
  objective: "Dominar referência absoluta/relativa e a ideia básica de criar gráficos.",
  estimatedMinutes: 10,
  conceptsCount: 4,
  unlockRequiresPhaseIds: [],
  sources: [{ label: "Edital TJSP — Informática (MS-Excel)" }],
  lessonBlocks: buildLessonBlocks({
    prefix: "i1",
    contexto: "Concursos cobram Excel no básico: referências de célula e gráficos.",
    explicacao:
      "A1 relativa; $A$1 absoluta; A$1 trava linha; $A1 trava coluna. Selecione os dados antes de inserir gráfico.",
    baseLegal: "Edital — MS-Excel: células, fórmulas, gráficos.",
    traducao: "Se a alíquota deve ficar fixa ao copiar a fórmula, use $.",
    exemplo: "Taxa única em F1 → use $F$1 nas linhas de cálculo.",
    prova: "A$1 trava linha. Série temporal → gráfico de linhas.",
    memorizar: "$ trava. Dois $ = célula travada. Tempo → linhas.",
    miniRevisao:
      "1) $A$1? (Absoluta) 2) A$1 trava? (Linha) 3) Evolução no tempo? (Linhas)",
  }),
  questions: [
    q({
      id: "i1-q1",
      difficulty: "facil",
      statement: "Na referência A$1 do Excel, o cifrão antes do número indica que:",
      alternatives: [
        { key: "A", text: "A coluna fica absoluta" },
        { key: "B", text: "A linha fica absoluta" },
        { key: "C", text: "A planilha inteira fica protegida" },
        { key: "D", text: "A fórmula é convertida em valor" },
      ],
      correctKey: "B",
      legalBasis: "Referência mista no Excel",
      whyCorrect: "O $ antes do número trava a linha.",
      whyWrong: {
        A: "Para coluna seria $A1.",
        C: "Proteção é outro recurso.",
        D: "Não é o efeito do $.",
      },
    }),
    q({
      id: "i1-q2",
      difficulty: "facil",
      statement: "Para criar um gráfico no Excel a partir de uma tabela, é recomendável primeiro:",
      alternatives: [
        { key: "A", text: "Fechar o arquivo" },
        { key: "B", text: "Apagar os cabeçalhos" },
        { key: "C", text: "Selecionar o intervalo de dados" },
        { key: "D", text: "Desativar a Autosalvamento" },
      ],
      correctKey: "C",
      legalBasis: "Fluxo básico de gráfico",
      whyCorrect: "O Excel usa a seleção atual como base.",
      whyWrong: {
        A: "Não é passo para criar gráfico.",
        B: "Cabeçalhos ajudam legendas.",
        D: "Irrelevante.",
      },
    }),
    q({
      id: "i1-q3",
      difficulty: "media",
      statement: "Para visualizar a evolução de uma série ao longo do tempo, um gráfico frequentemente adequado é o de:",
      alternatives: [
        { key: "A", text: "Linhas" },
        { key: "B", text: "Pizza" },
        { key: "C", text: "Rosca apenas" },
        { key: "D", text: "Mapa 3D obrigatório" },
      ],
      correctKey: "A",
      legalBasis: "Tipos de gráfico",
      whyCorrect: "Linhas destacam tendência temporal.",
      whyWrong: {
        B: "Pizza = composição.",
        C: "Rosca = composição.",
        D: "Não é o mais usual.",
      },
    }),
  ],
  bossQuestions: [
    q({
      id: "i1-b-q1",
      difficulty: "media",
      statement: "A referência $B$2 é:",
      alternatives: [
        { key: "A", text: "Relativa" },
        { key: "B", text: "Absoluta" },
        { key: "C", text: "Apenas de linha" },
        { key: "D", text: "Inválida no Excel" },
      ],
      correctKey: "B",
      legalBasis: "Referência absoluta",
      whyCorrect: "Dois cifrões travam coluna e linha.",
      whyWrong: {
        A: "Relativa não usa $.",
        C: "Trava coluna e linha.",
        D: "É válida.",
      },
    }),
    q({
      id: "i1-b-q2",
      difficulty: "facil",
      statement: "Copiar uma fórmula com referência relativa A1 uma linha abaixo tende a virar:",
      alternatives: [
        { key: "A", text: "A2" },
        { key: "B", text: "$A$1" },
        { key: "C", text: "B1 obrigatoriamente" },
        { key: "D", text: "Z99" },
      ],
      correctKey: "A",
      legalBasis: "Referência relativa",
      whyCorrect: "Ao copiar para baixo, a linha aumenta.",
      whyWrong: {
        B: "Só se fosse absoluta.",
        C: "Para o lado mudaria a coluna.",
        D: "Sem fundamento.",
      },
    }),
  ],
});

const rlm1: QuestPhase = phase({
  id: "rlm-1",
  subjectId: "rlm",
  number: 1,
  title: "Sequências numéricas",
  objective: "Identificar o padrão de sequências simples cobradas em provas.",
  estimatedMinutes: 8,
  conceptsCount: 2,
  unlockRequiresPhaseIds: [],
  sources: [{ label: "Edital TJSP — Raciocínio Lógico (sequências)" }],
  lessonBlocks: buildLessonBlocks({
    prefix: "r1",
    contexto: "Sequências treinam reconhecer padrão — soma, multiplicação ou Fibonacci.",
    explicacao:
      "Olhe a diferença entre termos. Diferença constante → PA. Razão constante → PG. Soma dos anteriores → Fibonacci.",
    baseLegal: "Edital — identificação de regularidades em sequências.",
    traducao: "Confirme o padrão em pelo menos dois passos antes de marcar.",
    exemplo: "2, 3, 5, 8, 13… → próximo = 21.",
    prova: "Evite chutar só porque “parece crescente”.",
    memorizar: "PA = diferença. PG = razão. Fibonacci = soma dos anteriores.",
    miniRevisao: "1) 2,3,5,8,13 →? (21) 2) PA? (Diferença) 3) PG? (Razão)",
  }),
  questions: [
    q({
      id: "r1-q1",
      difficulty: "facil",
      statement: "O próximo termo de 2, 3, 5, 8, 13, … é:",
      alternatives: [
        { key: "A", text: "18" },
        { key: "B", text: "20" },
        { key: "C", text: "21" },
        { key: "D", text: "24" },
      ],
      correctKey: "C",
      legalBasis: "Padrão de Fibonacci",
      whyCorrect: "8+13=21.",
      whyWrong: { A: "Não segue o padrão.", B: "Idem.", D: "Idem." },
    }),
    q({
      id: "r1-q2",
      difficulty: "facil",
      statement: "Na sequência 5, 10, 20, 40, … o próximo termo é:",
      alternatives: [
        { key: "A", text: "45" },
        { key: "B", text: "60" },
        { key: "C", text: "80" },
        { key: "D", text: "100" },
      ],
      correctKey: "C",
      legalBasis: "PG de razão 2",
      whyCorrect: "40×2=80.",
      whyWrong: { A: "Não.", B: "Não.", D: "Não." },
    }),
    q({
      id: "r1-q3",
      difficulty: "media",
      statement: "Em uma PA de razão 4, se o 1º termo é 3, o 4º termo é:",
      alternatives: [
        { key: "A", text: "7" },
        { key: "B", text: "11" },
        { key: "C", text: "15" },
        { key: "D", text: "19" },
      ],
      correctKey: "C",
      legalBasis: "PA: a_n = a1+(n-1)r",
      whyCorrect: "3+12=15.",
      whyWrong: { A: "2º termo.", B: "3º termo.", D: "Passou." },
    }),
  ],
  bossQuestions: [
    q({
      id: "r1-b-q1",
      difficulty: "media",
      statement: "Sequência: 1, 4, 9, 16, 25, … Próximo:",
      alternatives: [
        { key: "A", text: "30" },
        { key: "B", text: "35" },
        { key: "C", text: "36" },
        { key: "D", text: "49" },
      ],
      correctKey: "C",
      legalBasis: "Quadrados perfeitos",
      whyCorrect: "6²=36.",
      whyWrong: { A: "Não.", B: "Não.", D: "7²." },
    }),
  ],
});

export const tjspQuestCatalog: QuestCatalog = {
  version: 2,
  subjects,
  phases: [
    ...portPhases,
    const1,
    const2,
    ...constExtraPhases,
    ...direitoPhases,
    ...geraisPhases,
    info1,
    rlm1,
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

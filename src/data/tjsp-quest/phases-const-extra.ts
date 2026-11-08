import type { QuestPhase } from "@/types/tjsp-quest";
import { buildLessonBlocks, phase, q } from "./lesson";

/**
 * Direito Constitucional — continuidade do edital:
 * Título II Caps. I–III; Título III Cap. VII Seções I–II; art. 92.
 * (Fases const-1 e const-2 ficam no catálogo base.)
 */
export const constExtraPhases: QuestPhase[] = [
  phase({
    id: "const-3",
    subjectId: "const",
    number: 3,
    title: "Administração Pública",
    objective:
      "Dominar Título III, Cap. VII, Seções I e II da CF (arts. 37 a 41 — Administração Pública e servidores) e o art. 92 (órgãos do Poder Judiciário).",
    estimatedMinutes: 14,
    conceptsCount: 6,
    unlockRequiresPhaseIds: ["const-2"],
    sources: [
      {
        label: "CF/1988 — Título III, Cap. VII, Seções I e II — Planalto",
        url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "c3",
      contexto:
        "O edital cobra Título II (Caps. I, II e III). O art. 5º é o coração: direitos e deveres individuais e coletivos.",
      explicacao:
        "Cap. I = direitos e deveres individuais e coletivos (art. 5º). Cap. II = direitos sociais (art. 6º e seguintes). Cap. III = nacionalidade. Foque primeiro no art. 5º: igualdade, legalidade, contraditório, ampla defesa, habeas corpus, mandado de segurança.",
      baseLegal: "CF/1988, Título II, Capítulos I, II e III.",
      textoLegal:
        "Art. 5º, caput: “Todos são iguais perante a lei, sem distinção de qualquer natureza…” — e os incisos trazem direitos e garantias (vida, liberdade, igualdade, segurança, propriedade, etc.).",
      traducao:
        "Igualdade perante a lei + rol de garantias. Em prova de escrevente, caem: legalidade penal, presunção de inocência, contraditório/ampla defesa, remédios constitucionais.",
      exemplo:
        "Alguém preso ilegalmente pode impetrar habeas corpus. Ato ilegal de autoridade que ameaça direito líquido e certo → mandado de segurança (em regra).",
      prova:
        "Não misture remédios: HC (liberdade de locomoção), MS (direito líquido e certo), habeas data (dados), mandado de injunção (falta de norma regulamentadora).",
      memorizar:
        "Art. 5º = igualdade + garantias. HC = ir e vir. MS = direito líquido e certo. HD = dados. MI = falta de norma.",
      miniRevisao:
        "1) Cap. I do Título II trata de quê? (Individuais e coletivos.) 2) HC protege o quê? (Locomoção.) 3) Direitos sociais ficam em qual capítulo? (II)",
    }),
    questions: [
      q({
        id: "c3-q1",
        difficulty: "facil",
        statement: "O art. 5º da CF está no Título II, Capítulo:",
        alternatives: [
          { key: "A", text: "I — Dos direitos e deveres individuais e coletivos" },
          { key: "B", text: "II — Dos direitos sociais" },
          { key: "C", text: "III — Da nacionalidade" },
          { key: "D", text: "VII — Do Poder Judiciário" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, Título II, Cap. I",
        whyCorrect: "O art. 5º integra o Capítulo I do Título II.",
        whyWrong: {
          B: "Direitos sociais começam no art. 6º (Cap. II).",
          C: "Nacionalidade é Cap. III.",
          D: "Poder Judiciário está no Título IV (organização dos Poderes), não no Título II.",
        },
      }),
      q({
        id: "c3-q2",
        difficulty: "media",
        statement: "O habeas corpus destina-se, em essência, a proteger:",
        alternatives: [
          { key: "A", text: "A liberdade de locomoção" },
          { key: "B", text: "O sigilo de dados cadastrais na Receita" },
          { key: "C", text: "A criação de lei regulamentadora ausente" },
          { key: "D", text: "Exclusivamente o direito de propriedade" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 5º, LXVIII",
        whyCorrect: "HC tutela a liberdade de locomoção ameaçada ou violada.",
        whyWrong: {
          B: "Perfil mais próximo de habeas data / proteção de dados.",
          C: "Mandado de injunção.",
          D: "Propriedade tem outras tutelas; não é a essência do HC.",
        },
        memoryTip: "HC = ir e vir.",
      }),
      q({
        id: "c3-q3",
        difficulty: "media",
        statement:
          "São direitos sociais previstos no art. 6º da CF, entre outros:",
        alternatives: [
          { key: "A", text: "Educação, saúde, alimentação e moradia" },
          { key: "B", text: "Apenas o direito de propriedade" },
          { key: "C", text: "Somente a soberania nacional" },
          { key: "D", text: "Apenas os direitos políticos" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 6º",
        whyCorrect: "O art. 6º elenca educação, saúde, alimentação, trabalho, moradia, transporte, lazer, segurança, previdência, proteção à maternidade/infância, assistência aos desamparados — entre outros.",
        whyWrong: {
          B: "Propriedade é sobretudo art. 5º.",
          C: "Soberania é fundamento (art. 1º).",
          D: "Direitos políticos são Cap. IV do Título II.",
        },
      }),
      q({
        id: "c3-q4",
        difficulty: "facil",
        statement: "Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei. Trata-se do princípio da:",
        alternatives: [
          { key: "A", text: "Legalidade" },
          { key: "B", text: "Anterioridade eleitoral" },
          { key: "C", text: "Separação de contas" },
          { key: "D", text: "Inafastabilidade só administrativa" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 5º, II",
        whyCorrect: "É a fórmula clássica da legalidade no art. 5º, II.",
        whyWrong: {
          B: "Anterioridade eleitoral é outro tema.",
          C: "Não é o nome do princípio.",
          D: "Inafastabilidade da jurisdição é art. 5º, XXXV.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "c3-b-q1",
        difficulty: "dificil",
        statement: "O mandado de segurança é cabível, em regra, para proteger:",
        alternatives: [
          {
            key: "A",
            text: "Direito líquido e certo não amparado por HC ou habeas data",
          },
          { key: "B", text: "Apenas liberdade de locomoção" },
          { key: "C", text: "Exclusivamente dados pessoais em banco público" },
          { key: "D", text: "Qualquer pretensão sem prova pré-constituída" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 5º, LXIX",
        whyCorrect: "MS tutela direito líquido e certo não cabível em HC/HD.",
        whyWrong: {
          B: "Isso é HC.",
          C: "Perfil de habeas data.",
          D: "MS exige direito líquido e certo (prova pré-constituída).",
        },
      }),
      q({
        id: "c3-b-q2",
        difficulty: "media",
        statement: "O Capítulo III do Título II da CF trata da:",
        alternatives: [
          { key: "A", text: "Nacionalidade" },
          { key: "B", text: "Administração Pública" },
          { key: "C", text: "Tributação" },
          { key: "D", text: "Ordem econômica" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, Título II, Cap. III",
        whyCorrect: "Cap. III = Da Nacionalidade.",
        whyWrong: {
          B: "Administração Pública está no Título III, Cap. VII.",
          C: "Tributação é outro título.",
          D: "Ordem econômica é Título VII.",
        },
      }),
    ],
  }),

  phase({
    id: "const-4",
    subjectId: "const",
    number: 4,
    title: "Chefão — Constitucional integrado",
    objective:
      "Integrar Título II Caps. I–III, Administração Pública (Título III Cap. VII Seções I–II) e art. 92.",
    estimatedMinutes: 12,
    conceptsCount: 5,
    unlockRequiresPhaseIds: ["const-3"],
    sources: [
      {
        label: "CF/1988 — art. 37 e art. 92 (Planalto)",
        url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "c4",
      contexto:
        "O edital aponta Título III, Cap. VII (Seções I e II) e também o art. 92 — organização do Judiciário.",
      explicacao:
        "Art. 37: LIMPE (Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência). Seção II: servidores públicos. Art. 92: órgãos do Poder Judiciário (STF, tribunais superiores, TRFs, TJs, etc.).",
      baseLegal: "CF/1988, Título III, Cap. VII, Seções I e II; art. 92.",
      textoLegal:
        "Art. 37, caput: a administração pública direta e indireta de quaisquer dos Poderes da União, dos Estados, do DF e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência.",
      traducao:
        "Servidor e órgão público agem sob LIMPE. O art. 92 lista quem compõe o Judiciário — útil para saber “quem é o quê” no organograma constitucional.",
      exemplo:
        "Publicar ato administrativo (publicidade). Não favorecer amigo em concurso (impessoalidade/moralidade).",
      prova:
        "Decore LIMPE. No art. 92, lembre: STF, STJ, TST, TSE, STM, TRFs, TJs, TRTs, TREs, Conselhos e juízes — conforme o texto.",
      memorizar: "LIMPE + art. 92 = órgãos do Judiciário. TJSP integra os Tribunais de Justiça.",
      miniRevisao:
        "1) Quais os 5 princípios do art. 37? (LIMPE) 2) Art. 92 trata de quê? (Órgãos do Judiciário) 3) Eficiência entrou com qual emenda? (EC 19/1998 — curiosidade útil)",
    }),
    questions: [
      q({
        id: "c4-q1",
        difficulty: "facil",
        statement: "Os princípios do art. 37, caput, da CF são lembrados pelo mnemônico:",
        alternatives: [
          { key: "A", text: "LIMPE" },
          { key: "B", text: "SOCIDIVAPLU" },
          { key: "C", text: "LEJ" },
          { key: "D", text: "HC-MS-HD-MI" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 37, caput",
        whyCorrect: "Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência = LIMPE.",
        whyWrong: {
          B: "Fundamentos do art. 1º.",
          C: "Poderes do art. 2º.",
          D: "Remédios do art. 5º.",
        },
        memoryTip: "LIMPE = art. 37.",
      }),
      q({
        id: "c4-q2",
        difficulty: "media",
        statement: "Segundo o art. 92 da CF, são órgãos do Poder Judiciário, entre outros:",
        alternatives: [
          { key: "A", text: "O Supremo Tribunal Federal e os Tribunais de Justiça" },
          { key: "B", text: "Apenas o Ministério Público e a Defensoria" },
          { key: "C", text: "Somente as Assembleias Legislativas" },
          { key: "D", text: "Exclusivamente os Tribunais de Contas" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 92",
        whyCorrect: "O art. 92 elenca STF, tribunais superiores, TRFs, TJs, etc.",
        whyWrong: {
          B: "MP e Defensoria não são órgãos do Judiciário no art. 92.",
          C: "Assembleias são Legislativo.",
          D: "TCs não figuram como órgãos do Judiciário no art. 92.",
        },
      }),
      q({
        id: "c4-q3",
        difficulty: "facil",
        statement: "O princípio da impessoalidade na Administração Pública veda, em essência:",
        alternatives: [
          { key: "A", text: "Tratamentos privilegiados e promoção pessoal indevida" },
          { key: "B", text: "A publicação de atos oficiais" },
          { key: "C", text: "A existência de concursos públicos" },
          { key: "D", text: "O controle judicial de atos administrativos" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 37, caput",
        whyCorrect: "Impessoalidade: a Administração age em nome do interesse público, sem favorecimentos.",
        whyWrong: {
          B: "Publicidade é outro princípio e exige transparência.",
          C: "Concurso é regra para investidura.",
          D: "Controle judicial é garantia constitucional.",
        },
      }),
      q({
        id: "c4-q4",
        difficulty: "media",
        statement:
          "A Administração Pública direta e indireta de quaisquer dos Poderes deve obedecer aos princípios do art. 37:",
        alternatives: [
          { key: "A", text: "Da União, dos Estados, do Distrito Federal e dos Municípios" },
          { key: "B", text: "Somente da União" },
          { key: "C", text: "Apenas dos Municípios" },
          { key: "D", text: "Somente do Poder Executivo federal" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 37, caput",
        whyCorrect: "O caput abrange todos os entes e Poderes.",
        whyWrong: {
          B: "Alcance é mais amplo.",
          C: "Não é só municipal.",
          D: "Abrange os três Poderes e todos os entes.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "c4-b-q1",
        difficulty: "dificil",
        statement: "Assinale a alternativa que contém APENAS princípios do art. 37, caput:",
        alternatives: [
          {
            key: "A",
            text: "Legalidade, impessoalidade, moralidade, publicidade e eficiência",
          },
          {
            key: "B",
            text: "Legalidade, soberania, moralidade, publicidade e eficiência",
          },
          {
            key: "C",
            text: "Cidadania, impessoalidade, moralidade, publicidade e eficiência",
          },
          {
            key: "D",
            text: "Legalidade, impessoalidade, dignidade, publicidade e eficiência",
          },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 37, caput",
        whyCorrect: "Reproduz o LIMPE integral.",
        whyWrong: {
          B: "Soberania é fundamento (art. 1º).",
          C: "Cidadania é fundamento (art. 1º).",
          D: "Dignidade é fundamento (art. 1º).",
        },
      }),
      q({
        id: "c4-b-q2",
        difficulty: "media",
        statement: "O Tribunal de Justiça do Estado de São Paulo, na estrutura do art. 92, classifica-se entre:",
        alternatives: [
          { key: "A", text: "Os Tribunais de Justiça" },
          { key: "B", text: "Os Tribunais Regionais Federais" },
          { key: "C", text: "Os Tribunais Superiores da União exclusivamente" },
          { key: "D", text: "Órgãos do Poder Legislativo" },
        ],
        correctKey: "A",
        legalBasis: "CF/1988, art. 92, III / IV (conforme redação vigente)",
        whyCorrect: "TJs são órgãos do Poder Judiciário previstos no art. 92.",
        whyWrong: {
          B: "TRFs são justiça federal de segundo grau.",
          C: "TJ não é tribunal superior da União.",
          D: "É órgão do Judiciário.",
        },
      }),
    ],
  }),
];

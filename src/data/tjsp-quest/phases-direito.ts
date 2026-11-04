import type { QuestPhase } from "@/types/tjsp-quest";
import { buildLessonBlocks, phase, q } from "./lesson";

/** Direito Penal, Processual e Administrativo — recortes do edital. */
export const direitoPhases: QuestPhase[] = [
  phase({
    id: "penal-1",
    subjectId: "penal",
    number: 1,
    title: "Crimes contra a fé pública",
    objective:
      "Reconhecer tipicidade dos arts. 293 a 305; 307; 308 e 311-A do CP (fé pública e documentos).",
    estimatedMinutes: 14,
    conceptsCount: 5,
    unlockRequiresPhaseIds: [],
    sources: [
      {
        label: "Código Penal — arts. indicados no edital (Planalto)",
        url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "pe1",
      contexto:
        "O edital lista trechos do CP: fé pública (293–305), falsidade (307–308), documentos (311-A), crimes contra a Administração (312+).",
      explicacao:
        "Foque nos clássicos de concurso: peculato, concussão, corrupção passiva/ativa, prevaricação, advocacia administrativa, desacato, resistência. Diferencie bem peculato × concussão × corrupção.",
      baseLegal: "CP — arts. 293 a 305; 307; 308; 311-A; 312 a 317; 319 a 333; 336 e 337; 339 a 347; 357 e 359 (conforme edital).",
      textoLegal:
        "Peculato (art. 312): apropriar-se o funcionário público de dinheiro, valor ou bem móvel público ou particular de que tem a posse em razão do cargo… Corrupção passiva (art. 317): solicitar ou receber vantagem indevida…",
      traducao:
        "Peculato = “ficar com o que era da Administração/particular sob sua guarda”. Concussão = exigir. Corrupção passiva = pedir/receber. Prevaricação = retardar/deixar de praticar ato de ofício para satisfazer interesse pessoal.",
      exemplo:
        "Servidor que desvia material do fórum → peculato. Autoridade que exige dinheiro para “agilizar” → concussão. Juiz que recebe propina → corrupção passiva.",
      prova:
        "Concussão exige “exigir”; corrupção passiva “solicitar ou receber”. Não troque os verbos nucleares!",
      memorizar:
        "Peculato = apropriar/desviar. Concussão = exigir. Corrupção passiva = solicitar/receber. Prevaricação = interesse pessoal no ato de ofício.",
      miniRevisao:
        "1) Exigir vantagem =? (Concussão) 2) Solicitar/receber =? (Corrupção passiva) 3) Apropriar bem sob posse do cargo =? (Peculato)",
    }),
    questions: [
      q({
        id: "pe1-q1",
        difficulty: "facil",
        statement: "No crime de concussão (art. 316 do CP), o núcleo típico essencial é:",
        alternatives: [
          { key: "A", text: "Exigir vantagem indevida" },
          { key: "B", text: "Apropriar-se de bem sob posse do cargo" },
          { key: "C", text: "Falsificar moeda" },
          { key: "D", text: "Denunciar crime sabendo inocente" },
        ],
        correctKey: "A",
        legalBasis: "CP, art. 316",
        whyCorrect: "Concussão = exigir, para si ou para outrem, vantagem indevida.",
        whyWrong: {
          B: "Perfil de peculato (art. 312).",
          C: "Crimes de moeda falsa (arts. 289+).",
          D: "Denunciação caluniosa (art. 339).",
        },
        memoryTip: "Concussão = exigir.",
      }),
      q({
        id: "pe1-q2",
        difficulty: "media",
        statement: "Peculato (art. 312) pressupõe, em regra, que o agente:",
        alternatives: [
          { key: "A", text: "Seja funcionário público e tenha a posse em razão do cargo" },
          { key: "B", text: "Seja particular sem qualquer vínculo com o serviço" },
          { key: "C", text: "Pratique somente crime culposo de trânsito" },
          { key: "D", text: "Atue exclusivamente como jurado" },
        ],
        correctKey: "A",
        legalBasis: "CP, art. 312",
        whyCorrect: "O tipo exige funcionário público e posse em razão do cargo.",
        whyWrong: {
          B: "Particular pode responder em hipóteses específicas (ex.: peculato-furto / concurso), mas o tipo básico é de funcionário.",
          C: "Não é o tipo do art. 312.",
          D: "Não é elemento do peculato.",
        },
      }),
      q({
        id: "pe1-q3",
        difficulty: "media",
        statement: "Corrupção passiva (art. 317) diferencia-se da concussão principalmente porque:",
        alternatives: [
          { key: "A", text: "Na passiva, solicita ou recebe; na concussão, exige" },
          { key: "B", text: "A passiva só ocorre em crimes eleitorais" },
          { key: "C", text: "A concussão nunca envolve funcionário público" },
          { key: "D", text: "Não há qualquer diferença prática entre os tipos" },
        ],
        correctKey: "A",
        legalBasis: "CP, arts. 316 e 317",
        whyCorrect: "Verbos nucleares distintos: exigir × solicitar/receber.",
        whyWrong: {
          B: "Não é restrição do art. 317.",
          C: "Concussão é crime de funcionário público.",
          D: "Há diferença típica relevante.",
        },
      }),
      q({
        id: "pe1-q4",
        difficulty: "facil",
        statement: "Prevaricação (art. 319) consiste, em síntese, em:",
        alternatives: [
          {
            key: "A",
            text: "Retardar ou deixar de praticar ato de ofício, ou praticá-lo contra disposição expressa de lei, para satisfazer interesse ou sentimento pessoal",
          },
          { key: "B", text: "Falsificar documento público com selo verdadeiro" },
          { key: "C", text: "Moeda falsa em circulação" },
          { key: "D", text: "Furto simples de particular" },
        ],
        correctKey: "A",
        legalBasis: "CP, art. 319",
        whyCorrect: "Reproduz o tipo da prevaricação.",
        whyWrong: {
          B: "Falsidade documental.",
          C: "Moeda falsa.",
          D: "Furto (art. 155).",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "pe1-b-q1",
        difficulty: "dificil",
        statement: "Denunciação caluniosa (art. 339) ocorre quando alguém:",
        alternatives: [
          {
            key: "A",
            text: "Dá causa a investigação policial ou processo judicial contra alguém, imputando-lhe crime de que o sabe inocente",
          },
          { key: "B", text: "Apenas critica publicamente uma lei" },
          { key: "C", text: "Extravia processo por acidente sem dolo" },
          { key: "D", text: "Deixa de pagar multa de trânsito" },
        ],
        correctKey: "A",
        legalBasis: "CP, art. 339",
        whyCorrect: "Tipo exige imputação de crime a quem se sabe inocente, gerando investigação/processo.",
        whyWrong: {
          B: "Crítica a lei não é o tipo.",
          C: "Sem dolo típico não configura.",
          D: "Infração administrativa diversa.",
        },
      }),
      q({
        id: "pe1-b-q2",
        difficulty: "media",
        statement: "Desacato (art. 331) protege, em essência, a dignidade da:",
        alternatives: [
          { key: "A", text: "Função pública perante o funcionário no exercício ou em razão dela" },
          { key: "B", text: "Propriedade privada de imóveis" },
          { key: "C", text: "Liberdade de locomoção apenas" },
          { key: "D", text: "Ordem econômica internacional" },
        ],
        correctKey: "A",
        legalBasis: "CP, art. 331",
        whyCorrect: "Desacato = desacatar funcionário público no exercício da função ou em razão dela.",
        whyWrong: {
          B: "Não é o bem jurídico central.",
          C: "Isso remete a HC / crimes contra a liberdade.",
          D: "Fora do tipo.",
        },
      }),
    ],
  }),

  phase({
    id: "procpen-1",
    subjectId: "procpen",
    number: 1,
    title: "Sujeitos e atos processuais",
    objective:
      "Dominar juiz, MP, acusado, defensor, citação e intimação (CPP arts. 251–258; 261–267; 274; 351–372).",
    estimatedMinutes: 12,
    conceptsCount: 4,
    unlockRequiresPhaseIds: [],
    sources: [
      {
        label: "CPP e Lei 9.099/95 — arts. do edital (Planalto)",
        url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "pp1",
      contexto:
        "O edital cobra CPP (impedimentos, citação, procedimentos, recursos) e JECRIM (Lei 9.099 — arts. 60–83, 88 e 89).",
      explicacao:
        "Impedimento/suspeição: juiz não pode julgar em certas hipóteses. Citação: chama o acusado. Procedimento comum × especial. No JECRIM: infrações de menor potencial ofensivo, composição civil, transação penal, suspensão condicional do processo (art. 89).",
      baseLegal: "CPP arts. 251–258, 261–267, 274, 351–372, 394–497, 531–538, 541–548, 574–667; Lei 9.099/95 arts. 60–83, 88 e 89.",
      traducao:
        "Sem citação válida, em regra não há processo justo. No JECRIM, a ideia é agilidade e consensualidade (composição, transação, sursis processual).",
      exemplo:
        "Crime com pena máxima ≤ 2 anos (em regra) pode caber no JECRIM. Art. 89: suspensão do processo se pena mínima ≤ 1 ano, preenchidos requisitos.",
      prova:
        "Decore: transação penal ≠ suspensão condicional do processo. Art. 89 = sursis processual (pena mínima ≤ 1 ano).",
      memorizar:
        "JECRIM = menor potencial ofensivo. Art. 89 = suspensão do processo. Citação = ciência do acusado.",
      miniRevisao:
        "1) Art. 89 trata de quê? (Suspensão condicional do processo) 2) Impedimento afeta quem? (Juiz/órgãos) 3) JECRIM busca o quê? (Celeridade/consenso)",
    }),
    questions: [
      q({
        id: "pp1-q1",
        difficulty: "facil",
        statement:
          "A citação no processo penal serve, em essência, para:",
        alternatives: [
          { key: "A", text: "Dar ciência ao acusado da acusação e chamá-lo ao processo" },
          { key: "B", text: "Substituir a sentença condenatória" },
          { key: "C", text: "Extinguir automaticamente a punibilidade" },
          { key: "D", text: "Criar cargo público" },
        ],
        correctKey: "A",
        legalBasis: "CPP — citação (arts. 351 e ss.)",
        whyCorrect: "Citação comunica a existência da ação e viabiliza o contraditório.",
        whyWrong: {
          B: "Citação não é sentença.",
          C: "Não extingue punibilidade por si só.",
          D: "Tema administrativo.",
        },
      }),
      q({
        id: "pp1-q2",
        difficulty: "media",
        statement:
          "A suspensão condicional do processo (art. 89 da Lei 9.099/95) exige, entre outros requisitos, que a pena mínima cominada seja igual ou inferior a:",
        alternatives: [
          { key: "A", text: "1 (um) ano" },
          { key: "B", text: "8 (oito) anos" },
          { key: "C", text: "12 (doze) anos" },
          { key: "D", text: "30 (trinta) dias apenas" },
        ],
        correctKey: "A",
        legalBasis: "Lei 9.099/95, art. 89",
        whyCorrect: "O art. 89 exige pena mínima igual ou inferior a 1 ano (além de outros requisitos).",
        whyWrong: {
          B: "Parâmetro típico de outros institutos (ex.: progressão em certos contextos), não do art. 89.",
          C: "Não é o marco do art. 89.",
          D: "Não é a regra do dispositivo.",
        },
        memoryTip: "Art. 89 = pena mínima ≤ 1 ano.",
      }),
      q({
        id: "pp1-q3",
        difficulty: "media",
        statement: "Impedimento e suspeição do juiz existem para garantir, sobretudo:",
        alternatives: [
          { key: "A", text: "Imparcialidade do julgamento" },
          { key: "B", text: "Aumento de custas" },
          { key: "C", text: "Publicidade comercial do fórum" },
          { key: "D", text: "Extinção da ação civil pública" },
        ],
        correctKey: "A",
        legalBasis: "CPP, arts. 251 e ss.",
        whyCorrect: "São mecanismos de preservação da imparcialidade.",
        whyWrong: {
          B: "Não é a finalidade.",
          C: "Irrelevante.",
          D: "Tema diverso.",
        },
      }),
      q({
        id: "pp1-q4",
        difficulty: "facil",
        statement: "No Juizado Especial Criminal, a lógica do procedimento prioriza:",
        alternatives: [
          { key: "A", text: "Oralidade, informalidade, economia processual e celeridade" },
          { key: "B", text: "Somente rito do júri obrigatório" },
          { key: "C", text: "Exclusão total do contraditório" },
          { key: "D", text: "Sigilo absoluto sem exceções legais" },
        ],
        correctKey: "A",
        legalBasis: "Lei 9.099/95 (princípios do JECRIM)",
        whyCorrect: "São os princípios clássicos dos Juizados.",
        whyWrong: {
          B: "Júri não é o rito padrão do JECRIM.",
          C: "Há contraditório.",
          D: "Publicidade é regra, com ressalvas legais.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "pp1-b-q1",
        difficulty: "dificil",
        statement: "Transação penal e suspensão condicional do processo:",
        alternatives: [
          {
            key: "A",
            text: "São institutos distintos previstos na Lei 9.099/95, com requisitos próprios",
          },
          { key: "B", text: "São sinônimos perfeitos e sempre idênticos" },
          { key: "C", text: "Só existem no processo civil" },
          { key: "D", text: "Aboliram o Código Penal" },
        ],
        correctKey: "A",
        legalBasis: "Lei 9.099/95 — arts. 76 e 89 (noções)",
        whyCorrect: "São benefícios/consensos diferentes: transação × sursis processual.",
        whyWrong: {
          B: "Não são idênticos.",
          C: "Estão no âmbito penal/JECRIM.",
          D: "Não aboliram o CP.",
        },
      }),
      q({
        id: "pp1-b-q2",
        difficulty: "media",
        statement: "Recursos no processo penal (CPP) existem para:",
        alternatives: [
          { key: "A", text: "Impugnar decisões e viabilizar reexame nos termos da lei" },
          { key: "B", text: "Substituir a necessidade de denúncia" },
          { key: "C", text: "Criar cargos em comissão" },
          { key: "D", text: "Revogar a Constituição" },
        ],
        correctKey: "A",
        legalBasis: "CPP — recursos (arts. 574 e ss.)",
        whyCorrect: "Recurso = meio de impugnação previsto em lei.",
        whyWrong: {
          B: "Denúncia é peça acusatória.",
          C: "Tema administrativo.",
          D: "Absurdo jurídico.",
        },
      }),
    ],
  }),

  phase({
    id: "procciv-1",
    subjectId: "procciv",
    number: 1,
    title: "Atos processuais e tutelas",
    objective:
      "Aplicar CPC arts. 144–155; 188–275; 294–311 (impedimento/suspeição, atos e tutelas provisórias).",
    estimatedMinutes: 12,
    conceptsCount: 5,
    unlockRequiresPhaseIds: [],
    sources: [
      {
        label: "CPC/2015 e Leis 9.099/95 e 12.153/2009 — recorte do edital",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "pc1",
      contexto:
        "Edital: CPC (impedimentos, atos, tutelas, procedimento comum, recursos), Juizados Cíveis (9.099 arts. 3º–19) e Juizados da Fazenda (12.153/2009).",
      explicacao:
        "Tutela provisória = urgência ou evidência. Procedimento comum: petição → citação → contestação → saneamento → instrução → sentença. Recursos: apelação, agravos, embargos, recursos aos tribunais superiores (conforme cabimento).",
      baseLegal: "CPC arts. 144–155; 188–275; 294–311; 318–538; 994–1026; Lei 9.099/95 arts. 3º–19; Lei 12.153/2009.",
      traducao:
        "Tutela de urgência = perigo de dano + probabilidade do direito. Tutela de evidência = alta probabilidade/evidência, com hipóteses legais.",
      exemplo:
        "Pedido de liminar para sustar protesto indevido → tutela de urgência. Causa com prova documental robusta em hipóteses do art. 311 → evidência.",
      prova:
        "Não diga que “toda liminar é recurso”. Liminar/tutela ≠ recurso. Juizados: causas de menor complexidade / valor (conforme lei).",
      memorizar:
        "Urgência = perigo + probabilidade. Evidência = art. 311. Apelação ataca sentença. Agravo ataca decisões interlocutórias (regra).",
      miniRevisao:
        "1) Tutela provisória divide-se em? (Urgência e evidência) 2) Apelação impugna o quê? (Sentença) 3) Lei 12.153 cria o quê? (Juizados da Fazenda Pública)",
    }),
    questions: [
      q({
        id: "pc1-q1",
        difficulty: "facil",
        statement: "No CPC/2015, a tutela provisória pode fundamentar-se em:",
        alternatives: [
          { key: "A", text: "Urgência ou evidência" },
          { key: "B", text: "Apenas juramento do réu" },
          { key: "C", text: "Somente acórdão do STF prévio obrigatório em toda causa" },
          { key: "D", text: "Exclusivamente acordo extrajudicial já homologado" },
        ],
        correctKey: "A",
        legalBasis: "CPC, art. 294",
        whyCorrect: "Tutela provisória = urgência ou evidência.",
        whyWrong: {
          B: "Não é fundamento legal genérico.",
          C: "Não é requisito geral.",
          D: "Não é a definição do art. 294.",
        },
      }),
      q({
        id: "pc1-q2",
        difficulty: "media",
        statement: "A apelação, em regra, é recurso cabível contra:",
        alternatives: [
          { key: "A", text: "Sentença" },
          { key: "B", text: "Qualquer despacho de mero expediente" },
          { key: "C", text: "Ato do oficial de justiça sem decisão judicial" },
          { key: "D", text: "Publicação de edital de concurso" },
        ],
        correctKey: "A",
        legalBasis: "CPC — recursos (apelação)",
        whyCorrect: "Apelação impugna sentença (regra).",
        whyWrong: {
          B: "Despacho de mero expediente em regra é irrecorrível.",
          C: "Não é hipótese típica de apelação.",
          D: "Tema administrativo.",
        },
      }),
      q({
        id: "pc1-q3",
        difficulty: "media",
        statement: "A Lei 12.153/2009 institui os:",
        alternatives: [
          { key: "A", text: "Juizados Especiais da Fazenda Pública" },
          { key: "B", text: "Tribunais do Júri federais" },
          { key: "C", text: "Conselhos de sentença eleitorais" },
          { key: "D", text: "Cartórios extrajudiciais privativos" },
        ],
        correctKey: "A",
        legalBasis: "Lei 12.153/2009",
        whyCorrect: "A lei cria os Juizados Especiais da Fazenda Pública no âmbito dos Estados/DF/Municípios.",
        whyWrong: {
          B: "Não é o objeto da lei.",
          C: "Não.",
          D: "Não.",
        },
      }),
      q({
        id: "pc1-q4",
        difficulty: "facil",
        statement: "Nos Juizados Especiais Cíveis (Lei 9.099/95), o processo orienta-se por:",
        alternatives: [
          { key: "A", text: "Oralidade, simplicidade, informalidade, economia processual e celeridade" },
          { key: "B", text: "Exclusivamente rito ordinário do CPC sem flexibilização" },
          { key: "C", text: "Sigilo absoluto obrigatório em todas as audiências" },
          { key: "D", text: "Competência criminal exclusiva" },
        ],
        correctKey: "A",
        legalBasis: "Lei 9.099/95, art. 2º (princípios) / arts. 3º–19",
        whyCorrect: "São os princípios dos Juizados Cíveis.",
        whyWrong: {
          B: "Há procedimento próprio simplificado.",
          C: "Publicidade é regra.",
          D: "Há também o JECRIM, mas o trecho 3º–19 é cível.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "pc1-b-q1",
        difficulty: "dificil",
        statement: "Para a tutela de urgência, o CPC exige, em regra:",
        alternatives: [
          {
            key: "A",
            text: "Elementos que evidenciem a probabilidade do direito e o perigo de dano ou risco ao resultado útil do processo",
          },
          { key: "B", text: "Apenas a vontade unilateral do juiz sem pedido" },
          { key: "C", text: "Prova de trânsito em julgado prévio da mesma causa" },
          { key: "D", text: "Autorização do CNJ em todo caso" },
        ],
        correctKey: "A",
        legalBasis: "CPC, art. 300",
        whyCorrect: "Art. 300 exige probabilidade do direito + perigo/risco.",
        whyWrong: {
          B: "Há pedido e requisitos legais.",
          C: "Não é requisito.",
          D: "Não é requisito geral.",
        },
      }),
      q({
        id: "pc1-b-q2",
        difficulty: "media",
        statement: "Impedimento e suspeição no CPC visam preservar:",
        alternatives: [
          { key: "A", text: "A imparcialidade do juiz e de outros sujeitos" },
          { key: "B", text: "A arrecadação de custas em dobro" },
          { key: "C", text: "A proibição de contestação" },
          { key: "D", text: "A extinção automática de todos os recursos" },
        ],
        correctKey: "A",
        legalBasis: "CPC, arts. 144–148 (noções)",
        whyCorrect: "São hipóteses de afastamento por parcialidade potencial.",
        whyWrong: {
          B: "Não é a finalidade.",
          C: "Não elimina contestação.",
          D: "Não extingue recursos.",
        },
      }),
    ],
  }),

  phase({
    id: "admin-1",
    subjectId: "admin",
    number: 1,
    title: "Estatuto do servidor estadual",
    objective:
      "Dominar o Estatuto dos Funcionários Públicos Civis do Estado de São Paulo (Lei 10.261/68 — arts. do edital).",
    estimatedMinutes: 12,
    conceptsCount: 4,
    unlockRequiresPhaseIds: [],
    sources: [
      {
        label: "Lei 10.261/68 e Lei 8.429/92 (Planalto / Alesp)",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "ad1",
      contexto:
        "Escrevente do TJSP vive sob o Estatuto dos Funcionários Públicos Civis do Estado (Lei 10.261/68) e responde também à Lei de Improbidade.",
      explicacao:
        "Estatuto: provimento, exercício, deveres, responsabilidades, penalidades. Improbidade: atos que atentam contra a Administração (enriquecimento ilícito, dano ao erário, violação a princípios — conforme tipificação vigente).",
      baseLegal: "Lei 10.261/68 (arts. do edital); Lei 8.429/92.",
      traducao:
        "Servidor tem deveres (assiduidade, urbanidade, lealdade). Violação pode gerar sanção disciplinar. Improbidade é responsabilização específica por atos ímprobos, com sanções próprias.",
      exemplo:
        "Abandono de cargo, inassiduidade, corrupção e desvio são temas clássicos de disciplina e/ou improbidade, conforme o caso.",
      prova:
        "Não confunda processo administrativo disciplinar com ação de improbidade (vias distintas, embora possam coexistir fatos).",
      memorizar:
        "10.261 = estatuto estadual. 8.429 = improbidade. Deveres do cargo + sanções.",
      miniRevisao:
        "1) Qual lei é o estatuto paulista? (10.261/68) 2) Improbidade =? (Lei 8.429/92) 3) PAD e improbidade são a mesma ação? (Não)",
    }),
    questions: [
      q({
        id: "ad1-q1",
        difficulty: "facil",
        statement: "O Estatuto dos Funcionários Públicos Civis do Estado de São Paulo é a:",
        alternatives: [
          { key: "A", text: "Lei n.º 10.261/68" },
          { key: "B", text: "Lei n.º 8.429/92" },
          { key: "C", text: "Lei n.º 9.099/95" },
          { key: "D", text: "Lei n.º 12.153/2009" },
        ],
        correctKey: "A",
        legalBasis: "Edital — Direito Administrativo 5.1",
        whyCorrect: "O edital aponta a Lei 10.261/68 como estatuto estadual.",
        whyWrong: {
          B: "Improbidade administrativa.",
          C: "Juizados.",
          D: "Juizados da Fazenda.",
        },
      }),
      q({
        id: "ad1-q2",
        difficulty: "media",
        statement: "A Lei 8.429/92 disciplina:",
        alternatives: [
          { key: "A", text: "A improbidade administrativa" },
          { key: "B", text: "O Código de Processo Civil" },
          { key: "C", text: "O regimento interno do TJSP" },
          { key: "D", text: "O teletrabalho no TJSP" },
        ],
        correctKey: "A",
        legalBasis: "Lei 8.429/92",
        whyCorrect: "É a Lei de Improbidade Administrativa.",
        whyWrong: {
          B: "CPC é Lei 13.105/2015.",
          C: "Norma interna do Tribunal.",
          D: "Resolução TJSP 850/2021.",
        },
      }),
      q({
        id: "ad1-q3",
        difficulty: "facil",
        statement: "Entre deveres típicos do funcionário público no estatuto estadual está:",
        alternatives: [
          { key: "A", text: "Cumprir as normas legais e regulamentares" },
          { key: "B", text: "Usar o cargo para benefício exclusivo de amigos" },
          { key: "C", text: "Omitir-se sempre de atender o público" },
          { key: "D", text: "Divulgar segredo funcional por hobby" },
        ],
        correctKey: "A",
        legalBasis: "Lei 10.261/68 — deveres (recorte do edital)",
        whyCorrect: "Cumprir a lei/regulamento é dever nuclear do servidor.",
        whyWrong: {
          B: "Vedação / improbidade / infração disciplinar.",
          C: "Contrapõe-se ao dever de atendimento.",
          D: "Violação de sigilo funcional.",
        },
      }),
      q({
        id: "ad1-q4",
        difficulty: "media",
        statement: "Processo administrativo disciplinar e ação de improbidade:",
        alternatives: [
          {
            key: "A",
            text: "São vias distintas, podendo coexistir conforme o caso, com finalidades próprias",
          },
          { key: "B", text: "São sempre o mesmo processo judicial único" },
          { key: "C", text: "Excluem qualquer responsabilidade do servidor" },
          { key: "D", text: "Só existem no Direito Penal Militar" },
        ],
        correctKey: "A",
        legalBasis: "Lei 10.261/68 e Lei 8.429/92 (noções)",
        whyCorrect: "Disciplinar (estatuto) e improbidade (8.429) têm regimes próprios.",
        whyWrong: {
          B: "Não se confundem automaticamente.",
          C: "Pelo contrário, responsabilizam.",
          D: "Aplicam-se à Administração civil também.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "ad1-b-q1",
        difficulty: "dificil",
        statement: "Assinale a associação CORRETA:",
        alternatives: [
          {
            key: "A",
            text: "Lei 10.261/68 — estatuto do servidor estadual; Lei 8.429/92 — improbidade",
          },
          {
            key: "B",
            text: "Lei 10.261/68 — improbidade; Lei 8.429/92 — estatuto paulista",
          },
          {
            key: "C",
            text: "Ambas tratam exclusivamente de direito eleitoral",
          },
          {
            key: "D",
            text: "Nenhuma das leis existe no ordenamento",
          },
        ],
        correctKey: "A",
        legalBasis: "Edital — Direito Administrativo",
        whyCorrect: "Associa corretamente estatuto e improbidade.",
        whyWrong: {
          B: "Está invertido.",
          C: "Não são leis eleitorais.",
          D: "Ambas existem.",
        },
      }),
      q({
        id: "ad1-b-q2",
        difficulty: "media",
        statement: "Atos de improbidade administrativa, na linha da Lei 8.429/92, podem gerar:",
        alternatives: [
          {
            key: "A",
            text: "Sanções como perda da função pública, suspensão de direitos políticos e ressarcimento, conforme o caso e a tipificação",
          },
          { key: "B", text: "Apenas elogio funcional obrigatório" },
          { key: "C", text: "Nomeação automática em cargo vitalício" },
          { key: "D", text: "Isenção total de qualquer responsabilização" },
        ],
        correctKey: "A",
        legalBasis: "Lei 8.429/92 — sanções",
        whyCorrect: "A LIA prevê sanções graves, aplicadas conforme o tipo e o devido processo.",
        whyWrong: {
          B: "Não é sanção de improbidade.",
          C: "Absurdo.",
          D: "A lei existe para responsabilizar.",
        },
      }),
    ],
  }),

  phase({
    id: "legis-1",
    subjectId: "legis",
    number: 1,
    title: "Teletrabalho e eproc",
    objective:
      "Dominar Resolução TJSP 850/2021 (teletrabalho) e Resolução TJSP 963/2025 (eproc).",
    estimatedMinutes: 10,
    conceptsCount: 4,
    unlockRequiresPhaseIds: [],
    sources: [
      { label: "Resolução TJSP 850/2021 — teletrabalho" },
      { label: "Resolução TJSP 963/2025 — eproc" },
      { label: "LC 1.111/2010 — Plano de Cargos e Carreiras" },
      { label: "Regimento Interno do TJSP e Normas da CGJ" },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "lg1",
      contexto:
        "O Bloco II fecha com legislação interna: teletrabalho, eproc, carreira, regimento e normas da Corregedoria.",
      explicacao:
        "850/2021 = teletrabalho. 963/2025 = governança/uso do eproc. LC 1.111/2010 = cargos e carreiras. Regimento = organização do Tribunal. Normas CGJ = rotinas cartorárias/judiciais (Tomo I, capítulos indicados).",
      baseLegal: "Edital — item 6 Legislação Interna.",
      traducao:
        "Para o dia a dia do escrevente: saber que há regra de home office, sistema eproc, plano de carreira e manuais da Corregedoria que detalham o serviço.",
      exemplo:
        "Dúvida sobre prazo/ato cartorário → consultar Normas da Corregedoria. Dúvida sobre teletrabalho → Resolução 850/2021.",
      prova:
        "Associe número ↔ tema. Não invente conteúdo de artigo se a questão cobrir só a identificação da norma.",
      memorizar:
        "850 = teletrabalho. 963 = eproc. 1.111 = carreira. RI = Tribunal. CGJ = normas de serviço.",
      miniRevisao:
        "1) Teletrabalho? (850/2021) 2) eproc? (963/2025) 3) Carreira? (LC 1.111/2010)",
    }),
    questions: [
      q({
        id: "lg1-q1",
        difficulty: "facil",
        statement: "A Resolução TJSP nº 850/2021 regulamenta:",
        alternatives: [
          { key: "A", text: "O teletrabalho no âmbito do TJSP" },
          { key: "B", text: "O Código Penal" },
          { key: "C", text: "O Estatuto da Pessoa com Deficiência" },
          { key: "D", text: "A Lei de Improbidade" },
        ],
        correctKey: "A",
        legalBasis: "Edital — 6.1 Resolução 850/2021",
        whyCorrect: "A resolução trata do teletrabalho no TJSP.",
        whyWrong: {
          B: "CP é lei federal.",
          C: "Lei 13.146/2015.",
          D: "Lei 8.429/92.",
        },
      }),
      q({
        id: "lg1-q2",
        difficulty: "facil",
        statement: "A Resolução TJSP nº 963/2025 dispõe sobre:",
        alternatives: [
          { key: "A", text: "Governança e utilização do sistema eproc nas unidades do PJ/SP" },
          { key: "B", text: "Apenas o regimento do STF" },
          { key: "C", text: "Juros simples em matemática financeira" },
          { key: "D", text: "MS-Excel exclusivamente" },
        ],
        correctKey: "A",
        legalBasis: "Edital — 6.2 Resolução 963/2025",
        whyCorrect: "O edital descreve exatamente esse objeto.",
        whyWrong: {
          B: "Não é o tema.",
          C: "Bloco de Matemática.",
          D: "Bloco de Informática.",
        },
      }),
      q({
        id: "lg1-q3",
        difficulty: "media",
        statement: "A Lei Complementar nº 1.111/2010 institui:",
        alternatives: [
          {
            key: "A",
            text: "O Plano de Cargos e Carreiras dos servidores do TJSP",
          },
          { key: "B", text: "O Código de Processo Penal" },
          { key: "C", text: "Os Juizados Especiais Federais" },
          { key: "D", text: "A Constituição Estadual apenas" },
        ],
        correctKey: "A",
        legalBasis: "Edital — LC 1.111/2010",
        whyCorrect: "É a LC do plano de cargos e carreiras do TJSP.",
        whyWrong: {
          B: "CPP é diploma federal próprio.",
          C: "Não é o objeto.",
          D: "Constituição estadual é outra norma.",
        },
      }),
      q({
        id: "lg1-q4",
        difficulty: "media",
        statement: "As Normas da Corregedoria Geral da Justiça (recorte do edital) orientam, sobretudo:",
        alternatives: [
          { key: "A", text: "Rotinas e procedimentos dos serviços judiciais/cartorários" },
          { key: "B", text: "A política monetária do Banco Central" },
          { key: "C", text: "O currículo escolar da educação básica" },
          { key: "D", text: "O regimento do Congresso Nacional" },
        ],
        correctKey: "A",
        legalBasis: "Edital — Normas da CGJ (Tomo I, capítulos indicados)",
        whyCorrect: "São normas de serviço da Corregedoria para as unidades.",
        whyWrong: {
          B: "Fora do tema.",
          C: "Fora do tema.",
          D: "Fora do tema.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "lg1-b-q1",
        difficulty: "dificil",
        statement: "Associe corretamente:",
        alternatives: [
          {
            key: "A",
            text: "850/2021 = teletrabalho; 963/2025 = eproc; LC 1.111/2010 = cargos e carreiras",
          },
          {
            key: "B",
            text: "850/2021 = eproc; 963/2025 = teletrabalho; LC 1.111/2010 = Código Penal",
          },
          {
            key: "C",
            text: "Todas tratam exclusivamente de Direito Penal",
          },
          {
            key: "D",
            text: "Nenhuma existe no edital",
          },
        ],
        correctKey: "A",
        legalBasis: "Edital — Legislação Interna",
        whyCorrect: "Associações fiéis ao conteúdo programático.",
        whyWrong: {
          B: "Inverte resoluções e erra a LC.",
          C: "São normas internas/carreira.",
          D: "Constam do edital.",
        },
      }),
      q({
        id: "lg1-b-q2",
        difficulty: "facil",
        statement: "O Regimento Interno do TJSP disciplina, em linhas gerais:",
        alternatives: [
          { key: "A", text: "A organização e o funcionamento do Tribunal" },
          { key: "B", text: "Somente o MS-Teams" },
          { key: "C", text: "Apenas atualidades internacionais" },
          { key: "D", text: "Exclusivamente geometria plana" },
        ],
        correctKey: "A",
        legalBasis: "Edital — Regimento Interno do TJSP",
        whyCorrect: "Regimento interno organiza o Tribunal.",
        whyWrong: {
          B: "Informática.",
          C: "Atualidades.",
          D: "Matemática.",
        },
      }),
    ],
  }),
];

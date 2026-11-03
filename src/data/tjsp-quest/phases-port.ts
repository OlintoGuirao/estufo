import type { QuestPhase } from "@/types/tjsp-quest";
import { buildLessonBlocks, phase, q } from "./lesson";

/** Bloco I — Língua Portuguesa (edital TJSP). */
export const portPhases: QuestPhase[] = [
  phase({
    id: "port-1",
    subjectId: "port",
    number: 1,
    title: "Interpretação e coesão",
    objective:
      "Interpretar textos, distinguir informação literal de inferência e reconhecer recursos de coesão.",
    estimatedMinutes: 12,
    conceptsCount: 5,
    unlockRequiresPhaseIds: [],
    sources: [{ label: "Edital TJSP — Bloco I: Língua Portuguesa, itens 1 a 5" }],
    lessonBlocks: buildLessonBlocks({
      prefix: "p1",
      contexto:
        "Em prova de português do TJSP, a maioria das questões exige leitura atenta: o que o texto diz, o que se pode inferir e como as ideias se ligam.",
      explicacao:
        "Literal = está escrito. Inferência = conclusão razoável a partir do texto. Coesão = conectivos, pronomes e substituições que amarram as frases. Ponto de vista = opinião ou postura do autor.",
      baseLegal: "Conteúdo programático — análise, compreensão, interpretação; literal vs. inferência; ponto de vista; relações entre ideias e coesão; significação contextual.",
      traducao:
        "Leia a pergunta antes de caçar “pegadinha”. Se pedir o que o texto afirma, não invente. Se pedir o que se depreende, use só pistas do texto.",
      exemplo:
        "Texto: “O projeto atrasou, porém a equipe não desistiu.” O “porém” marca oposição (coesão). Inferência possível: houve dificuldade, mas houve perseverança.",
      prova:
        "Não confunda opinião do autor com fato narrado. Cuidado com alternativas que generalizam demais (“sempre”, “nunca”) sem apoio no texto.",
      memorizar: "Literal × inferência × coesão × ponto de vista. Conectivo = cola do texto.",
      miniRevisao:
        "1) Literal está onde? (No texto.) 2) Inferência exige o quê? (Pista + conclusão.) 3) “Porém” indica o quê? (Oposição.)",
    }),
    questions: [
      q({
        id: "p1-q1",
        difficulty: "facil",
        statement:
          "Em prova de interpretação, informação literal é aquela que:",
        alternatives: [
          { key: "A", text: "O leitor inventa com base na experiência pessoal" },
          { key: "B", text: "Está expressa ou diretamente sustentada pelo texto" },
          { key: "C", text: "Só aparece no título da prova" },
          { key: "D", text: "Depende exclusivamente do dicionário jurídico" },
        ],
        correctKey: "B",
        legalBasis: "Edital — informações literais e inferências",
        whyCorrect: "Literal é o que o texto diz de forma expressa ou inequívoca.",
        whyWrong: {
          A: "Isso extrapola o texto.",
          C: "O título da prova não define a literalidade do trecho.",
          D: "Não é critério de literalidade textual.",
        },
      }),
      q({
        id: "p1-q2",
        difficulty: "media",
        statement:
          'No período “Estudou bastante; portanto, foi aprovado”, o conectivo “portanto” estabelece relação de:',
        alternatives: [
          { key: "A", text: "Oposição" },
          { key: "B", text: "Conclusão/conclusividade" },
          { key: "C", text: "Adição sem nexo" },
          { key: "D", text: "Comparação" },
        ],
        correctKey: "B",
        legalBasis: "Edital — recursos de coesão; relações entre ideias",
        whyCorrect: "“Portanto” introduz conclusão a partir do que foi dito.",
        whyWrong: {
          A: "Oposição seria “mas”, “porém”, “contudo”.",
          C: "Há nexo lógico de conclusão.",
          D: "Comparação usaria “como”, “tal qual”, etc.",
        },
        memoryTip: "Portanto/logo/pois (conclusivo) = conclusão.",
      }),
      q({
        id: "p1-q3",
        difficulty: "media",
        statement:
          "Inferência textual válida é aquela que:",
        alternatives: [
          { key: "A", text: "Contradiz o texto, mas parece “mais moderna”" },
          { key: "B", text: "Decorre de pistas do texto, sem extrapolar o sentido" },
          { key: "C", text: "Repete palavra por palavra um trecho qualquer" },
          { key: "D", text: "Só existe se houver crase na frase" },
        ],
        correctKey: "B",
        legalBasis: "Edital — inferências possíveis",
        whyCorrect: "Inferência = conclusão autorizada pelo que o texto sugere.",
        whyWrong: {
          A: "Contradizer o texto invalida a inferência.",
          C: "Isso é literalidade, não inferência.",
          D: "Crase não define inferência.",
        },
      }),
      q({
        id: "p1-q4",
        difficulty: "facil",
        statement:
          "Identificar o ponto de vista do autor significa, em regra:",
        alternatives: [
          { key: "A", text: "Localizar a opinião, postura ou intenção revelada no texto" },
          { key: "B", text: "Contar quantas linhas o texto tem" },
          { key: "C", text: "Trocar sinônimos ao acaso" },
          { key: "D", text: "Ignorar conectivos e pronomes" },
        ],
        correctKey: "A",
        legalBasis: "Edital — ponto de vista do autor",
        whyCorrect: "Ponto de vista = como o autor se posiciona diante do tema.",
        whyWrong: {
          B: "Extensão não é ponto de vista.",
          C: "Sinonímia é outro tópico.",
          D: "Conectivos ajudam a perceber a postura.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "p1-b-q1",
        difficulty: "dificil",
        statement:
          "Assinale a afirmativa CORRETA sobre coesão textual:",
        alternatives: [
          {
            key: "A",
            text: "Pronomes e conectivos podem retomar ou relacionar ideias, garantindo continuidade",
          },
          { key: "B", text: "Coesão só existe em textos literários" },
          { key: "C", text: "Coesão proíbe o uso de sinônimos" },
          { key: "D", text: "Coesão elimina a necessidade de interpretação" },
        ],
        correctKey: "A",
        legalBasis: "Edital — estruturação do texto; recursos de coesão",
        whyCorrect: "Coesão amarra partes do texto por mecanismos linguísticos.",
        whyWrong: {
          B: "Há coesão em textos não literários também.",
          C: "Sinônimos podem ser recurso de coesão lexical.",
          D: "Coesão e interpretação caminham juntas.",
        },
      }),
      q({
        id: "p1-b-q2",
        difficulty: "media",
        statement:
          "Significação contextual de uma palavra é determinada principalmente:",
        alternatives: [
          { key: "A", text: "Pelo uso no trecho em que aparece" },
          { key: "B", text: "Pelo número de sílabas" },
          { key: "C", text: "Pela tipografia do edital" },
          { key: "D", text: "Pela cor do enunciado" },
        ],
        correctKey: "A",
        legalBasis: "Edital — significação contextual",
        whyCorrect: "O contexto fixa o sentido empregado no texto.",
        whyWrong: {
          B: "Sílabas não definem sentido contextual.",
          C: "Irrelevante.",
          D: "Irrelevante.",
        },
      }),
    ],
  }),

  phase({
    id: "port-2",
    subjectId: "port",
    number: 2,
    title: "Classes, concordância e crase",
    objective:
      "Dominar emprego das classes de palavras, concordância, regência, colocação pronominal, crase e pontuação.",
    estimatedMinutes: 14,
    conceptsCount: 6,
    unlockRequiresPhaseIds: ["port-1"],
    sources: [{ label: "Edital TJSP — Bloco I: Língua Portuguesa, itens 6 a 13" }],
    lessonBlocks: buildLessonBlocks({
      prefix: "p2",
      contexto:
        "A banca mistura gramática “seca” com sentido no texto: crase, concordância e regência caem o tempo todo.",
      explicacao:
        "Concordância: verbo com sujeito; adjetivo/artigo com substantivo. Regência: verbo/nome pede preposição. Crase: a + a (artigo/pronome). Colocação: próclise, ênclise, mesóclise.",
      baseLegal: "Edital — classes de palavras; concordância; regência; colocação pronominal; crase; pontuação; sinônimos/antônimos; sentido próprio e figurado.",
      traducao:
        "Antes de marcar crase: pergunte se há “a” preposição + “a” artigo/pronome feminino. Em verbos, ache o sujeito antes de concordar.",
      exemplo:
        "“Refiro-me à lei.” → crase (a + a). “Fazem dois anos…” → erro clássico: o verbo fazer (tempo decorrido) fica no singular: “Faz dois anos”.",
      prova:
        "Pegadinhas: crase antes de verbo (“a partir”); concordância com sujeito posposto; regência de “assistir” (TV = a).",
      memorizar:
        "Crase = a+a. Fazer (tempo) singular. Assisti ao filme. Sujeito manda no verbo.",
      miniRevisao:
        "1) Crase é fusão de quê? (a+a) 2) “Faz dois anos” ou “Fazem”? (Faz) 3) Quem manda na concordância verbal? (Sujeito)",
    }),
    questions: [
      q({
        id: "p2-q1",
        difficulty: "facil",
        statement: "A crase indica, em regra, a fusão de:",
        alternatives: [
          { key: "A", text: "Preposição “a” + artigo/pronome “a(s)”" },
          { key: "B", text: "Dois verbos no infinitivo" },
          { key: "C", text: "Substantivo + advérbio" },
          { key: "D", text: "Conjunção + interjeição" },
        ],
        correctKey: "A",
        legalBasis: "Edital — crase",
        whyCorrect: "Crase = fusão da preposição a com o a do artigo/pronome.",
        whyWrong: {
          B: "Não é definição de crase.",
          C: "Não.",
          D: "Não.",
        },
        memoryTip: "Crase = a + a.",
      }),
      q({
        id: "p2-q2",
        difficulty: "media",
        statement: "Assinale a frase com concordância verbal adequada:",
        alternatives: [
          { key: "A", text: "Fazem cinco anos que ele trabalha no fórum." },
          { key: "B", text: "Faz cinco anos que ele trabalha no fórum." },
          { key: "C", text: "Haviam muitos processos na mesa." },
          { key: "D", text: "Existe duas decisões contraditórias." },
        ],
        correctKey: "B",
        legalBasis: "Edital — concordância verbal",
        whyCorrect: "“Fazer” indicando tempo decorrido fica no singular.",
        whyWrong: {
          A: "Com tempo decorrido, “fazer” não pluraliza.",
          C: "“Haver” (= existir) é impessoal: “Havia”.",
          D: "O correto seria “Existem duas decisões…”.",
        },
      }),
      q({
        id: "p2-q3",
        difficulty: "media",
        statement: "Em “Não se trata de erro formal”, a colocação do pronome “se” é exemplo de:",
        alternatives: [
          { key: "A", text: "Ênclise" },
          { key: "B", text: "Próclise" },
          { key: "C", text: "Mesóclise" },
          { key: "D", text: "Elipse verbal" },
        ],
        correctKey: "B",
        legalBasis: "Edital — colocação pronominal",
        whyCorrect: "Pronome antes do verbo = próclise (atraído por “não”).",
        whyWrong: {
          A: "Ênclise = pronome depois do verbo (trata-se).",
          C: "Mesóclise = no meio (tratar-se-ia).",
          D: "Não há omissão do verbo.",
        },
      }),
      q({
        id: "p2-q4",
        difficulty: "facil",
        statement: "Sentido figurado ocorre quando a palavra:",
        alternatives: [
          { key: "A", text: "É usada fora do sentido literal habitual" },
          { key: "B", text: "Só aparece em dicionário jurídico" },
          { key: "C", text: "É sempre um verbo" },
          { key: "D", text: "Não pode ter sinônimo" },
        ],
        correctKey: "A",
        legalBasis: "Edital — sentido próprio e figurado",
        whyCorrect: "Figurado = metáfora/desvio do sentido próprio.",
        whyWrong: {
          B: "Não é critério.",
          C: "Qualquer classe pode ter sentido figurado.",
          D: "Pode ter sinônimo.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "p2-b-q1",
        difficulty: "dificil",
        statement: "Assinale a opção em que a crase está CORRETA:",
        alternatives: [
          { key: "A", text: "Ele começou à trabalhar cedo." },
          { key: "B", text: "Entreguei o ofício à servidora." },
          { key: "C", text: "Fui à pé até o fórum." },
          { key: "D", text: "Referiu-se à ele com respeito." },
        ],
        correctKey: "B",
        legalBasis: "Edital — crase",
        whyCorrect: "“À servidora” = a (prep.) + a (artigo) diante de feminino.",
        whyWrong: {
          A: "Antes de verbo no infinitivo não há crase.",
          C: "“A pé” é locução masculina; sem crase.",
          D: "Antes de pronome masculino “ele” não há crase.",
        },
      }),
      q({
        id: "p2-b-q2",
        difficulty: "media",
        statement: "Regência verbal correta:",
        alternatives: [
          { key: "A", text: "Assisti o filme ontem." },
          { key: "B", text: "Assisti ao filme ontem." },
          { key: "C", text: "Obedeço o regulamento sempre." },
          { key: "D", text: "Prefiro mais café do que chá." },
        ],
        correctKey: "B",
        legalBasis: "Edital — regência verbal",
        whyCorrect: "“Assistir” no sentido de ver/presenciar regência “a”.",
        whyWrong: {
          A: "Falta a preposição “a”.",
          C: "“Obedecer” pede “a”: obedeço ao regulamento.",
          D: "“Preferir” não admite “mais… do que” (preferir X a Y).",
        },
      }),
      q({
        id: "p2-b-q3",
        difficulty: "facil",
        statement: "Antônimo de “escasso” é:",
        alternatives: [
          { key: "A", text: "Abundante" },
          { key: "B", text: "Raro" },
          { key: "C", text: "Exíguo" },
          { key: "D", text: "Insuficiente" },
        ],
        correctKey: "A",
        legalBasis: "Edital — sinônimos e antônimos",
        whyCorrect: "Abundante é o oposto de escasso.",
        whyWrong: {
          B: "Raro aproxima-se de escasso.",
          C: "Exíguo ≈ escasso.",
          D: "Insuficiente ≈ escasso.",
        },
      }),
    ],
  }),
];

import type { QuestPhase } from "@/types/tjsp-quest";
import { buildLessonBlocks, phase, q } from "./lesson";

/** Bloco III — Atualidades/PCD, Matemática, Informática extra, RLM extra. */
export const geraisPhases: QuestPhase[] = [
  phase({
    id: "atual-1",
    subjectId: "atual",
    number: 1,
    title: "Estatuto da Pessoa com Deficiência",
    objective:
      "Dominar os arts. 1º–13 e 34–38 da Lei 13.146/2015 cobrados no edital (com alterações vigentes).",
    estimatedMinutes: 12,
    conceptsCount: 4,
    unlockRequiresPhaseIds: [],
    sources: [
      {
        label: "Lei 13.146/2015 — Estatuto da Pessoa com Deficiência (Planalto)",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm",
      },
    ],
    lessonBlocks: buildLessonBlocks({
      prefix: "at1",
      contexto:
        "Além de atualidades de mídia (1º semestre/2026), o edital cobra o Estatuto da Pessoa com Deficiência em artigos específicos.",
      explicacao:
        "A lei assegura e promove direitos com igualdade. Pessoa com deficiência = impedimento de longo prazo que, em interação com barreiras, pode obstruir participação plena. Acessibilidade e atendimento prioritário são eixos.",
      baseLegal: "Lei 13.146/2015, arts. 1º ao 13; 34 ao 38 (edital).",
      textoLegal:
        "Art. 1º: esta Lei destina-se a assegurar e a promover, em condições de igualdade, o exercício dos direitos e das liberdades fundamentais por pessoa com deficiência, visando à sua inclusão social e cidadania.",
      traducao:
        "Não é “favor”: é direito à igualdade e inclusão. Barreiras (urbanísticas, comunicacionais, atitudinais) devem ser eliminadas/compensadas.",
      exemplo:
        "Rampas, intérprete de Libras, prioridade em filas e adaptação razoável no trabalho/estudo.",
      prova:
        "Decore o conceito de pessoa com deficiência e a finalidade da lei (igualdade/inclusão). Atualidades de mídia mudam — foque em fatos amplamente divulgados do período cobrado.",
      memorizar:
        "13.146 = inclusão e igualdade. Deficiência + barreiras = obstáculo à participação. Arts. 34–38 = trabalho (recorte típico).",
      miniRevisao:
        "1) Qual o número da lei? (13.146/2015) 2) Finalidade? (Igualdade/inclusão) 3) Barreiras importam? (Sim)",
    }),
    questions: [
      q({
        id: "at1-q1",
        difficulty: "facil",
        statement: "O Estatuto da Pessoa com Deficiência é a:",
        alternatives: [
          { key: "A", text: "Lei n.º 13.146/2015" },
          { key: "B", text: "Lei n.º 8.429/92" },
          { key: "C", text: "Lei n.º 10.261/68" },
          { key: "D", text: "Lei n.º 9.099/95" },
        ],
        correctKey: "A",
        legalBasis: "Edital — Atualidades / Lei 13.146/2015",
        whyCorrect: "O edital aponta a Lei 13.146/2015.",
        whyWrong: {
          B: "Improbidade.",
          C: "Estatuto do servidor estadual.",
          D: "Juizados.",
        },
      }),
      q({
        id: "at1-q2",
        difficulty: "media",
        statement: "Nos termos do art. 1º da Lei 13.146/2015, a lei destina-se a:",
        alternatives: [
          {
            key: "A",
            text: "Assegurar e promover, em igualdade, direitos e liberdades da pessoa com deficiência, visando inclusão social e cidadania",
          },
          { key: "B", text: "Restringir o acesso a cargos públicos" },
          { key: "C", text: "Eliminar o direito ao trabalho" },
          { key: "D", text: "Substituir a Constituição Federal" },
        ],
        correctKey: "A",
        legalBasis: "Lei 13.146/2015, art. 1º",
        whyCorrect: "Reproduz a finalidade legal.",
        whyWrong: {
          B: "Contraria a inclusão.",
          C: "A lei protege o direito ao trabalho.",
          D: "Lei infraconstitucional.",
        },
      }),
      q({
        id: "at1-q3",
        difficulty: "media",
        statement:
          "Considera-se pessoa com deficiência, em síntese legal, aquela com impedimento de longo prazo que, em interação com barreiras, pode obstruir:",
        alternatives: [
          {
            key: "A",
            text: "A participação plena e efetiva na sociedade em igualdade de condições",
          },
          { key: "B", text: "Apenas a prática de esportes olímpicos" },
          { key: "C", text: "Somente o acesso a redes sociais" },
          { key: "D", text: "Exclusivamente a compra de imóveis rurais" },
        ],
        correctKey: "A",
        legalBasis: "Lei 13.146/2015, art. 2º",
        whyCorrect: "Conceito legal enfatiza participação plena e efetiva em igualdade.",
        whyWrong: {
          B: "Redutivo demais.",
          C: "Redutivo.",
          D: "Fora do conceito.",
        },
      }),
      q({
        id: "at1-q4",
        difficulty: "facil",
        statement: "A acessibilidade, no espírito do Estatuto, busca:",
        alternatives: [
          {
            key: "A",
            text: "Possibilitar uso, com segurança e autonomia, de espaços, mobiliários, transportes, comunicação e sistemas",
          },
          { key: "B", text: "Criar barreiras adicionais de entrada" },
          { key: "C", text: "Proibir qualquer adaptação razoável" },
          { key: "D", text: "Excluir a pessoa com deficiência do serviço público" },
        ],
        correctKey: "A",
        legalBasis: "Lei 13.146/2015 — acessibilidade (conceito)",
        whyCorrect: "Acessibilidade = autonomia e segurança no uso do meio.",
        whyWrong: {
          B: "O inverso do objetivo.",
          C: "Adaptação razoável é direito.",
          D: "Inclusão é a meta.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: "at1-b-q1",
        difficulty: "dificil",
        statement: "Os arts. 34 a 38 da Lei 13.146/2015, no recorte típico do edital, relacionam-se especialmente ao direito:",
        alternatives: [
          { key: "A", text: "Ao trabalho" },
          { key: "B", text: "Ao direito penal militar" },
          { key: "C", text: "Às regras de juros compostos" },
          { key: "D", text: "Ao MS-Excel" },
        ],
        correctKey: "A",
        legalBasis: "Lei 13.146/2015, arts. 34–38",
        whyCorrect: "Esse bloco trata do direito ao trabalho da pessoa com deficiência.",
        whyWrong: {
          B: "Não.",
          C: "Matemática.",
          D: "Informática.",
        },
      }),
      q({
        id: "at1-b-q2",
        difficulty: "media",
        statement: "Atualidades no edital TJSP cobram fatos políticos, econômicos, sociais e culturais ocorridos a partir de:",
        alternatives: [
          { key: "A", text: "O 1º semestre de 2026, divulgados na mídia local e/ou nacional" },
          { key: "B", text: "Exclusivamente o século XIX" },
          { key: "C", text: "Apenas fatos nunca divulgados" },
          { key: "D", text: "Somente decretos municipais secretos" },
        ],
        correctKey: "A",
        legalBasis: "Edital — Atualidades, item 1",
        whyCorrect: "O edital delimita o período a partir do 1º semestre de 2026.",
        whyWrong: {
          B: "Fora do marco temporal.",
          C: "Exige divulgação na mídia.",
          D: "Não é o critério do edital.",
        },
      }),
    ],
  }),

  phase({
    id: "mat-1",
    subjectId: "mat",
    number: 1,
    title: "Operações, proporção, % e juros",
    objective:
      "Resolver operações com reais, MMC/MDC, razão/proporção, %, regra de três e juros simples.",
    estimatedMinutes: 12,
    conceptsCount: 5,
    unlockRequiresPhaseIds: [],
    sources: [{ label: "Edital TJSP — Matemática, itens 1 a 7 e 13" }],
    lessonBlocks: buildLessonBlocks({
      prefix: "m1",
      contexto:
        "Matemática no TJSP é situacional: porcentagem, proporção, média e juros simples caem em problemas do cotidiano.",
      explicacao:
        "Porcentagem: x% = x/100. Regra de três: grandezas direta/inversamente proporcionais. Juros simples: J = C·i·t (i em decimal ou % coerente com t).",
      baseLegal: "Edital — Matemática (operações, MMC/MDC, razão, %, regra de três, médias, juros simples…).",
      traducao:
        "Sempre identifique o que é 100%. Em juros simples, juros não rendem juros. Em regra de três inversa, quando uma sobe a outra desce.",
      exemplo:
        "Produto de R$ 200 com 15% de desconto → 200×0,15=30; paga 170. Capital 1.000 a 2% a.m. por 3 meses (simples): J=1000×0,02×3=60.",
      prova:
        "Cuidado com “aumentou 20% e depois diminuiu 20%” — não volta ao mesmo valor. Confira unidades de tempo nos juros.",
      memorizar: "J=C·i·t. % = /100. Direta sobe junto; inversa sobe/desce.",
      miniRevisao:
        "1) 10% de 250? (25) 2) Fórmula juros simples? (J=Cit) 3) Aumentar 20% e reduzir 20% volta igual? (Não)",
    }),
    questions: [
      q({
        id: "m1-q1",
        difficulty: "facil",
        statement: "15% de 200 é igual a:",
        alternatives: [
          { key: "A", text: "30" },
          { key: "B", text: "15" },
          { key: "C", text: "45" },
          { key: "D", text: "20" },
        ],
        correctKey: "A",
        legalBasis: "Edital — porcentagem",
        whyCorrect: "200 × 0,15 = 30.",
        whyWrong: { B: "Seria 7,5%.", C: "Seria 22,5%.", D: "Seria 10%." },
      }),
      q({
        id: "m1-q2",
        difficulty: "media",
        statement:
          "Em juros simples, capital de R$ 2.000, taxa de 3% ao mês, durante 4 meses. Os juros são:",
        alternatives: [
          { key: "A", text: "R$ 240" },
          { key: "B", text: "R$ 120" },
          { key: "C", text: "R$ 60" },
          { key: "D", text: "R$ 2.240" },
        ],
        correctKey: "A",
        legalBasis: "Edital — juros simples",
        whyCorrect: "J = 2000 × 0,03 × 4 = 240.",
        whyWrong: {
          B: "Usou t=2.",
          C: "Usou t=1.",
          D: "Isso seria montante aproximado, não só juros.",
        },
        memoryTip: "J = C·i·t",
      }),
      q({
        id: "m1-q3",
        difficulty: "media",
        statement:
          "Se 3 servidores arquivam 90 processos em 6 horas (mesmo ritmo), em 4 horas arquivam:",
        alternatives: [
          { key: "A", text: "60 processos" },
          { key: "B", text: "45 processos" },
          { key: "C", text: "120 processos" },
          { key: "D", text: "30 processos" },
        ],
        correctKey: "A",
        legalBasis: "Edital — regra de três / proporção",
        whyCorrect: "Ritmo: 90/6 = 15 por hora; em 4 h → 60.",
        whyWrong: {
          B: "Seria 3 horas.",
          C: "Mais do que o total em 6 h.",
          D: "Seria 2 horas.",
        },
      }),
      q({
        id: "m1-q4",
        difficulty: "facil",
        statement: "A média aritmética simples de 6, 8 e 10 é:",
        alternatives: [
          { key: "A", text: "8" },
          { key: "B", text: "6" },
          { key: "C", text: "10" },
          { key: "D", text: "24" },
        ],
        correctKey: "A",
        legalBasis: "Edital — média aritmética",
        whyCorrect: "(6+8+10)/3 = 8.",
        whyWrong: { B: "Menor valor.", C: "Maior valor.", D: "Soma, não média." },
      }),
    ],
    bossQuestions: [
      q({
        id: "m1-b-q1",
        difficulty: "dificil",
        statement:
          "Uma taxa de 20% de aumento seguida de 20% de desconto sobre o novo preço resulta, em relação ao valor original, em:",
        alternatives: [
          { key: "A", text: "Redução líquida de 4%" },
          { key: "B", text: "Valor exatamente igual ao original" },
          { key: "C", text: "Aumento líquido de 20%" },
          { key: "D", text: "Aumento líquido de 40%" },
        ],
        correctKey: "A",
        legalBasis: "Edital — porcentagem / situações-problema",
        whyCorrect: "1,20 × 0,80 = 0,96 → 4% a menos.",
        whyWrong: {
          B: "Percentuais sobre bases diferentes.",
          C: "Não sobra +20%.",
          D: "Soma ingenua errada.",
        },
      }),
      q({
        id: "m1-b-q2",
        difficulty: "media",
        statement: "O MMC de 4 e 6 é:",
        alternatives: [
          { key: "A", text: "12" },
          { key: "B", text: "2" },
          { key: "C", text: "24" },
          { key: "D", text: "10" },
        ],
        correctKey: "A",
        legalBasis: "Edital — MMC",
        whyCorrect: "MMC(4,6)=12.",
        whyWrong: { B: "É o MDC.", C: "Múltiplo comum, não o mínimo.", D: "Não." },
      }),
    ],
  }),

  phase({
    id: "mat-2",
    subjectId: "mat",
    number: 2,
    title: "Equações e geometria básica",
    objective:
      "Resolver equações do 1º/2º grau, sistemas do 1º grau e geometria: forma, perímetro, área, volume, ângulo e Pitágoras.",
    estimatedMinutes: 12,
    conceptsCount: 4,
    unlockRequiresPhaseIds: ["mat-1"],
    sources: [{ label: "Edital TJSP — Matemática, itens 8 a 13" }],
    lessonBlocks: buildLessonBlocks({
      prefix: "m2",
      contexto:
        "Equações e geometria aparecem em problemas práticos: áreas de salas, diagonais, sistemas de preços.",
      explicacao:
        "1º grau: ax+b=0. 2º grau: bhaskara. Sistema: substituição/adição. Pitágoras: a²+b²=c² no triângulo retângulo. Área do retângulo = base×altura.",
      baseLegal: "Edital — equações, sistemas, medidas, geometria, tabelas/gráficos.",
      traducao:
        "Isole a incógnita. Em geometria, desenhe. Confira unidade (m, m², m³).",
      exemplo:
        "Triângulo 3-4-5: 3²+4²=9+16=25=5². Sala 5m×4m → área 20 m².",
      prova:
        "Não some lados para achar área. Volume usa três dimensões.",
      memorizar: "Pitágoras a²+b²=c². Área retângulo = b·h. Volume = b·h·p.",
      miniRevisao:
        "1) 3-4-? (5) 2) Área 6×3? (18) 3) ax+b=0 é de que grau? (1º)",
    }),
    questions: [
      q({
        id: "m2-q1",
        difficulty: "facil",
        statement: "A solução de 2x + 6 = 0 é:",
        alternatives: [
          { key: "A", text: "x = −3" },
          { key: "B", text: "x = 3" },
          { key: "C", text: "x = 0" },
          { key: "D", text: "x = 6" },
        ],
        correctKey: "A",
        legalBasis: "Edital — equação do 1º grau",
        whyCorrect: "2x = −6 → x = −3.",
        whyWrong: { B: "Sinal errado.", C: "Não satisfaz.", D: "Não." },
      }),
      q({
        id: "m2-q2",
        difficulty: "media",
        statement: "Em um triângulo retângulo com catetos 6 e 8, a hipotenusa é:",
        alternatives: [
          { key: "A", text: "10" },
          { key: "B", text: "14" },
          { key: "C", text: "48" },
          { key: "D", text: "7" },
        ],
        correctKey: "A",
        legalBasis: "Edital — teorema de Pitágoras",
        whyCorrect: "6²+8²=36+64=100 → 10.",
        whyWrong: { B: "Soma dos catetos.", C: "Produto.", D: "Sem fundamento." },
      }),
      q({
        id: "m2-q3",
        difficulty: "facil",
        statement: "A área de um retângulo 7 m × 3 m é:",
        alternatives: [
          { key: "A", text: "21 m²" },
          { key: "B", text: "20 m" },
          { key: "C", text: "10 m²" },
          { key: "D", text: "21 m³" },
        ],
        correctKey: "A",
        legalBasis: "Edital — área",
        whyCorrect: "7×3=21 m².",
        whyWrong: {
          B: "Perímetro seria 20 m.",
          C: "Cálculo errado.",
          D: "m³ é volume.",
        },
      }),
      q({
        id: "m2-q4",
        difficulty: "media",
        statement: "No sistema { x + y = 10 ; x − y = 2 }, o valor de x é:",
        alternatives: [
          { key: "A", text: "6" },
          { key: "B", text: "4" },
          { key: "C", text: "8" },
          { key: "D", text: "2" },
        ],
        correctKey: "A",
        legalBasis: "Edital — sistema de equações do 1º grau",
        whyCorrect: "Somando: 2x=12 → x=6 (y=4).",
        whyWrong: { B: "É o y.", C: "Não.", D: "É a diferença." },
      }),
    ],
    bossQuestions: [
      q({
        id: "m2-b-q1",
        difficulty: "dificil",
        statement: "As raízes de x² − 5x + 6 = 0 são:",
        alternatives: [
          { key: "A", text: "2 e 3" },
          { key: "B", text: "−2 e −3" },
          { key: "C", text: "1 e 6" },
          { key: "D", text: "0 e 5" },
        ],
        correctKey: "A",
        legalBasis: "Edital — equação do 2º grau",
        whyCorrect: "(x−2)(x−3)=0.",
        whyWrong: { B: "Sinais trocados.", C: "Produto 6 soma 7.", D: "Não." },
      }),
      q({
        id: "m2-b-q2",
        difficulty: "media",
        statement: "O perímetro de um quadrado de lado 5 é:",
        alternatives: [
          { key: "A", text: "20" },
          { key: "B", text: "25" },
          { key: "C", text: "10" },
          { key: "D", text: "15" },
        ],
        correctKey: "A",
        legalBasis: "Edital — perímetro",
        whyCorrect: "4×5=20.",
        whyWrong: { B: "Área.", C: "2 lados.", D: "3 lados." },
      }),
    ],
  }),
];

import type { QuestLessonBlock, QuestPhase, QuestQuestion } from "@/types/tjsp-quest";

type LessonInput = {
  prefix: string;
  contexto: string;
  explicacao: string;
  baseLegal: string;
  textoLegal?: string;
  traducao: string;
  exemplo: string;
  prova: string;
  memorizar: string;
  miniRevisao: string;
};

/** Monta os blocos padrão da aula (estilo Mastigado). */
export function buildLessonBlocks(input: LessonInput): QuestLessonBlock[] {
  const p = input.prefix;
  const blocks: QuestLessonBlock[] = [
    { id: `${p}-b1`, kind: "contexto", title: "Por que isso existe?", required: true, body: input.contexto },
    { id: `${p}-b2`, kind: "explicacao", title: "Explicação simples", required: true, body: input.explicacao },
    { id: `${p}-b3`, kind: "base-legal", title: "Base legal", required: true, body: input.baseLegal },
  ];
  if (input.textoLegal) {
    blocks.push({
      id: `${p}-b4`,
      kind: "texto-legal",
      title: "Texto legal (trecho)",
      required: true,
      body: input.textoLegal,
    });
  }
  blocks.push(
    { id: `${p}-b5`, kind: "traducao", title: "Tradução prática", required: true, body: input.traducao },
    { id: `${p}-b6`, kind: "exemplo", title: "Exemplo cotidiano", required: true, body: input.exemplo },
    { id: `${p}-b7`, kind: "prova", title: "Atenção à prova", required: true, body: input.prova },
    { id: `${p}-b8`, kind: "memorizar", title: "Resumo para memorizar", required: true, body: input.memorizar },
    { id: `${p}-b9`, kind: "mini-revisao", title: "Mini revisão", required: false, body: input.miniRevisao },
  );
  return blocks;
}

export function q(
  partial: Omit<QuestQuestion, "official"> & { official?: false },
): QuestQuestion {
  return { ...partial, official: false };
}

export type PhaseDraft = Omit<QuestPhase, "bossPassPct" | "contentVerifiedAt"> & {
  bossPassPct?: number;
  contentVerifiedAt?: string;
};

export function phase(draft: PhaseDraft): QuestPhase {
  return {
    bossPassPct: 80,
    contentVerifiedAt: "2026-10-20",
    ...draft,
  };
}

/** Fase enxuta alinhada ao edital — a IA gera o banco VUNESP na 1ª visita. */
export function editalPhase(input: {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  objective: string;
  unlockRequiresPhaseIds: string[];
  sources: { label: string; url?: string }[];
  estimatedMinutes?: number;
  conceptsCount?: number;
}): QuestPhase {
  const topic = input.title;
  const fonte = input.sources[0]?.label ?? "Edital TJSP Escrevente";
  const prefix = input.id.replace(/-/g, "");
  return phase({
    id: input.id,
    subjectId: input.subjectId,
    number: input.number,
    title: input.title,
    objective: input.objective,
    estimatedMinutes: input.estimatedMinutes ?? 12,
    conceptsCount: input.conceptsCount ?? 4,
    unlockRequiresPhaseIds: input.unlockRequiresPhaseIds,
    sources: input.sources,
    lessonBlocks: buildLessonBlocks({
      prefix,
      contexto: `Conteúdo programático do TJSP Escrevente: ${topic}.`,
      explicacao: input.objective,
      baseLegal: input.sources.map((s) => s.label).join(" · "),
      traducao: `Na prova, cobre hipóteses concretas sobre: ${topic}.`,
      exemplo: `Priorize aplicação do conceito/norma de ${topic}, não memorização vazia do edital.`,
      prova: "Cuidado com institutos vizinhos e exceções expressas.",
      memorizar: topic,
      miniRevisao: `Revise o núcleo de ${topic} antes de avançar.`,
    }),
    questions: [
      q({
        id: `${input.id}-q1`,
        difficulty: "facil",
        statement: `Sobre ${topic}, assinale a alternativa correta.`,
        alternatives: [
          { key: "A", text: "Afirmação alinhada ao núcleo do tema" },
          { key: "B", text: "Confunde com instituto vizinho" },
          { key: "C", text: "Generaliza além da norma" },
          { key: "D", text: "Inverte a regra principal" },
        ],
        correctKey: "A",
        legalBasis: fonte,
        whyCorrect: "Placeholder do catálogo — questões VUNESP são geradas por IA na 1ª visita.",
        whyWrong: {
          B: "Instituto vizinho.",
          C: "Extrapolação.",
          D: "Inversão típica de pegadinha.",
        },
      }),
      q({
        id: `${input.id}-q2`,
        difficulty: "media",
        statement: `Em situação típica de prova envolvendo ${topic}, a solução correta costuma:`,
        alternatives: [
          { key: "A", text: "Aplicar o dispositivo/conceito no limite do enunciado" },
          { key: "B", text: "Ignorar a norma e chutar por intuição" },
          { key: "C", text: "Misturar ramos distintos sem critério" },
          { key: "D", text: "Restringir-se ao nome do edital" },
        ],
        correctKey: "A",
        legalBasis: fonte,
        whyCorrect: "Questões cobram aplicação, não o roteiro do edital.",
        whyWrong: {
          B: "Intuição sem base.",
          C: "Mistura indevida.",
          D: "Meta-edital não é o foco.",
        },
      }),
    ],
    bossQuestions: [
      q({
        id: `${input.id}-b-q1`,
        difficulty: "dificil",
        statement: `Questão integrada sobre ${topic}. Assinale a correta.`,
        alternatives: [
          { key: "A", text: "Aplicação correta da norma/conceito" },
          { key: "B", text: "Erro de tipificação ou conceito" },
          { key: "C", text: "Prazo/efeito invertido" },
          { key: "D", text: "Competência ou sujeito errado" },
        ],
        correctKey: "A",
        legalBasis: fonte,
        whyCorrect: "Placeholder — banco pleno via IA.",
        whyWrong: {
          B: "Tipificação/conceito incorreto.",
          C: "Efeito invertido.",
          D: "Sujeito/competência incorretos.",
        },
      }),
    ],
  });
}

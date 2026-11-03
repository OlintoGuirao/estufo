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

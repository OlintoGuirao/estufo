import { balanceCorrectKeys } from "@/lib/quiz/balance-keys";
import type { StudyPackAi } from "@/lib/tutor/study-pack";

/** Questão objetiva gerada pela IA (treino — não é item oficial de banca). */
export type StudyPackQuestion = {
  statement: string;
  alternatives: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  topic: string;
  /** tempId do nó do mapa, se houver. */
  nodeId?: string | null;
};

const KEYS = ["A", "B", "C", "D", "E"] as const;

export function buildAiQuestionsMessages(input: {
  subject: string;
  title: string;
  material: string;
  count: number;
  nodes: { tempId: string; title: string; kind: string; summary: string }[];
}): { role: "system" | "user"; content: string }[] {
  const nodeLines = input.nodes
    .filter((n) => n.kind === "artigo" || n.kind === "explicacao" || n.kind === "conceito")
    .slice(0, 20)
    .map((n) => `- [${n.tempId}] (${n.kind}) ${n.title}: ${n.summary.slice(0, 180)}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "Voce e professor de concursos (Brasil). Crie QUESTOES OBJETIVAS de TREINO a partir do MATERIAL e do mapa mental.",
        "Nao sao itens oficiais de banca — sao para estudar o material do aluno.",
        "Use APENAS o MATERIAL (e os cards do mapa). Nao invente tipificacao, pena ou doutrina fora do texto.",
        "",
        "Formato: multipla escolha A–E (5 alternativas). Uma correta.",
        "Estilo VUNESP/cebraspe leve: enunciado claro, pegadinhas tipicas (trocar verbos nucleares, misturar arts vizinhos).",
        "explanation: diga por que a correta e por que 1–2 erradas falham (sem inventar).",
        "",
        "Responda SOMENTE JSON:",
        '{"questions":[{"statement":"...","alternatives":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}],"correctKey":"D","explanation":"...","topic":"Art. 293","nodeId":"a293"}]}',
        "Varie a posicao da correta entre A, B, C, D e E (nao concentre em A/B).",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Projeto: ${input.title}`,
        `Materia: ${input.subject}`,
        `Quantidade: ${input.count} questoes (min 4, max 16).`,
        "",
        "Cards do mapa:",
        nodeLines || "(sem cards detalhados)",
        "",
        "MATERIAL:",
        input.material.slice(0, 45_000),
      ].join("\n"),
    },
  ];
}

export function parseAiQuestionsJson(raw: string): StudyPackQuestion[] {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  let data: { questions?: unknown };
  try {
    data = JSON.parse(cleaned) as { questions?: unknown };
  } catch {
    throw new Error("A IA devolveu JSON inválido das questões.");
  }
  const list = Array.isArray(data.questions) ? data.questions : [];
  const out: StudyPackQuestion[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const statement = String(o.statement ?? "").trim().slice(0, 900);
    if (statement.length < 20) continue;

    const altsRaw = Array.isArray(o.alternatives) ? o.alternatives : [];
    const alternatives: { key: string; text: string }[] = [];
    for (const a of altsRaw) {
      if (!a || typeof a !== "object") continue;
      const ar = a as Record<string, unknown>;
      const key = String(ar.key ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 1);
      const text = String(ar.text ?? "").trim().slice(0, 400);
      if (!KEYS.includes(key as (typeof KEYS)[number]) || text.length < 2) continue;
      if (alternatives.some((x) => x.key === key)) continue;
      alternatives.push({ key, text });
    }
    if (alternatives.length < 4) continue;

    const correctKey = String(o.correctKey ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 1);
    if (!alternatives.some((a) => a.key === correctKey)) continue;

    out.push({
      statement,
      alternatives: alternatives.slice(0, 5),
      correctKey,
      explanation: String(o.explanation ?? "").trim().slice(0, 1200),
      topic: String(o.topic ?? "").trim().slice(0, 120) || "Geral",
      nodeId: o.nodeId != null ? String(o.nodeId).slice(0, 80) : null,
    });
  }

  // A IA vicia a correta em A/B — redistribui entre A–E.
  return balanceCorrectKeys(out.slice(0, 16));
}

export function mockAiQuestions(pack: StudyPackAi): StudyPackQuestion[] {
  const arts = pack.nodes.filter((n) => n.kind === "artigo").slice(0, 4);
  if (!arts.length) {
    return [
      {
        statement:
          "Com base no material de estudo, assinale a alternativa que melhor descreve o tema central do mapa:",
        alternatives: [
          { key: "A", text: pack.centralTitle || "Tema do material" },
          { key: "B", text: "Direito tributário municipal exclusivo" },
          { key: "C", text: "Normas de trânsito da CTB" },
          { key: "D", text: "Processo eleitoral" },
          { key: "E", text: "Direito ambiental internacional" },
        ],
        correctKey: "A",
        explanation: "A alternativa A corresponde ao tema central do pacote (modo demonstrativo).",
        topic: pack.centralTitle,
        nodeId: null,
      },
    ];
  }

  return arts.map((art) => {
    const exp = pack.nodes.find(
      (n) => n.kind === "explicacao" && n.parentTempId === art.tempId,
    );
    const tip = (exp?.summary || art.summary || art.title).slice(0, 220);
    return {
      statement: `Sobre o ${art.title}, assinale a alternativa correta quanto à tipificação (conforme o material):`,
      alternatives: [
        { key: "A", text: tip || `Conteúdo do ${art.title}` },
        { key: "B", text: "Crime culposo de trânsito sem relação com o artigo" },
        { key: "C", text: "Matéria exclusiva de direito eleitoral" },
        { key: "D", text: "Apenas infração administrativa sem tipificação penal" },
        { key: "E", text: "Tipo penal revogado sem qualquer correspondente atual" },
      ],
      correctKey: "A",
      explanation: `Conforme o material, o ${art.title}: ${tip}`,
      topic: art.title,
      nodeId: art.tempId,
    };
  }).slice(0, 6);
}

/** Une questões da IA ao pacote (substitui lista anterior). */
export function applyAiQuestions(
  pack: StudyPackAi,
  questions: StudyPackQuestion[],
): StudyPackAi & { questions: StudyPackQuestion[] } {
  return {
    ...pack,
    questions,
    warnings: questions.length
      ? [
          ...pack.warnings,
          `${questions.length} questão(ões) de treino geradas pela IA a partir do material.`,
        ]
      : pack.warnings,
  };
}

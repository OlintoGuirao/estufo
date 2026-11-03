import type {
  QuestAltKey,
  QuestLessonBlock,
  QuestLessonBlockKind,
  QuestPhase,
  QuestQuestion,
} from "@/types/tjsp-quest";
import { buildLessonBlocks, q } from "@/data/tjsp-quest/lesson";

const ALT_KEYS: QuestAltKey[] = ["A", "B", "C", "D", "E"];
const BLOCK_KINDS = new Set<QuestLessonBlockKind>([
  "contexto",
  "explicacao",
  "base-legal",
  "texto-legal",
  "traducao",
  "exemplo",
  "prova",
  "memorizar",
  "mini-revisao",
]);

export type QuestPhaseAiPayload = {
  lessonBlocks: QuestLessonBlock[];
  questions: QuestQuestion[];
  bossQuestions: QuestQuestion[];
};

export type QuestPhaseAiMeta = {
  phaseId: string;
  subjectName: string;
  title: string;
  objective: string;
  sources: { label: string; url?: string }[];
};

/** Prompt: material da aula + questões estilo VUNESP (A–E). */
export function buildQuestPhaseAiMessages(meta: QuestPhaseAiMeta): {
  role: "system" | "user";
  content: string;
}[] {
  const fontes = meta.sources
    .map((s) => (s.url ? `- ${s.label} (${s.url})` : `- ${s.label}`))
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "Voce e autor didatico e elaborador de questoes no PADRAO VUNESP para o concurso TJSP Escrevente.",
        "Gere MATERIAL DE AULA + QUESTOES DE TREINO. Nao sao itens oficiais de banca.",
        "",
        "PADRAO VUNESP (obrigatorio nas questoes):",
        "- Sempre 5 alternativas: A, B, C, D, E.",
        "- Enunciado formal, objetivo; pode ter texto de apoio curto quando fizer sentido.",
        "- Feche com 'Assinale a alternativa correta.' quando couber.",
        "- Distratores plausiveis (troca de verbos nucleares, arts vizinhos, excecao como regra).",
        "- Uma unica correta. Sem 'todas as anteriores' / 'nenhuma das anteriores'.",
        "- Linguagem de prova (nao gíria).",
        "",
        "MATERIAL (lessonBlocks): blocos no estilo Mastigado, portugues claro.",
        "kinds obrigatorios: contexto, explicacao, base-legal, texto-legal (se houver trecho), traducao, exemplo, prova, memorizar, mini-revisao.",
        "required=true em todos exceto mini-revisao (required=false).",
        "",
        "Questoes: 6 para desafio (mix facil/media/dificil) + 4 chefao (mais dificeis).",
        "Baseie-se no edital/objetivo/fontes. Nao invente artigos inexistentes; se inseguro, use warnings no texto da base-legal.",
        "",
        "Responda SOMENTE JSON:",
        '{"lessonBlocks":[{"id":"b1","kind":"contexto","title":"...","body":"...","required":true}],"questions":[{"id":"q1","statement":"...","alternatives":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}],"correctKey":"C","legalBasis":"...","whyCorrect":"...","whyWrong":{"A":"...","B":"...","D":"...","E":"..."},"memoryTip":"...","difficulty":"media"}],"bossQuestions":[...mesmo formato...]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Fase id: ${meta.phaseId}`,
        `Materia: ${meta.subjectName}`,
        `Titulo: ${meta.title}`,
        `Objetivo: ${meta.objective}`,
        "Fontes / referencias:",
        fontes || "(edital TJSP Escrevente — VUNESP)",
        "",
        "Gere a aula completa e as questoes no padrao VUNESP (A–E).",
      ].join("\n"),
    },
  ];
}

function parseQuestion(
  raw: unknown,
  idPrefix: string,
  index: number,
): QuestQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const statement = String(o.statement ?? "").trim().slice(0, 1200);
  if (statement.length < 25) return null;

  const altsRaw = Array.isArray(o.alternatives) ? o.alternatives : [];
  const alternatives: { key: QuestAltKey; text: string }[] = [];
  for (const a of altsRaw) {
    if (!a || typeof a !== "object") continue;
    const ar = a as Record<string, unknown>;
    const key = String(ar.key ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 1) as QuestAltKey;
    const text = String(ar.text ?? "").trim().slice(0, 500);
    if (!ALT_KEYS.includes(key) || text.length < 2) continue;
    if (alternatives.some((x) => x.key === key)) continue;
    alternatives.push({ key, text });
  }
  // VUNESP exige 5; aceita 4 só se a IA falhar parcialmente (completa com placeholder genérico? — rejeita)
  if (alternatives.length < 5) return null;

  const correctKey = String(o.correctKey ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 1) as QuestAltKey;
  if (!alternatives.some((a) => a.key === correctKey)) return null;

  const whyWrongRaw =
    o.whyWrong && typeof o.whyWrong === "object"
      ? (o.whyWrong as Record<string, unknown>)
      : {};
  const whyWrong: QuestQuestion["whyWrong"] = {};
  for (const k of ALT_KEYS) {
    if (k === correctKey) continue;
    const t = String(whyWrongRaw[k] ?? "").trim().slice(0, 400);
    if (t) whyWrong[k] = t;
  }

  const diff = String(o.difficulty ?? "media").toLowerCase();
  const difficulty =
    diff === "facil" || diff === "dificil" ? diff : "media";

  return q({
    id: String(o.id ?? `${idPrefix}${index + 1}`).slice(0, 64),
    statement,
    alternatives: alternatives.slice(0, 5),
    correctKey,
    legalBasis: String(o.legalBasis ?? "").trim().slice(0, 300) || "Conforme material da fase.",
    whyCorrect: String(o.whyCorrect ?? "").trim().slice(0, 800) || "Alternativa alinhada à tipificação/regra do tema.",
    whyWrong,
    memoryTip: String(o.memoryTip ?? "").trim().slice(0, 200) || undefined,
    difficulty,
    boardStyle: "VUNESP",
  });
}

function parseBlocks(raw: unknown, phaseId: string): QuestLessonBlock[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: QuestLessonBlock[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const kind = String(o.kind ?? "") as QuestLessonBlockKind;
    if (!BLOCK_KINDS.has(kind)) return;
    const body = String(o.body ?? "").trim().slice(0, 4000);
    if (body.length < 20) return;
    out.push({
      id: String(o.id ?? `${phaseId}-ai-b${i + 1}`).slice(0, 64),
      kind,
      title: String(o.title ?? kind).trim().slice(0, 80) || kind,
      body,
      required: kind === "mini-revisao" ? false : o.required !== false,
    });
  });
  return out;
}

export function parseQuestPhaseAiJson(raw: string, phaseId: string): QuestPhaseAiPayload {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error("A IA devolveu JSON inválido do conteúdo da fase.");
  }

  const lessonBlocks = parseBlocks(data.lessonBlocks, phaseId);
  if (lessonBlocks.length < 5) {
    throw new Error("Material da aula insuficiente (mínimo 5 blocos).");
  }

  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map((item, i) => parseQuestion(item, `${phaseId}-q`, i))
    .filter((x): x is QuestQuestion => !!x)
    .slice(0, 8);
  if (questions.length < 3) {
    throw new Error("Questões VUNESP insuficientes (mínimo 3 com A–E).");
  }

  const bossQuestions = (Array.isArray(data.bossQuestions) ? data.bossQuestions : [])
    .map((item, i) => parseQuestion(item, `${phaseId}-boss`, i))
    .filter((x): x is QuestQuestion => !!x)
    .slice(0, 6);

  return {
    lessonBlocks,
    questions,
    bossQuestions: bossQuestions.length >= 2 ? bossQuestions : questions.slice(0, 4),
  };
}

/** Fallback mock estilo VUNESP quando Gemini não está disponível. */
export function mockQuestPhaseAiContent(phase: QuestPhase): QuestPhaseAiPayload {
  const topic = phase.title;
  const lessonBlocks =
    phase.lessonBlocks.length >= 5
      ? phase.lessonBlocks
      : buildLessonBlocks({
          prefix: `${phase.id}-mock`,
          contexto: `Este bloco introduz ${topic} no contexto do edital TJSP (treino).`,
          explicacao: `Explicação didática de ${topic}: foque nos conceitos cobrados pela VUNESP.`,
          baseLegal: phase.sources.map((s) => s.label).join("; ") || "Edital / legislação indicada.",
          textoLegal: `Trecho de referência para estudo de ${topic} (modo demonstrativo).`,
          traducao: `Em termos práticos: ${phase.objective}`,
          exemplo: `Exemplo hipotético aplicado a ${topic}.`,
          prova: "Na VUNESP, atenha-se ao verbo nuclear e às exceções expressas no texto legal.",
          memorizar: phase.objective,
          miniRevisao: `Revise: ${topic}.`,
        });

  const mk = (
    id: string,
    statement: string,
    correct: QuestAltKey,
    difficulty: QuestQuestion["difficulty"],
  ): QuestQuestion =>
    q({
      id,
      statement: `${statement}\n\nAssinale a alternativa correta.`,
      alternatives: [
        { key: "A", text: `Afirmação alinhada ao núcleo de ${topic}` },
        { key: "B", text: "Troca o verbo nuclear por outro tipo penal/conceito vizinho" },
        { key: "C", text: "Generaliza regra sem prever a exceção legal" },
        { key: "D", text: "Aplica hipótese de outro ramo do direito" },
        { key: "E", text: "Inverte sujeito e objeto da norma" },
      ],
      correctKey: correct,
      legalBasis: phase.sources[0]?.label ?? "Material da fase (mock)",
      whyCorrect: `A alternativa ${correct} reflete o ponto central de ${topic} (modo demonstrativo · configure GEMINI_API_KEY).`,
      whyWrong: {
        A: correct === "A" ? undefined : "Não corresponde ao núcleo tipico/regra.",
        B: correct === "B" ? undefined : "Confunde com instituto vizinho.",
        C: correct === "C" ? undefined : "Ignora limite legal.",
        D: correct === "D" ? undefined : "Fora do tema da fase.",
        E: correct === "E" ? undefined : "Inversão típica de pegadinha.",
      },
      memoryTip: `Lembre o núcleo de ${topic}.`,
      difficulty,
      boardStyle: "VUNESP",
    });

  const questions = [
    mk(`${phase.id}-ai-q1`, `Acerca de ${topic}, conforme o edital TJSP`, "A", "facil"),
    mk(`${phase.id}-ai-q2`, `No padrão cobrado pela VUNESP sobre ${topic}`, "A", "media"),
    mk(`${phase.id}-ai-q3`, `Assinale a opção correta relativa a ${topic}`, "A", "media"),
    mk(`${phase.id}-ai-q4`, `Em relação a ${topic}, é correto afirmar`, "A", "dificil"),
    mk(`${phase.id}-ai-q5`, `Sobre ${topic} e suas distinções típicas`, "A", "media"),
    mk(`${phase.id}-ai-q6`, `Para fins de prova objetiva VUNESP, ${topic}`, "A", "facil"),
  ];

  const bossQuestions = [
    mk(`${phase.id}-ai-boss1`, `Chefão — análise avançada de ${topic}`, "A", "dificil"),
    mk(`${phase.id}-ai-boss2`, `Chefão — pegadinha clássica VUNESP em ${topic}`, "A", "dificil"),
    mk(`${phase.id}-ai-boss3`, `Chefão — aplicação conjunta de regras de ${topic}`, "A", "dificil"),
    mk(`${phase.id}-ai-boss4`, `Chefão — distinção fina no tema ${topic}`, "A", "dificil"),
  ];

  return { lessonBlocks, questions, bossQuestions };
}

export function mergePhaseWithAi(
  base: QuestPhase,
  ai: QuestPhaseAiPayload,
): QuestPhase {
  return {
    ...base,
    lessonBlocks: ai.lessonBlocks,
    questions: ai.questions,
    bossQuestions: ai.bossQuestions,
    contentVerifiedAt: new Date().toISOString().slice(0, 10),
  };
}

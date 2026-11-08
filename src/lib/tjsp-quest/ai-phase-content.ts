import type {
  QuestAltKey,
  QuestLessonBlock,
  QuestLessonBlockKind,
  QuestPhase,
  QuestQuestion,
} from "@/types/tjsp-quest";
import { q } from "@/data/tjsp-quest/lesson";

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

/** Bump para invalidar cache antigo (banco ampliado de português). */
export const QUEST_PHASE_AI_CONTENT_VERSION = 6;

/** Português: ~50/fase × 6 fases ≈ 300 questões. Demais matérias: pacote padrão. */
export function getQuestQuestionTargets(subjectId: string): {
  desafio: number;
  boss: number;
} {
  if (subjectId === "port" || subjectId.startsWith("port")) {
    // 10 trilhas × 5 questões + 1 chefe por trilha ≈ 60 (meta ~300 na matéria).
    return { desafio: 50, boss: 10 };
  }
  return { desafio: 6, boss: 4 };
}

/**
 * Tamanho de cada lote na geração (cabe no JSON da IA).
 * Português pede ~50+10: no máx. QUEST_AI_MAX_BATCHES chamadas + pad mock.
 */
export const QUEST_AI_BATCH = { desafio: 12, boss: 5 } as const;

/** Evita 7× Gemini seguidos (trava Regenerar / timeout Vercel). */
export const QUEST_AI_MAX_BATCHES = 2;

/** Quantas questões caem por sessão de jogo (amostra do banco). */
export const QUEST_SESSION_SIZE = { desafio: 12, boss: 6 } as const;

export type QuestPhaseAiPayload = {
  lessonBlocks: QuestLessonBlock[];
  questions: QuestQuestion[];
  bossQuestions: QuestQuestion[];
  contentVersion?: number | undefined;
};

export type QuestPhaseAiMeta = {
  phaseId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  objective: string;
  sources: { label: string; url?: string | undefined }[];
  /** Questões reais VUNESP/TJSP formatadas (few-shot de estilo). */
  examples?: string;
  /** Lei seca recuperada (RAG) para fundamentar questões de direito. */
  legalContext?: string;
  /** Começo dos enunciados que o aluno já tem — não repetir. */
  avoid?: string[];
  /** Itens do edital que esta fase cobra (todos devem aparecer ao longo da trilha). */
  editalItems?: string[];
  /** Itens do edital em foco NESTE lote (rodízio por etapa). */
  editalFocus?: string[];
};

export type QuestPhaseAiBatchOpts = {
  desafioCount: number;
  bossCount: number;
  batchIndex: number;
  batchTotal: number;
};

function isPortugueseSubject(subjectId: string, subjectName: string): boolean {
  const id = subjectId.toLowerCase();
  const name = subjectName.toLowerCase();
  return (
    id.startsWith("port") ||
    name.includes("portugu") ||
    name.includes("língua") ||
    name.includes("lingua")
  );
}

export function sampleQuestions<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

/** Prompt: QUESTÕES de prova em 1º plano (não aula/edital). */
export function buildQuestPhaseAiMessages(
  meta: QuestPhaseAiMeta,
  batch?: QuestPhaseAiBatchOpts,
): {
  role: "system" | "user";
  content: string;
}[] {
  const fontes = meta.sources
    .map((s) => (s.url ? `- ${s.label} (${s.url})` : `- ${s.label}`))
    .join("\n");
  const isPort = isPortugueseSubject(meta.subjectId, meta.subjectName);
  const desafioCount = batch?.desafioCount ?? 6;
  const bossCount = batch?.bossCount ?? 4;
  const batchLabel =
    batch && batch.batchTotal > 1
      ? `Lote ${batch.batchIndex}/${batch.batchTotal}. `
      : "";

  const subjectRules = isPort
    ? [
        "MATERIA = LINGUA PORTUGUESA (VUNESP / TJSP Escrevente).",
        "PROIBIDO: perguntar o que o edital lista, quantos itens tem o programa, ou 'conforme o edital'.",
        "OBRIGATORIO nas questoes:",
        "- Interpretacao: texto de apoio curto (3–8 linhas) + pergunta sobre sentido, inferencia, coesao, ponto de vista.",
        "- Gramatica (classes de palavras, concordancia, regencia, colocacao pronominal, crase, pontuacao): enunciado com frase ou trecho concreto.",
        "- NAO cobre ortografia nem acentuacao isoladas (fora do edital TJSP).",,
        "- Alternativas testam CONTEUDO de portugues, nao o roteiro do edital.",
        "Varie os temas e os textos de apoio — NAO repita enunciados.",
        `Pelo menos ${Math.min(4, desafioCount)} questoes de desafio devem ter texto de apoio no enunciado.`,
      ]
    : [
        "MATERIA DE DIREITO / CONHECIMENTOS GERAIS DO CONCURSO.",
        "PROIBIDO: 'conforme o edital', 'o programa exige', 'o item do edital'.",
        "OBRIGATORIO: questoes de APLICACAO da norma/conceito (caso, tipificacao, prazo, competencia, efeito juridico).",
        "Use artigos/leis reais do tema quando souber; se inseguro, nao invente numero de artigo.",
      ];

  return [
    {
      role: "system",
      content: [
        "Voce e elaborador de QUESTOES objetivas no PADRAO VUNESP (TJSP Escrevente).",
        "PRIORIDADE ABSOLUTA: treinar o aluno com QUESTOES. Nao e professor explicando materia.",
        "",
        "PROIBIDO nas questoes:",
        "- Perguntas meta sobre o edital, a banca, a estrutura do programa ou 'o que cai'.",
        "- Enunciados do tipo 'Acerca do edital…', 'Segundo o conteudo programatico…'.",
        "- Aulas longas disfarçadas de enunciado.",
        "",
        ...subjectRules,
        "",
        "PADRAO VUNESP:",
        "- Sempre 5 alternativas A–E; uma unica correta.",
        "- Enunciado formal; fechar com 'Assinale a alternativa correta.' quando couber.",
        "- Distratores plausiveis; sem 'todas/nenhuma das anteriores'.",
        "",
        "lessonBlocks: no maximo 3 blocos CURTOS (dica de prova / pegadinha). Todos required=false.",
        "kinds permitidos: prova, memorizar, mini-revisao. NAO gere aula completa (sem contexto/explicacao/base-legal longos).",
        "",
        `Questoes neste lote: ${desafioCount} desafio (mix facil/media/dificil) + ${bossCount} chefao (mais dificeis).`,
        "legalBasis = fundamento da resposta (regra gramatical OU artigo/lei), NUNCA 'Edital item X'.",
        "",
        "Responda SOMENTE JSON:",
        '{"lessonBlocks":[{"id":"b1","kind":"prova","title":"Dica","body":"...","required":false}],"questions":[{"id":"q1","statement":"...","alternatives":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."},{"key":"E","text":"..."}],"correctKey":"C","legalBasis":"...","whyCorrect":"...","whyWrong":{"A":"...","B":"...","D":"...","E":"..."},"memoryTip":"...","difficulty":"media"}],"bossQuestions":[...mesmo formato...]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Fase id: ${meta.phaseId}`,
        `subjectId: ${meta.subjectId}`,
        `Materia: ${meta.subjectName}`,
        `Titulo do tema: ${meta.title}`,
        `Objetivo do tema (so referencia do assunto — NAO virar pergunta sobre edital): ${meta.objective}`,
        meta.editalItems?.length
          ? `CONTEUDO DO EDITAL DESTA FASE (cobre SO isto; nao saia do recorte de artigos):\n${meta.editalItems.map((t) => `- ${t}`).join("\n")}`
          : "",
        meta.editalFocus?.length
          ? `FOCO DESTE LOTE (pelo menos metade das questoes sobre estes itens):\n${meta.editalFocus.map((t) => `- ${t}`).join("\n")}`
          : "",
        "Referencias (contexto interno; nao citar como enunciado):",
        fontes || "(programa TJSP Escrevente — VUNESP)",
        "",
        `${batchLabel}${
          isPort
            ? `Gere EXATAMENTE ${desafioCount} questoes de desafio + ${bossCount} de chefao de PORTUGUES (texto/gramatica), todas distintas.`
            : `Gere EXATAMENTE ${desafioCount} questoes de desafio + ${bossCount} de chefao de APLICACAO do tema.`
        }`,
        "lessonBlocks: 1–3 dicas curtas (so no primeiro lote, se houver varios).",
        meta.examples
          ? `\nQUESTOES REAIS DA BANCA (imite o estilo, o nivel e o tipo de distrator — NAO copie):\n${meta.examples}`
          : "",
        meta.legalContext
          ? `\nFONTE LEGAL (texto oficial — use para o gabarito e o legalBasis; cite so artigos daqui):\n${meta.legalContext}`
          : "",
        meta.avoid?.length
          ? `\nO ALUNO JA RESPONDEU ESTAS (NAO repita o tema exato nem o texto — traga questoes NOVAS, outros textos de apoio e outros pontos do tema):\n${meta.avoid
              .slice(0, 80)
              .map((a) => `- ${a.slice(0, 110)}`)
              .join("\n")}`
          : "",
      ]
        .filter((line) => line !== "")
        .join("\n"),
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
    legalBasis:
      String(o.legalBasis ?? "").trim().slice(0, 300) || "Fundamento do tema da fase.",
    whyCorrect:
      String(o.whyCorrect ?? "").trim().slice(0, 800) ||
      "Alternativa alinhada à regra cobrada.",
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
    const body = String(o.body ?? "").trim().slice(0, 1200);
    if (body.length < 20) return;
    out.push({
      id: String(o.id ?? `${phaseId}-ai-b${i + 1}`).slice(0, 64),
      kind,
      title: String(o.title ?? kind).trim().slice(0, 80) || kind,
      body,
      required: false,
    });
  });
  return out.slice(0, 3);
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

  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map((item, i) => parseQuestion(item, `${phaseId}-q`, i))
    .filter((x): x is QuestQuestion => !!x)
    .slice(0, 50);
  if (questions.length < 3) {
    throw new Error("Questões VUNESP insuficientes (mínimo 3 com A–E).");
  }

  const bossQuestions = (Array.isArray(data.bossQuestions) ? data.bossQuestions : [])
    .map((item, i) => parseQuestion(item, `${phaseId}-boss`, i))
    .filter((x): x is QuestQuestion => !!x)
    .slice(0, 20);

  return {
    lessonBlocks,
    questions,
    bossQuestions: bossQuestions.length >= 2 ? bossQuestions : questions.slice(0, 4),
    contentVersion: QUEST_PHASE_AI_CONTENT_VERSION,
  };
}

/** Fallback mock: questões de prática (não meta-edital). */
export function mockQuestPhaseAiContent(phase: QuestPhase): QuestPhaseAiPayload {
  const topic = phase.title;
  const isPort = isPortugueseSubject(phase.subjectId, phase.subjectId);
  const lessonBlocks: QuestLessonBlock[] = [
    {
      id: `${phase.id}-mock-dica`,
      kind: "prova",
      title: "Dica de prova",
      required: false,
      body: isPort
        ? "Na VUNESP de português, leia o texto antes das alternativas e marque o que o trecho sustenta."
        : `Pegadinha clássica em ${topic}: confira o verbo nuclear e a exceção expressa.`,
    },
  ];

  const mk = (
    id: string,
    statement: string,
    correct: QuestAltKey,
    difficulty: QuestQuestion["difficulty"],
  ): QuestQuestion =>
    q({
      id,
      statement: `${statement}\n\nAssinale a alternativa correta.`,
      alternatives: isPort
        ? [
            { key: "A", text: "Interpretação literal correta do trecho" },
            { key: "B", text: "Extrapolação sem apoio no texto" },
            { key: "C", text: "Troca de conectivo/relação lógica" },
            { key: "D", text: "Erro de concordância ou regência" },
            { key: "E", text: "Inversão do sentido do período" },
          ]
        : [
            { key: "A", text: `Afirmação alinhada ao núcleo de ${topic}` },
            { key: "B", text: "Troca o verbo nuclear por instituto vizinho" },
            { key: "C", text: "Generaliza regra sem a exceção legal" },
            { key: "D", text: "Aplica hipótese de outro ramo" },
            { key: "E", text: "Inverte sujeito e objeto da norma" },
          ],
      correctKey: correct,
      legalBasis: isPort
        ? "Interpretação / norma gramatical cobrada"
        : (phase.sources[0]?.label ?? "Norma do tema"),
      whyCorrect: `A alternativa ${correct} reflete o ponto cobrado em ${topic} (mock · configure GEMINI_API_KEY).`,
      whyWrong: {
        A: correct === "A" ? undefined : "Não corresponde ao núcleo.",
        B: correct === "B" ? undefined : "Confunde com instituto/trecho vizinho.",
        C: correct === "C" ? undefined : "Ignora limite da regra.",
        D: correct === "D" ? undefined : "Fora do foco da questão.",
        E: correct === "E" ? undefined : "Inversão típica de pegadinha.",
      },
      memoryTip: `Foque no núcleo de ${topic}.`,
      difficulty,
      boardStyle: "VUNESP",
    });

  const targets = getQuestQuestionTargets(phase.subjectId);
  const diffs: QuestQuestion["difficulty"][] = ["facil", "media", "dificil"];
  const keys: QuestAltKey[] = ["A", "B", "C", "D", "E"];

  const questions: QuestQuestion[] = [];
  for (let i = 0; i < targets.desafio; i++) {
    const stem = isPort
      ? `Trecho ${i + 1} sobre ${topic}: "A equipe concluiu o serviço, embora chovesse." Assinale a leitura correta do período (${i + 1}/${targets.desafio})`
      : `Na aplicação prática de ${topic} (item ${i + 1}/${targets.desafio}), é correto afirmar`;
    questions.push(mk(`${phase.id}-ai-q${i + 1}`, stem, keys[i % 5]!, diffs[i % 3]!));
  }

  const bossQuestions: QuestQuestion[] = [];
  for (let i = 0; i < targets.boss; i++) {
    bossQuestions.push(
      mk(
        `${phase.id}-ai-boss${i + 1}`,
        `Chefão ${i + 1} — análise avançada de ${topic}`,
        keys[(i + 2) % 5]!,
        "dificil",
      ),
    );
  }

  return {
    lessonBlocks,
    questions,
    bossQuestions,
    contentVersion: QUEST_PHASE_AI_CONTENT_VERSION,
  };
}

export function mergePhaseWithAi(
  base: QuestPhase,
  ai: QuestPhaseAiPayload,
): QuestPhase {
  return {
    ...base,
    lessonBlocks: ai.lessonBlocks.length ? ai.lessonBlocks : base.lessonBlocks.map((b) => ({ ...b, required: false })),
    questions: ai.questions,
    bossQuestions: ai.bossQuestions,
    contentVerifiedAt: new Date().toISOString().slice(0, 10),
  };
}

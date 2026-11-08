import { MAX_PROMPT_CHARS } from "./types";
import type { TutorChatMessage } from "./prompts";
import type { Flashcard, MindNodeKind } from "@/types";
import type { StudyPackLink, StudyPackNode } from "@/lib/mind-map/layout";
import type { StudyPackQuestion } from "@/lib/mind-map/ai-questions";

export type StudyPackAi = {
  summary: string;
  centralTitle: string;
  nodes: StudyPackNode[];
  links: StudyPackLink[];
  flashcards: Omit<Flashcard, "id" | "status">[];
  questions?: StudyPackQuestion[];
  warnings: string[];
};

const KINDS = new Set<MindNodeKind>(["hub", "artigo", "conceito", "explicacao", "topico"]);

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function buildStudyPackMessages(input: {
  title: string;
  subject: string;
  material: string;
  detail: "resumo" | "padrao" | "detalhado";
  flashcardCount: number;
}): TutorChatMessage[] {
  const detailHint =
    input.detail === "resumo"
      ? "Mapa enxuto: 1 faixa + 4–8 arts principais."
      : input.detail === "detalhado"
        ? "Mapa rico: cubra a faixa citada (ate ~14 arts) com tipificacao + pena."
        : "Mapa equilibrado: faixa + arts mais cobrados no material (ate ~12).";
  // Listas explicadas item a item geram mais cards: o limite de arts nao vale para eles.

  const systemContent = [
    "Voce e professor de concursos (Brasil). Monte um MAPA MENTAL hierarquico a partir do MATERIAL.",
    "O aluno pode estar comecando do ZERO: escreva cada summary em linguagem simples, frases curtas, explicando termo tecnico entre parenteses.",
    "",
    "REGRA DAS LISTAS (vale para QUALQUER materia — Portugues, Direito, Informatica…):",
    "- Sempre que um card citar tipos, classes, especies ou categorias (ex.: 'dividem-se em pessoais, possessivos, demonstrativos…'),",
    "  crie UM card filho (kind explicacao, parentTempId = esse card) PARA CADA item da lista.",
    "- Cada filho: title = nome do item; summary = o que e + para que serve + 1 EXEMPLO concreto (frase ou caso real).",
    '  Ex.: title "Pronomes possessivos", summary "Indicam a quem algo pertence. Ex.: \"meu\" carro, \"sua\" casa."',
    "- Nunca deixe um item de lista sem explicacao.",
    "",
    "Se o MATERIAL for de LEI (artigos), siga tambem a hierarquia abaixo. Se for de outra materia (gramatica, informatica, matematica), use: tema → conceitos → tipos/regras → exemplos.",
    "",
    "HIERARQUIA OBRIGATORIA (como um resumo em arvore):",
    "",
    "1) Card FAIXA (kind topico, parentTempId null) — um por bloco do material:",
    '   title: "Arts. 293 a 305 CP"',
    '   summary: nome do capitulo/tema, ex. "Falsidade de Titulos e Outros Papeis Publicos e Falsidade Documental"',
    "",
    "2) Opcional: SUBGRUPOS (kind conceito, parentTempId = faixa) quando o material agrupa arts vizinhos:",
    '   ex. title "Arts. 294 a 295", summary "Petrechos de falsificacao e falsificacao de selo ou sinal publico"',
    "",
    "3) Card ARTIGO (kind artigo, parentTempId = faixa OU subgrupo):",
    '   title: "Art. 293 CP"  |  summary: rotulo curto (ex. "Falsificacao de papeis publicos")',
    "",
    "4) Card EXPLICACAO (kind explicacao, parentTempId = esse artigo) — OBRIGATORIO para cada art:",
    "   title: nome curto da tipificacao",
    "   summary: 1–3 frases com (a) o que pune/tipifica + exemplos do material e (b) pena se o material citar.",
    '   Exemplo bom: "Falsificacao de papeis publicos (selos de controle tributario, papeis de credito, cautelas, bilhetes de transporte oficial, etc.). Pena: reclusao de 2 a 8 anos e multa."',
    "",
    "MODELO MENTAL:",
    "Centro",
    "  └─ Arts. 293 a 305 (Falsidade de Titulos...)",
    "       ├─ Art. 293 → [explicacao com tipificacao + pena]",
    "       ├─ Art. 294 → [explicacao]",
    "       ├─ Art. 295 → ...",
    "       └─ ... ate o fim da faixa",
    "",
    "REGRAS DE CONTEUDO:",
    "- Copie/parafraase SO do MATERIAL. Nao invente tipificacao nem pena.",
    "- NUNCA use placeholders: 'Complete com...', 'revise a tipificacao', 'conforme o material'.",
    "- Se o material nao explicar um art, omita esse art (nao invente).",
    "- Cada art importante = 1 no artigo + 1 no explicacao filho. Nao amontoe varios arts num unico card.",
    "- Faixas gigantes (ex. 312 a 359): quebre em subgrupos tematicos (conceito) e detalhe so arts citados no texto.",
    "- " + detailHint,
    "- Ate ~14 nos kind artigo. Preferir cobertura da faixa do material a cards vazios.",
    "- Lei: sempre numero/data (Lei 8.112/1990). keywords com a referencia.",
    "- Flashcards: 1 por art (pergunta = o que tipifica; verso = tipificacao + pena).",
    "",
    "Responda SOMENTE JSON (sem markdown):",
    '{"summary":"resumo do bloco","centralTitle":"tema curto","nodes":[{"tempId":"faixa","title":"Arts. 293 a 305 CP","kind":"topico","summary":"Falsidade de Titulos e Outros Papeis Publicos e Falsidade Documental","keywords":["Arts. 293-305"],"parentTempId":null},{"tempId":"a293","title":"Art. 293 CP","kind":"artigo","summary":"Falsificacao de papeis publicos","keywords":["Art. 293"],"parentTempId":"faixa"},{"tempId":"e293","title":"Falsificacao de papeis publicos","kind":"explicacao","summary":"Falsificacao de papeis publicos (selos, papeis de credito, cautelas, bilhetes oficiais, etc.). Pena: reclusao de 2 a 8 anos e multa.","keywords":["Art. 293"],"parentTempId":"a293"}],"links":[],"flashcards":[{"front":"O que tipifica o Art. 293 do CP?","back":"Falsificacao de papeis publicos (selos, papeis de credito...). Pena: reclusao de 2 a 8 anos e multa.","topic":"Art. 293","tags":["Art. 293"],"nodeId":"a293"}],"warnings":[]}',
    "",
    "Gere cerca de " + String(input.flashcardCount) + " flashcards (min. 4, max. 24). Portugues claro. tempId unicos.",
  ].join("\n");

  return [
    {
      role: "system",
      content: systemContent,
    },
    {
      role: "user",
      content: clip(
        "Titulo do projeto: " +
          input.title +
          "\nMateria: " +
          input.subject +
          "\n\nMATERIAL:\n" +
          input.material,
        MAX_PROMPT_CHARS,
      ),
    },
  ];
}

export function parseStudyPackJson(raw: string): StudyPackAi {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error("A IA devolveu JSON inválido do pacote de estudo.");
  }
  if (!data || typeof data !== "object") throw new Error("Formato de pacote inválido.");
  const obj = data as Record<string, unknown>;

  const summary = String(obj["summary"] ?? "").trim().slice(0, 4000);
  const centralTitle = String(obj["centralTitle"] ?? "").trim().slice(0, 80);
  if (!centralTitle) throw new Error("Faltou o tema central do mapa.");

  const nodesRaw = Array.isArray(obj["nodes"]) ? obj["nodes"] : [];
  const nodes: StudyPackNode[] = [];
  const tempIds = new Set<string>();

  for (const row of nodesRaw.slice(0, 40)) {
    if (!row || typeof row !== "object") continue;
    const n = row as Record<string, unknown>;
    const tempId = String(n["tempId"] ?? "").trim() || `auto_${nodes.length}`;
    const title = String(n["title"] ?? "").trim().slice(0, 80);
    const summaryN = String(n["summary"] ?? "").trim().slice(0, 600);
    if (!title) continue;
    let kind = String(n["kind"] ?? "topico") as MindNodeKind;
    if (!KINDS.has(kind) || kind === "hub") kind = "topico";
    const parentRaw = n["parentTempId"];
    const parentTempId =
      parentRaw === null || parentRaw === undefined || parentRaw === ""
        ? null
        : String(parentRaw).trim();
    const keywords = Array.isArray(n["keywords"])
      ? n["keywords"].map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
      : [];
    if (tempIds.has(tempId)) continue;
    tempIds.add(tempId);
    nodes.push({
      tempId,
      title,
      kind,
      summary: summaryN || title,
      keywords,
      parentTempId,
    });
  }

  if (nodes.length < 3) throw new Error("O mapa precisa de pelo menos 3 nós a partir do material.");

  const links: StudyPackLink[] = [];
  const linksRaw = Array.isArray(obj["links"]) ? obj["links"] : [];
  for (const row of linksRaw.slice(0, 40)) {
    if (!row || typeof row !== "object") continue;
    const l = row as Record<string, unknown>;
    const sourceTempId = String(l["sourceTempId"] ?? "").trim();
    const targetTempId = String(l["targetTempId"] ?? "").trim();
    if (!sourceTempId || !targetTempId || sourceTempId === targetTempId) continue;
    if (!tempIds.has(sourceTempId) || !tempIds.has(targetTempId)) continue;
    links.push({
      sourceTempId,
      targetTempId,
      ...(String(l["label"] ?? "").trim()
        ? { label: String(l["label"]).trim().slice(0, 80) }
        : {}),
    });
  }

  const flashcards: StudyPackAi["flashcards"] = [];
  const cardsRaw = Array.isArray(obj["flashcards"]) ? obj["flashcards"] : [];
  for (const row of cardsRaw.slice(0, 24)) {
    if (!row || typeof row !== "object") continue;
    const c = row as Record<string, unknown>;
    const front = String(c["front"] ?? "").trim().slice(0, 280);
    const back = String(c["back"] ?? "").trim().slice(0, 600);
    if (front.length < 3 || back.length < 3) continue;
    const nodeRef = String(c["nodeId"] ?? "").trim();
    flashcards.push({
      front,
      back,
      topic: String(c["topic"] ?? "").trim().slice(0, 80) || centralTitle,
      tags: Array.isArray(c["tags"])
        ? c["tags"].map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
        : [],
      ...(nodeRef && tempIds.has(nodeRef) ? { nodeId: nodeRef } : { nodeId: null }),
    });
  }

  if (flashcards.length < 2) {
    throw new Error("A IA não gerou flashcards suficientes (mínimo 2).");
  }

  const warnings = Array.isArray(obj["warnings"])
    ? obj["warnings"].map((w) => String(w).trim()).filter(Boolean).slice(0, 12)
    : [];

  return {
    summary:
      summary ||
      "Revise o mapa e os flashcards. Conteúdo gerado a partir do material enviado.",
    centralTitle,
    nodes,
    links,
    flashcards,
    warnings,
  };
}

export function mockStudyPack(input: {
  title: string;
  subject: string;
}): StudyPackAi {
  return {
    summary: `Pacote demonstrativo (mock) sobre ${input.subject}.\nEstrutura: faixa → Art. N → tipificação + pena.\nConfigure GEMINI_API_KEY para usar seu material real.`,
    centralTitle: input.title || "Falsidade documental",
    nodes: [
      {
        tempId: "faixa",
        title: "Arts. 293 a 305 CP",
        kind: "topico",
        summary:
          "Falsidade de Títulos e Outros Papéis Públicos e Falsidade Documental",
        keywords: ["Arts. 293-305", "CP"],
        parentTempId: null,
      },
      {
        tempId: "a293",
        title: "Art. 293 CP",
        kind: "artigo",
        summary: "Falsificação de papéis públicos",
        keywords: ["Art. 293"],
        parentTempId: "faixa",
      },
      {
        tempId: "e293",
        title: "Falsificação de papéis públicos",
        kind: "explicacao",
        summary:
          "Falsificação de papéis públicos (selos de controle tributário, papéis de crédito, cautelas, bilhetes de transporte oficial, etc.). Pena: reclusão de 2 a 8 anos e multa.",
        keywords: ["Art. 293", "pena"],
        parentTempId: "a293",
      },
      {
        tempId: "g294",
        title: "Arts. 294 a 295",
        kind: "conceito",
        summary: "Petrechos de falsificação e falsificação de selo ou sinal público",
        keywords: ["Arts. 294-295"],
        parentTempId: "faixa",
      },
      {
        tempId: "a294",
        title: "Art. 294 CP",
        kind: "artigo",
        summary: "Petrechos para falsificação",
        keywords: ["Art. 294"],
        parentTempId: "g294",
      },
      {
        tempId: "e294",
        title: "Petrechos de falsificação",
        kind: "explicacao",
        summary:
          "Fabricar, adquirir, fornecer, possuir ou guardar objeto destinado à falsificação dos papéis referidos no art. 293. Pena: reclusão de 1 a 3 anos e multa.",
        keywords: ["Art. 294"],
        parentTempId: "a294",
      },
      {
        tempId: "a295",
        title: "Art. 295 CP",
        kind: "artigo",
        summary: "Falsificação de selo ou sinal público",
        keywords: ["Art. 295"],
        parentTempId: "g294",
      },
      {
        tempId: "e295",
        title: "Selo ou sinal público",
        kind: "explicacao",
        summary:
          "Falsificar, fabricar ou alterar selo ou sinal público oficial. Pena: reclusão de 2 a 6 anos e multa.",
        keywords: ["Art. 295"],
        parentTempId: "a295",
      },
      {
        tempId: "a299",
        title: "Art. 299 CP",
        kind: "artigo",
        summary: "Falsidade ideológica",
        keywords: ["Art. 299"],
        parentTempId: "faixa",
      },
      {
        tempId: "e299",
        title: "Falsidade ideológica",
        kind: "explicacao",
        summary:
          "Omitir ou inserir declaração falsa em documento público ou particular, com fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fato juridicamente relevante. Pena: reclusão de 1 a 5 anos e multa (documento público); detenção de 1 a 3 anos e multa (particular).",
        keywords: ["Art. 299"],
        parentTempId: "a299",
      },
    ],
    links: [],
    flashcards: [
      {
        front: "O que tipifica o Art. 293 do CP?",
        back: "Falsificação de papéis públicos (selos, papéis de crédito, cautelas, bilhetes oficiais…). Pena: reclusão de 2 a 8 anos e multa.",
        topic: "Art. 293",
        tags: ["Art. 293", "CP"],
        nodeId: "a293",
      },
      {
        front: "O que tipifica o Art. 294 do CP?",
        back: "Petrechos destinados à falsificação dos papéis do art. 293. Pena: reclusão de 1 a 3 anos e multa.",
        topic: "Art. 294",
        tags: ["Art. 294"],
        nodeId: "a294",
      },
      {
        front: "O que tipifica o Art. 299 do CP?",
        back: "Falsidade ideológica: omitir ou inserir declaração falsa em documento. Pena: 1 a 5 anos (público) ou 1 a 3 anos (particular), e multa.",
        topic: "Art. 299",
        tags: ["Art. 299"],
        nodeId: "a299",
      },
      {
        front: "Qual o tema dos Arts. 293 a 305 do CP?",
        back: "Falsidade de títulos e outros papéis públicos e falsidade documental.",
        topic: "Faixa 293-305",
        tags: ["Arts. 293-305"],
        nodeId: "faixa",
      },
    ],
    warnings: [
      "Modo demonstrativo (mock). Com GEMINI_API_KEY o pacote usa só o seu material.",
    ],
  };
}

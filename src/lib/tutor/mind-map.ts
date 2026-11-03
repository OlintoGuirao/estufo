import { MAX_PROMPT_CHARS } from "./types";
import type { TutorChatMessage } from "./prompts";

export type MindMapOutlineTopic = {
  title: string;
  summary: string;
  children?: { title: string; summary: string }[];
};

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function buildMindMapOutlineMessages(input: {
  title: string;
  subject: string;
}): TutorChatMessage[] {
  return [
    {
      role: "system",
      content: `Você é um professor de concursos públicos (Brasil). Gere a estrutura de um MAPA MENTAL de estudos.

Responda SOMENTE JSON válido (sem markdown), neste formato:
{"topics":[{"title":"Tópico principal","summary":"Resumo didático em 2–4 frases.","children":[{"title":"Subtópico","summary":"Resumo curto em 1–2 frases."}]}]}

Regras:
- 6 a 10 tópicos principais cobrindo o essencial da matéria para concurso.
- Cada tópico pode ter 0 a 3 subtópicos (children).
- Resumos claros, em português do Brasil, úteis para revisão — sem inventar leis/artigos inexistentes; se citar norma, seja cauteloso.
- Títulos curtos (máx. ~60 caracteres). Se for artigo, inclua o número (Art. 144). Se for lei, número e data/ano (Lei 8.112/1990).
- Não inclua o título do mapa como tópico raiz (o app já cria a raiz).`,
    },
    {
      role: "user",
      content: clip(
        `Título do mapa: ${input.title}\nMatéria: ${input.subject}\nGere o JSON do mapa mental.`,
        MAX_PROMPT_CHARS,
      ),
    },
  ];
}

export function parseMindMapOutlineJson(raw: string): MindMapOutlineTopic[] {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error("A IA devolveu JSON inválido para o mapa mental.");
  }
  if (!data || typeof data !== "object") throw new Error("Formato de mapa inválido.");
  const topicsRaw = (data as { topics?: unknown }).topics;
  if (!Array.isArray(topicsRaw) || topicsRaw.length < 3) {
    throw new Error("O mapa precisa de pelo menos 3 tópicos.");
  }

  const topics: MindMapOutlineTopic[] = [];
  for (const row of topicsRaw.slice(0, 12)) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const title = String(obj["title"] ?? "").trim().slice(0, 80);
    const summary = String(obj["summary"] ?? "").trim().slice(0, 600);
    if (!title || summary.length < 20) continue;
    const childrenRaw = Array.isArray(obj["children"]) ? obj["children"] : [];
    const children = childrenRaw
      .slice(0, 3)
      .map((c) => {
        const ch = c as { title?: string; summary?: string };
        return {
          title: String(ch.title ?? "").trim().slice(0, 80),
          summary: String(ch.summary ?? "").trim().slice(0, 400),
        };
      })
      .filter((c) => c.title && c.summary.length >= 12);
    topics.push({
      title,
      summary,
      ...(children.length ? { children } : {}),
    });
  }
  if (topics.length < 3) throw new Error("Tópicos gerados insuficientes ou incompletos.");
  return topics;
}

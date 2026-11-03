import type { OllamaChatMessage } from "@/server/ollama/client";

export type MaterialItemInput = {
  id: string;
  name: string;
  notes: string;
  articleRef?: string;
  kind?: string;
};

export type MaterialItemOutput = {
  id: string;
  explanation: string;
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(t);
  return (m?.[1] ?? t).trim();
}

export function buildSubjectMaterialMessages(input: {
  subjectName: string;
  contestName: string;
  board: string;
  items: MaterialItemInput[];
}): OllamaChatMessage[] {
  const list = input.items
    .map((it, i) => {
      const ref = it.articleRef ? ` [art=${it.articleRef}]` : "";
      const notes = it.notes.slice(0, 3500);
      return `${i + 1}. id=${it.id} | ${it.name}${ref}\n   edital+fonte: ${notes}`;
    })
    .join("\n\n");

  return [
    {
      role: "system",
      content: `Você é professor de concurso. Gere MATERIAL DE ESTUDO item a item.
Para CADA item: explique o que significa / o que o artigo ou norma dispõe, em linguagem clara.
Se o campo edital+fonte trouxer texto obtido do site oficial (Resolução, LC, Regimento, Normas), USE esse texto — não invente artigos.
Se for artigo de lei: ideia central, quando se aplica e 1 pegadinha de prova.
Se for Resolução/Regimento/Normas da Corregedoria: resuma os pontos cobrados para o cargo e como a banca testa.
NÃO resuma vários itens em um só. Um explanation por id.
PROIBIDO markdown (*, **, #). Parágrafos curtos.
Responda SOMENTE JSON:
{"items":[{"id":"...","explanation":"4 a 8 frases didáticas"}]}`,
    },
    {
      role: "user",
      content: `Concurso: ${input.contestName || "—"}
Banca: ${input.board || "—"}
Matéria: ${input.subjectName}

ITENS (gere explanation para TODOS; priorize o texto das fontes oficiais quando houver):
${list}`,
    },
  ];
}

export function mockSubjectMaterial(items: MaterialItemInput[], subjectName: string): MaterialItemOutput[] {
  return items.map((it) => {
    if (it.articleRef || /^Art\.?\s*\d/i.test(it.name)) {
      const art = it.articleRef || it.name.replace(/^Art\.?\s*/i, "");
      return {
        id: it.id,
        explanation: `O ${it.name} (${subjectName}) é cobrado literalmente no edital. Em resumo didático: estude a tipificação/dispositivo do art. ${art}, o bem jurídico ou a regra principal, e a forma como a banca transforma o texto em assertiva certa/errada. Confira sempre a redação oficial atualizada e treine com questões do artigo.`,
      };
    }
    return {
      id: it.id,
      explanation: `Sobre "${it.name}" em ${subjectName}: este tópico entra no conteúdo programático. Estude a definição, a regra de uso (quando aplicar / quando não), um exemplo simples e o jeito típico de cobrança em prova objetiva. Use o texto do edital como checklist e pratique com questões do tema.`,
    };
  });
}

export function parseSubjectMaterialJson(
  text: string,
  items: MaterialItemInput[],
  subjectName: string,
): MaterialItemOutput[] {
  const fallback = mockSubjectMaterial(items, subjectName);
  try {
    const raw = JSON.parse(stripJsonFence(text)) as unknown;
    const obj = asObj(raw);
    const arr = Array.isArray(obj?.["items"])
      ? (obj!["items"] as unknown[])
      : Array.isArray(raw)
        ? (raw as unknown[])
        : [];
    const byId = new Map<string, string>();
    for (const row of arr) {
      const o = asObj(row);
      if (!o) continue;
      const id = String(o["id"] ?? "").trim();
      const explanation = String(o["explanation"] ?? "").trim();
      if (id && explanation.length >= 40) byId.set(id, explanation.slice(0, 1200));
    }
    return items.map((it) => ({
      id: it.id,
      explanation: byId.get(it.id) ?? fallback.find((f) => f.id === it.id)!.explanation,
    }));
  } catch {
    return fallback;
  }
}

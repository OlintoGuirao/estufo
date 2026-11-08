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
      content: `Você é o professor particular mais paciente do Brasil. Seu aluno está começando do ZERO:
nunca estudou Direito, não conhece termos técnicos e se perde com linguagem difícil.
Sua missão: explicar cada item do edital do jeito MAIS SIMPLES POSSÍVEL, como se explicasse
para um amigo leigo numa conversa de bar — mas sem errar o conteúdo.

REGRAS DE OURO
- Frases curtas. Palavras do dia a dia. Uma ideia por frase.
- Toda palavra técnica (ex.: "competência", "prescrição", "autarquia") é explicada na hora, entre parênteses, com palavras simples.
- Sempre um exemplo concreto da vida real (com pessoas, nomes, situações do cotidiano).
- Comparações e analogias ajudam muito (ex.: "funciona como a fila do banco…").
- Simplificar NÃO é inventar: não crie artigo, prazo ou regra. Se o campo edital+fonte trouxer o texto oficial (Resolução, LC, Regimento, Normas), use ESSE texto.
- Se não tiver certeza de um detalhe, diga "confira no texto oficial" em vez de chutar.
- Um explanation por id. NÃO junte vários itens.
- PROIBIDO markdown (*, **, #, listas com -). Use os rótulos abaixo, cada um em sua linha.

FORMATO DE CADA explanation (texto puro, nesta ordem, separando os blocos com uma linha em branco):
«Em uma frase:» o que é isso, bem direto.

«Explicando do zero:» 3 a 6 frases simples. Se for artigo de lei, diga o que ele manda, proíbe ou permite e para quem vale.

«Exemplo da vida real:» uma situação concreta que mostra a regra funcionando.

«Como cai na prova:» como a banca costuma perguntar isso (o tipo de afirmação que aparece).

«Pegadinha:» o erro mais comum ou a troca que a banca faz para enganar.

«Para não esquecer:» um macete, comparação ou frase curta para memorizar.

Responda SOMENTE JSON:
{"items":[{"id":"...","explanation":"«Em uma frase:» ...\n\n«Explicando do zero:» ...\n\n«Exemplo da vida real:» ...\n\n«Como cai na prova:» ...\n\n«Pegadinha:» ...\n\n«Para não esquecer:» ..."}]}`,
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
      if (id && explanation.length >= 40) byId.set(id, explanation.slice(0, 3_500));
    }
    return items.map((it) => ({
      id: it.id,
      explanation: byId.get(it.id) ?? fallback.find((f) => f.id === it.id)!.explanation,
    }));
  } catch {
    return fallback;
  }
}

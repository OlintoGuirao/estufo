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

export type MaterialParseResult = {
  items: MaterialItemOutput[];
  /** Itens que a IA não devolveu (ou devolveu errado) — NÃO viram texto padrão. */
  missingIds: string[];
  rejected: { id: string; reason: string }[];
};

function normText(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

/** Número do artigo da etapa ("293", "311-A"); blocos "394-403" ficam de fora da checagem. */
function ownArticle(it: MaterialItemInput): string | null {
  const ref = it.articleRef?.trim();
  if (ref && !/^\d+-\d+$/.test(ref)) return ref.toUpperCase();
  return null;
}

/**
 * Lê a resposta da IA e casa cada explicação com o item pelo id.
 *
 * Antes: JSON inválido, id faltando ou id trocado caíam em silêncio no texto
 * padrão do mock ("O Art. X … é cobrado literalmente no edital…") — dezenas de
 * artigos com a MESMA explicação e o erro escondido. Agora só entra o que veio
 * certo; o resto volta em `missingIds` para tentar de novo / avisar o aluno.
 */
export function parseSubjectMaterialJson(
  text: string,
  items: MaterialItemInput[],
  subjectName: string,
  opts?: { mocked?: boolean },
): MaterialParseResult {
  // Sem IA configurada (modo demonstração): o mock É o conteúdo esperado.
  if (opts?.mocked) {
    return { items: mockSubjectMaterial(items, subjectName), missingIds: [], rejected: [] };
  }
  const rejected: { id: string; reason: string }[] = [];
  let arr: unknown[] = [];
  try {
    const raw = JSON.parse(stripJsonFence(text)) as unknown;
    const obj = asObj(raw);
    arr = Array.isArray(obj?.["items"])
      ? (obj!["items"] as unknown[])
      : Array.isArray(raw)
        ? (raw as unknown[])
        : [];
  } catch {
    return {
      items: [],
      missingIds: items.map((i) => i.id),
      rejected: items.map((i) => ({ id: i.id, reason: "resposta da IA não é JSON válido" })),
    };
  }

  const wanted = new Map(items.map((i) => [i.id, i]));
  const byId = new Map<string, string>();
  for (const row of arr) {
    const o = asObj(row);
    if (!o) continue;
    const id = String(o["id"] ?? "").trim();
    const explanation = String(o["explanation"] ?? "").trim();
    if (!wanted.has(id) || byId.has(id)) continue; // id desconhecido ou repetido: fica o 1º
    if (explanation.length < 40) {
      rejected.push({ id, reason: "explicação vazia/curta" });
      continue;
    }
    byId.set(id, explanation.slice(0, 3_500));
  }

  const out: MaterialItemOutput[] = [];
  const seenText = new Set<string>();
  for (const it of items) {
    const explanation = byId.get(it.id);
    if (!explanation) {
      if (!rejected.some((r) => r.id === it.id)) rejected.push({ id: it.id, reason: "id ausente na resposta" });
      continue;
    }
    const key = normText(explanation).slice(0, 400);
    if (seenText.has(key)) {
      rejected.push({ id: it.id, reason: "mesma explicação de outro item" });
      continue;
    }
    const own = ownArticle(it);
    if (own) {
      const cited = [...explanation.matchAll(/\bart(?:igo)?s?\.?\s*(\d{1,4}(?:-[A-Za-z])?)/gi)].map((m) =>
        m[1]!.toUpperCase(),
      );
      if (cited.length && !cited.includes(own) && !cited.includes(own.replace(/-.*/, ""))) {
        rejected.push({ id: it.id, reason: `explica o art. ${cited[0]} no lugar do art. ${own}` });
        continue;
      }
    }
    seenText.add(key);
    out.push({ id: it.id, explanation });
  }
  const got = new Set(out.map((o) => o.id));
  return { items: out, missingIds: items.filter((i) => !got.has(i.id)).map((i) => i.id), rejected };
}

import type { StudyPackAi } from "@/lib/tutor/study-pack";

const STUB_RE =
  /complete com|revise a tipifica|citado no material|conforme o material\.?$/i;

/**
 * Pede à IA para preencher só os cards ainda genéricos,
 * usando o material — resposta JSON { "items": [{ "tempId", "title", "summary" }] }.
 */
export function buildStubEnrichmentMessages(input: {
  material: string;
  stubs: { tempId: string; title: string; kind: string; artHint: string }[];
}): { role: "system" | "user"; content: string }[] {
  const list = input.stubs
    .map((s) => `- tempId=${s.tempId} | ${s.kind} | ${s.title} | ref=${s.artHint}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "Voce completa explicacoes de artigos de lei para um mapa mental de concurso.",
        "Use APENAS o MATERIAL. Nao invente tipificacao nem pena fora do texto.",
        "Responda SOMENTE JSON:",
        '{"items":[{"tempId":"id","title":"titulo curto","summary":"tipificacao (exemplos se houver). Pena: ..."}]}',
        "title: nome curto do crime/tipificacao.",
        "summary: o que o artigo pune + exemplos do material + pena se citada (estilo: 'Falsificacao de papeis publicos (...). Pena: reclusao de 2 a 8 anos e multa.').",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "Cards incompletos:",
        list,
        "",
        "MATERIAL:",
        input.material.slice(0, 50_000),
      ].join("\n"),
    },
  ];
}

export function applyStubEnrichment(
  pack: StudyPackAi,
  rawJson: string,
): StudyPackAi {
  const cleaned = rawJson
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  let data: { items?: { tempId?: string; title?: string; summary?: string }[] };
  try {
    data = JSON.parse(cleaned) as typeof data;
  } catch {
    return pack;
  }
  const byId = new Map(
    (data.items ?? [])
      .filter((i) => i.tempId && i.summary)
      .map((i) => [String(i.tempId), i] as const),
  );
  if (!byId.size) return pack;

  const nodes = pack.nodes.map((n) => {
    const patch = byId.get(n.tempId);
    if (!patch) return n;
    if (!STUB_RE.test(n.summary) && !STUB_RE.test(n.title)) return n;
    return {
      ...n,
      title: String(patch.title ?? n.title).trim().slice(0, 80) || n.title,
      summary: String(patch.summary ?? n.summary).trim().slice(0, 600) || n.summary,
    };
  });

  return { ...pack, nodes };
}

export function listStubNodes(pack: StudyPackAi) {
  return pack.nodes
    .filter((n) => STUB_RE.test(n.summary) || STUB_RE.test(n.title))
    .map((n) => {
      const m = n.title.match(/\bart\.?\s*(\d+)/i) || n.summary.match(/\bart\.?\s*(\d+)/i);
      return {
        tempId: n.tempId,
        title: n.title,
        kind: n.kind,
        artHint: m ? `Art. ${m[1]}` : n.title,
      };
    })
    .slice(0, 16);
}

/** Remove explicações ainda genéricas; limpa artigos stub restantes. */
export function scrubRemainingStubs(pack: StudyPackAi): StudyPackAi {
  const dropIds = new Set<string>();
  const nodes = pack.nodes
    .filter((n) => {
      const stub = STUB_RE.test(n.summary) || STUB_RE.test(n.title);
      if (!stub) return true;
      if (n.kind === "explicacao") {
        dropIds.add(n.tempId);
        return false;
      }
      return true;
    })
    .map((n) => {
      if (!STUB_RE.test(n.summary) && !STUB_RE.test(n.title)) return n;
      return {
        ...n,
        summary: "Trecho deste artigo nao estava claro no material enviado.",
      };
    });

  const links = pack.links.filter(
    (l) => !dropIds.has(l.sourceTempId) && !dropIds.has(l.targetTempId),
  );
  const flashcards = pack.flashcards.filter(
    (f) => !f.nodeId || !dropIds.has(f.nodeId),
  );

  return { ...pack, nodes, links, flashcards };
}

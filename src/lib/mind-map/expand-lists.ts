/**
 * "Dividem-se em pessoais, possessivos, demonstrativos…" — a IA citava a
 * classificação mas não explicava cada item. Aqui detectamos essas listas
 * e pedimos à IA um card-filho por item, explicado do zero com exemplo.
 */
import type { StudyPackAi } from "@/lib/tutor/study-pack";
import type { StudyPackNode } from "@/lib/mind-map/layout";

const TRIGGER =
  /(divide[m]?-se em|dividem-se em|classifica[m]?-se em|s[aã]o classificad[oa]s? em|podem ser|s[aã]o eles|s[aã]o elas|tipos?\s*:|esp[eé]cies\s*:|classes?\s*:|categorias?\s*:|compreende[m]?|abrange[m]?|incluem|subdivide[m]?-se em|existem (?:os|as)?|h[aá] (?:os|as)?)\s*/i;

function cleanItem(s: string): string {
  return s
    .replace(/^(os|as|o|a|e|ou)\s+/i, "")
    .replace(/[.;:!?)]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai os itens de uma enumeração ("a, b, c e d") depois de uma palavra-gatilho. */
export function extractEnumeration(text: string): string[] {
  const t = String(text ?? "");
  const m = TRIGGER.exec(t);
  const tail = m ? t.slice(m.index + m[0].length) : "";
  // Sem gatilho: aceita só lista longa clara (3+ itens curtos) no fim da frase.
  const source = tail || (t.split(/[.:]\s+/).pop() ?? "");
  const sentence = source.split(/(?<=[a-zà-ú])\.\s|\n/)[0] ?? source;
  const items = sentence
    .split(/\s*,\s*|\s+e\s+|\s+ou\s+|\s*;\s*/i)
    .map(cleanItem)
    .filter((x) => x.length >= 3 && x.length <= 60 && x.split(" ").length <= 6);
  const unique = [...new Map(items.map((i) => [i.toLowerCase(), i])).values()];
  if (m) return unique.length >= 2 ? unique.slice(0, 12) : [];
  return unique.length >= 3 ? unique.slice(0, 12) : [];
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/s\b/g, ""); // plural ~ singular
}

export type ListToExpand = { tempId: string; title: string; summary: string; items: string[] };

/** Cards cuja lista ainda não tem um filho explicando cada item. */
export function findListsToExpand(pack: StudyPackAi, max = 8): ListToExpand[] {
  const childrenOf = new Map<string, StudyPackNode[]>();
  for (const n of pack.nodes) {
    if (!n.parentTempId) continue;
    const list = childrenOf.get(n.parentTempId) ?? [];
    list.push(n);
    childrenOf.set(n.parentTempId, list);
  }
  const out: ListToExpand[] = [];
  for (const n of pack.nodes) {
    const items = extractEnumeration(n.summary);
    if (items.length < 2) continue;
    const kids = (childrenOf.get(n.tempId) ?? []).map((k) => norm(`${k.title} ${k.summary}`));
    const missing = items.filter((it) => !kids.some((k) => k.includes(norm(it))));
    if (missing.length >= 2 || (missing.length && missing.length === items.length)) {
      out.push({ tempId: n.tempId, title: n.title, summary: n.summary, items: missing });
    }
    if (out.length >= max) break;
  }
  return out;
}

export function buildExpandListsMessages(input: {
  subject: string;
  material: string;
  lists: ListToExpand[];
}): { role: "system" | "user"; content: string }[] {
  const block = input.lists
    .map(
      (l) =>
        `- parentId=${l.tempId} | card "${l.title}": ${l.summary}\n  itens a explicar: ${l.items.join(" | ")}`,
    )
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "Voce e o professor mais paciente do Brasil, explicando para quem nunca estudou o assunto.",
        "Para CADA item listado, crie um card filho que explique o que ele e, do jeito mais simples possivel.",
        "Cada card: title = nome do item (curto). summary = 2 a 3 frases curtas: o que e + para que serve/quando usa + 1 EXEMPLO concreto (frase ou caso real) com o termo destacado entre aspas.",
        'Ex. (pronomes pessoais): "Substituem o nome da pessoa que fala, com quem se fala ou de quem se fala. Ex.: \\"Ela\\" chegou cedo (ela = Maria)."',
        "Explique palavra tecnica entre parenteses. Nao invente regra que nao exista; se o material trouxer o conteudo, use-o.",
        "keywords: 1 a 3 palavras-chave.",
        'Responda SOMENTE JSON: {"groups":[{"parentId":"...","items":[{"title":"...","summary":"...","keywords":["..."]}]}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Materia: ${input.subject}`,
        "CARDS COM LISTAS SEM EXPLICACAO:",
        block,
        "",
        "MATERIAL (referencia):",
        input.material.slice(0, 20_000) || "(sem material — use conhecimento padrao e correto do tema)",
      ].join("\n"),
    },
  ];
}

type Group = { parentId?: string; items?: { title?: string; summary?: string; keywords?: string[] }[] };

export function parseExpandedGroups(data: unknown): { parentId: string; items: { title: string; summary: string; keywords: string[] }[] }[] {
  const groups = (data as { groups?: Group[] })?.groups;
  if (!Array.isArray(groups)) return [];
  return groups
    .map((g) => ({
      parentId: String(g.parentId ?? ""),
      items: (g.items ?? [])
        .map((i) => ({
          title: String(i.title ?? "").trim().slice(0, 80),
          summary: String(i.summary ?? "").trim().slice(0, 700),
          keywords: Array.isArray(i.keywords) ? i.keywords.map(String).slice(0, 4) : [],
        }))
        .filter((i) => i.title.length >= 2 && i.summary.length >= 15),
    }))
    .filter((g) => g.parentId && g.items.length);
}

/** Acrescenta os cards-filho ao pacote. */
export function applyExpandedLists(pack: StudyPackAi, data: unknown): StudyPackAi {
  const groups = parseExpandedGroups(data);
  if (!groups.length) return pack;
  const ids = new Set(pack.nodes.map((n) => n.tempId));
  const added: StudyPackNode[] = [];
  for (const g of groups) {
    if (!ids.has(g.parentId)) continue;
    g.items.forEach((it, i) => {
      let tempId = `${g.parentId}-item${i + 1}`;
      while (ids.has(tempId)) tempId += "x";
      ids.add(tempId);
      added.push({
        tempId,
        title: it.title,
        kind: "explicacao",
        summary: it.summary,
        keywords: it.keywords,
        parentTempId: g.parentId,
      });
    });
  }
  return added.length ? { ...pack, nodes: [...pack.nodes, ...added] } : pack;
}

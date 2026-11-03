import type { MindNodeKind } from "@/types";

/** Quebra listas tipo “A, B e C” em itens individuais para cards. */
export function splitStudyItems(text: string): string[] {
  const raw = String(text ?? "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/\s*[;|/]\s*|\s*,\s*|\s+e\s+|\s+ou\s+/i)
    .map((p) => p.replace(/^[-•*]\s*/, "").trim())
    .filter((p) => p.length >= 2 && p.length <= 120);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function collectNodeCardItems(input: {
  summary?: string;
  keywords?: string[];
  title?: string;
}): string[] {
  const range = expandArticleRange(
    [input.title, input.summary].filter(Boolean).join(" "),
  );
  if (range?.length) return range;

  const fromSummary = splitStudyItems(input.summary ?? "");
  const fromKw = (input.keywords ?? [])
    .flatMap((k) => splitStudyItems(k))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...fromSummary, ...fromKw]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** “Arts. 293 a 305” → ["Art. 293", …, "Art. 305"] (máx. 20). */
export function expandArticleRange(text: string): string[] | null {
  const m = String(text ?? "").match(
    /arts?\.?\s*(\d+)\s*(?:a|–|-|até)\s*(\d+)/i,
  );
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  if (to - from > 20) return null;
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(`Art. ${n}`);
  return out;
}

export function inferNodeKind(title: string): MindNodeKind {
  const t = title.trim();
  if (/arts?\.?\s*\d+\s*(?:a|–|-|até)\s*\d+/i.test(t)) return "topico";
  if (/^art\.?\s*\d+/i.test(t) || /\bart\.?\s*\d+/i.test(t)) return "artigo";
  if (/^lei\s*\d+/i.test(t)) return "artigo";
  return "conceito";
}

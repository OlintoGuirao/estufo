/**
 * Divide o texto de uma lei em blocos por artigo ("Art. 1º … Art. 2º …").
 * Artigos muito longos viram vários blocos (com o rótulo repetido).
 */
export type LegalChunk = {
  id: string;
  lawId: string;
  lawName: string;
  article: string;
  content: string;
  sourceUrl: string;
};

const ART_SPLIT = /(?=\bArt\.\s*\d{1,4}(?:º|°|o)?(?:-[A-Z])?[\s.\-–])/g;

export function chunkLawText(
  text: string,
  law: { id: string; name: string; url: string },
  maxChars = 2_200,
): LegalChunk[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const parts = clean
    .split(ART_SPLIT)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  const out: LegalChunk[] = [];
  const counts = new Map<string, number>();

  for (const part of parts) {
    const m = /^Art\.\s*(\d{1,4}(?:-[A-Z])?)/.exec(part);
    const article = m ? `Art. ${m[1]}` : "Preâmbulo";
    for (let i = 0; i < part.length; i += maxChars) {
      const piece = part.slice(i, i + maxChars);
      const n = (counts.get(article) ?? 0) + 1;
      counts.set(article, n);
      out.push({
        id: `${law.id}:${article.replace(/\W+/g, "")}:${n}`,
        lawId: law.id,
        lawName: law.name,
        article,
        content: i === 0 ? piece : `${article} (cont.) ${piece}`,
        sourceUrl: law.url,
      });
    }
  }
  return out;
}

function norm(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

/**
 * Busca por palavras (BM25 simplificado) — usada quando não há pgvector.
 * Artigos citados explicitamente na pergunta ganham prioridade.
 */
export function keywordSearch(
  chunks: LegalChunk[],
  query: string,
  opts?: { limit?: number; lawIds?: string[] },
): LegalChunk[] {
  const limit = opts?.limit ?? 6;
  const pool = opts?.lawIds?.length ? chunks.filter((c) => opts.lawIds!.includes(c.lawId)) : chunks;
  if (!pool.length) return [];

  const terms = [...new Set(norm(query))];
  const df = new Map<string, number>();
  const docs = pool.map((c) => {
    const ws = norm(c.content);
    const tf = new Map<string, number>();
    for (const w of ws) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const t of terms) if (tf.has(t)) df.set(t, (df.get(t) ?? 0) + 1);
    return { c, tf, len: ws.length };
  });
  const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length || 1;
  const N = docs.length;
  const cited = new Set([...query.matchAll(/art(?:igo)?\.?\s*(\d{1,4})/gi)].map((m) => m[1]!));

  const scored = docs.map((d) => {
    let s = 0;
    for (const t of terms) {
      const f = d.tf.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avg))));
    }
    const artNum = /^Art\. (\d+)/.exec(d.c.article)?.[1];
    if (artNum && cited.has(artNum)) s += 8;
    return { c: d.c, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
}

export function formatLegalContext(chunks: LegalChunk[], maxChars = 10_000): string {
  let out = "";
  for (const c of chunks) {
    const block = `[${c.lawName} — ${c.article}]\n${c.content}\n\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}

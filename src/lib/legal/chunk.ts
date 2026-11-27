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

/**
 * Início de artigo. Aceita "Art. 5º", "Art. 311-A", "Artigo 1.º" (leis da
 * ALESP) e milhar com ponto ("Art. 1.012." das Normas da Corregedoria).
 * Antes "Art. 1.012." casava como "Art. 1" — 355 trechos com o rótulo
 * errado — e "Artigo 1.º" não casava (a Lei 10.261 inteira virava "Preâmbulo").
 */
const ART_SPLIT =
  /(?=\bArt(?:igo)?\.?\s*\d{1,4}(?:\.\d{3})?(?:\s*\.?\s*[º°o])?(?:-[A-Z]\b)?(?:\s*[.\-–]|\s))/g;
// Sufixo colado ao número ("311-A"); "Artigo 171 - O funcionário" é separador.
const ART_LABEL = /^Art(?:igo)?\.?\s*(\d{1,4}(?:\.\d{3})?)(?:\s*\.?\s*[º°o])?(?:-([A-Z])\b)?/;

/** "Artigo 1.012.º" → "Art. 1012"; "Art. 311-A" → "Art. 311-A". */
export function articleLabel(part: string): string | null {
  const m = ART_LABEL.exec(part);
  if (!m) return null;
  const num = m[1]!.replace(".", "");
  return `Art. ${num}${m[2] ? `-${m[2]}` : ""}`;
}

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
    const article = articleLabel(part) ?? "Preâmbulo";
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

/**
 * Artigos citados na consulta: "Art. 60", "Arts. 394 a 403", "art. 1.012",
 * "arts. 6º a 11". Faixa vira cada número (no máx. 40).
 */
export function citedArticleNumbers(query: string): Set<string> {
  const out = new Set<string>();
  const NUM = String.raw`\d{1,4}(?:\.\d{3})?\s*[º°o]?(?:-[A-Z]\b)?`;
  // "art. 5º", "arts. 12 e 13", "artigos 60 a 83; 88 e 89", "arts. 6º a 11"
  const list = new RegExp(String.raw`arts?(?:igos?)?\.?\s*(${NUM}(?:\s*(?:a|ao|e|,|;)\s*${NUM})*)`, "gi");
  const item = /(\d{1,4}(?:\.\d{3})?)\s*[º°o]?(-[A-Z]\b)?(?:\s*(?:a|ao)\s*(\d{1,4}(?:\.\d{3})?))?/gi;
  for (const m of query.matchAll(list)) {
    for (const it of m[1]!.matchAll(item)) {
      const a = Number(it[1]!.replace(".", ""));
      if (it[2]) {
        out.add(`${a}${it[2].toUpperCase()}`); // 311-A ≠ 311
        continue;
      }
      const b = it[3] ? Number(it[3].replace(".", "")) : a;
      for (let n = a; n <= Math.min(b, a + 40); n++) out.add(String(n));
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
  const cited = citedArticleNumbers(query);

  const scored = docs.map((d) => {
    let s = 0;
    for (const t of terms) {
      const f = d.tf.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avg))));
    }
    const artNum = /^Art\. (\d+(?:-[A-Z])?)/.exec(d.c.article)?.[1];
    // Artigo citado pela etapa vem SEMPRE antes (era +8 e perdia para trechos
    // longos que repetem "código de processo penal": vinha o art. 3 no lugar do 351).
    if (artNum && cited.has(artNum)) s += 1_000;
    return { c: d.c, s };
  });
  // Um artigo longo vira vários trechos: sem isto "Art. 12 | Art. 12 | Art. 12"
  // ocupava todas as vagas (e o art. 13 ficava de fora). Escolhe artigos
  // DISTINTOS; os pedaços de cada um são juntados por mergeArticleChunks.
  const picked: LegalChunk[] = [];
  const seen = new Set<string>();
  for (const x of scored.filter((y) => y.s > 0).sort((a, b) => b.s - a.s)) {
    const key = articleKey(x.c);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(x.c);
    if (picked.length >= limit) break;
  }
  return picked;
}

function articleKey(c: Pick<LegalChunk, "lawId" | "article">): string {
  return `${c.lawId}|${c.article}`;
}

/**
 * Junta os pedaços do mesmo artigo (na ordem do texto) num bloco só, para
 * cada artigo aparecer uma única vez e inteiro na FONTE LEGAL.
 */
export function mergeArticleChunks(picked: LegalChunk[], corpus: LegalChunk[]): LegalChunk[] {
  const pieces = new Map<string, LegalChunk[]>();
  for (const c of corpus) {
    const k = articleKey(c);
    const list = pieces.get(k);
    if (list) list.push(c);
    else pieces.set(k, [c]);
  }
  const seen = new Set<string>();
  const out: LegalChunk[] = [];
  for (const p of picked) {
    const k = articleKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    const all = pieces.get(k) ?? [p];
    // "Preâmbulo" não é artigo: não junta textos soltos sem relação.
    if (p.article === "Preâmbulo" || all.length === 1) {
      out.push(p);
      continue;
    }
    const content = all
      .map((c, i) => (i === 0 ? c.content : c.content.replace(new RegExp(`^${p.article.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(cont\\.\\) `), "")))
      .join(" ");
    out.push({ ...all[0]!, content });
  }
  return out;
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

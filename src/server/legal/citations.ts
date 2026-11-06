/**
 * Confere se os artigos citados pela IA aparecem nas fontes que ela recebeu.
 * Não prova que a citação está certa, mas pega o caso mais comum de
 * alucinação: "art. 312" que não está em nenhum material enviado.
 */

const ART_RE = /\bart(?:igo)?s?\.?\s*(\d{1,4})(?:º|°|o)?/gi;

export function extractArticleNumbers(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(ART_RE)) out.add(m[1]!);
  return [...out];
}

export function findUnsupportedArticles(output: string, sources: string[]): string[] {
  const cited = extractArticleNumbers(output);
  if (!cited.length) return [];
  const supported = new Set(extractArticleNumbers(sources.join("\n")));
  return cited.filter((n) => !supported.has(n)).map((n) => `art. ${n}`);
}

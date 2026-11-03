/** Extrai URL de marcação `[fonte](https://...)` do texto do gabarito. */
export function extractFonteUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const md = text.match(/\[fonte\]\((https?:\/\/[^)\s]+)\)/i);
  if (md?.[1]) return cleanUrl(md[1]);
  const bare = text.match(/(https?:\/\/[^\s\]|<>"]+)/i);
  if (bare?.[1]) return cleanUrl(bare[1]);
  return null;
}

function cleanUrl(raw: string): string {
  return raw.replace(/[),.;]+$/g, "").trim();
}

export function stripHtmlToText(html: string, maxChars = 10_000): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = noScript
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`;
}

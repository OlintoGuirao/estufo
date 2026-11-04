const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
  "sub",
  "sup",
  "img",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "a",
]);

const ALLOWED_ATTR = new Set(["href", "src", "alt", "title", "class", "colspan", "rowspan"]);

/**
 * Sanitiza HTML sem jsdom/isomorphic-dompurify (evita `__dirname is not defined` no ESM/SSR).
 */
export function sanitizeQuestionHtml(input: string | null | undefined): string {
  if (!input) return "";
  let html = String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(iframe|object|embed|form|input|link|meta)[^>]*>/gi, "");

  html = html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string, attrs = "") => {
    const name = tag.toLowerCase();
    const closing = full.startsWith("</");
    if (!ALLOWED_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;
    const kept: string[] = [];
    const attrRe = /([a-z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrs))) {
      const key = m[1]!.toLowerCase();
      if (key.startsWith("on")) continue;
      if (!ALLOWED_ATTR.has(key)) continue;
      const val = m[3] ?? m[4] ?? m[5] ?? "";
      if ((key === "href" || key === "src") && /^\s*javascript:/i.test(val)) continue;
      kept.push(`${key}="${val.replace(/"/g, "&quot;")}"`);
    }
    return kept.length ? `<${name} ${kept.join(" ")}>` : `<${name}>`;
  });

  return html;
}

/** Converte texto plano em HTML escapado + quebras de linha. */
export function plainTextToSafeHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\n/g, "<br>");
}

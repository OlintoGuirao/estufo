import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
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
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "colspan", "rowspan"];

/** Sanitiza HTML de enunciados/alternativas com allowlist estrita. */
export function sanitizeQuestionHtml(input: string | null | undefined): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onerror", "onclick", "onload", "style"],
  });
}

/** Converte texto plano em HTML escapado + quebras de linha. */
export function plainTextToSafeHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return sanitizeQuestionHtml(escaped.replace(/\n/g, "<br>"));
}

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li"];
const ALLOWED_ATTR: string[] = [];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Normaliza texto do professor: remove markdown ruidoso e deixa tipografia limpa.
 * Usado ao gravar a aula e também na renderização de conteúdo antigo.
 */
export function normalizeProfessorPlainText(raw: string): string {
  let t = String(raw ?? "").trim();
  if (!t) return "";

  // **negrito** / *itálico* → aspas tipográficas (texto limpo, sem asteriscos)
  t = t.replace(/\*\*([^*]+)\*\*/g, "«$1»");
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1«$2»");
  t = t.replace(/__([^_]+)__/g, "«$1»");
  t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, "$1«$2»");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*{1,3}/g, "");
  t = t.replace(/_{1,3}/g, "");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/[ \t]{2,}/g, " ");
  return t.trim();
}

/**
 * Converte fala do professor em HTML seguro (parágrafos + ênfase).
 * Aceita texto já normalizado ou markdown leve residual.
 */
export function formatProfessorHtml(raw: string): string {
  const plain = normalizeProfessorPlainText(raw);
  if (!plain) return "";

  const withEmphasis = escapeHtml(plain)
    .replace(/«([^»]+)»/g, "<strong>$1</strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  const blocks = withEmphasis
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const listLines = b.split("\n").filter((l) => /^[-•]\s+/.test(l.trim()));
      if (listLines.length >= 2 && listLines.length === b.split("\n").filter(Boolean).length) {
        const items = b
          .split("\n")
          .map((l) => l.trim().replace(/^[-•]\s+/, ""))
          .filter(Boolean)
          .map((l) => `<li>${l}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${b.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return DOMPurify.sanitize(blocks, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

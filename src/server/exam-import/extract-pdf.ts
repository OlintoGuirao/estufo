import type { ExamImportPage } from "@/types/exam-import";

const MIN_CHARS_PER_PAGE_HINT = 20;

/**
 * Extrai texto por página. Sem OCR — PDFs só imagem ficam com texto vazio.
 */
export async function extractPdfPages(bytes: Uint8Array): Promise<{
  pages: ExamImportPage[];
  textExtractable: boolean;
  needsOcr: boolean;
}> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });

  const texts = Array.isArray(text) ? text : [String(text ?? "")];
  const pages: ExamImportPage[] = [];
  for (let i = 0; i < Math.max(totalPages || texts.length, texts.length); i++) {
    const t = (texts[i] ?? "").replace(/\r/g, "").trim();
    pages.push({ page: i + 1, text: t, charCount: t.length });
  }

  const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
  const textExtractable = totalChars >= MIN_CHARS_PER_PAGE_HINT;
  const needsOcr = !textExtractable;

  return { pages, textExtractable, needsOcr };
}

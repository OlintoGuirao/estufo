export const EXAM_IMPORT_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const EXAM_IMPORT_ALLOWED_MIME = new Set(["application/pdf"]);
export const EXAM_IMPORT_ALLOWED_EXT = [".pdf"];

export type FileValidationOk = { ok: true };
export type FileValidationErr = { ok: false; message: string };
export type FileValidationResult = FileValidationOk | FileValidationErr;

export function validatePdfUpload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): FileValidationResult {
  const name = (input.fileName || "").trim();
  if (!name) return { ok: false, message: "Nome do arquivo é obrigatório." };

  const lower = name.toLowerCase();
  const hasExt = EXAM_IMPORT_ALLOWED_EXT.some((ext) => lower.endsWith(ext));
  if (!hasExt) {
    return { ok: false, message: "Apenas arquivos PDF são aceitos (.pdf)." };
  }

  const mime = (input.mimeType || "").toLowerCase().trim();
  // Alguns browsers enviam application/octet-stream; aceitamos se a extensão for .pdf.
  if (mime && mime !== "application/octet-stream" && !EXAM_IMPORT_ALLOWED_MIME.has(mime)) {
    return { ok: false, message: `Tipo MIME inválido: ${mime}. Use application/pdf.` };
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, message: "Arquivo vazio ou tamanho inválido." };
  }
  if (input.sizeBytes > EXAM_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      message: `Arquivo excede o limite de ${Math.round(EXAM_IMPORT_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  return { ok: true };
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s/g, "");
  if (!cleaned) throw new Error("Conteúdo PDF em base64 vazio.");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(cleaned, "base64"));
  }
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

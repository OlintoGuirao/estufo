/** SHA-256 em hex (Web Crypto ou Node crypto). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function metadataFingerprint(meta: {
  board: string;
  organ: string;
  role: string;
  year: number;
  examName: string;
  bookletType: string;
}): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    norm(meta.board),
    norm(meta.organ),
    norm(meta.role),
    String(meta.year),
    norm(meta.examName),
    norm(meta.bookletType),
  ].join("|");
}

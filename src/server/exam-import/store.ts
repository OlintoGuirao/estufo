import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { getExamImportStorageDir } from "./config";

function resolveSafe(storageKey: string): string {
  const root = path.resolve(getExamImportStorageDir());
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error("Caminho de armazenamento inválido.");
  }
  return full;
}

export async function savePrivatePdf(opts: {
  batchId: string;
  kind: "exam" | "answer-key";
  fileName: string;
  bytes: Uint8Array;
}): Promise<{ storageKey: string }> {
  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const storageKey = path.join(opts.batchId, `${opts.kind}-${safeName}`);
  const full = resolveSafe(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(opts.bytes));
  return { storageKey: storageKey.replace(/\\/g, "/") };
}

export async function readPrivatePdf(storageKey: string): Promise<Uint8Array | null> {
  try {
    const full = resolveSafe(storageKey);
    await access(full);
    const buf = await readFile(full);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

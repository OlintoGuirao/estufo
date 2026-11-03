import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

const root = "C:/Users/xuniim/Downloads/Provas tjsp";
const outDir = resolve("tmp-tjsp-provas");
mkdirSync(outDir, { recursive: true });

async function dump(rel, label) {
  const bytes = new Uint8Array(readFileSync(resolve(root, rel)));
  const pdf = await getDocumentProxy(bytes);
  const r = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(r.text) ? r.text : [String(r.text ?? "")];
  const full = pages.map((t, i) => `\n===== PAGE ${i + 1} =====\n${t}`).join("\n");
  writeFileSync(resolve(outDir, `${label}.txt`), full, "utf8");
  console.log(label, "pages=", r.totalPages, "chars=", full.length);
}

await dump("2018/gabarito2018.pdf", "gab-2018");
await dump("2018/escrevente_tecnico_judiciario2018.pdf", "prova-2018");
await dump("2021/gabarito2021.pdf", "gab-2021");
await dump("2021/escrevente_tecnico_judiciario2021.pdf", "prova-2021");
await dump("2025/gabarito2025.pdf", "gab-2025");
await dump("2025/escrevente_tecnico_judiciario2025.pdf", "prova-2025");
console.log("done ->", outDir);

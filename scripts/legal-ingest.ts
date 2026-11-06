/**
 * Baixa a lei seca oficial do edital, divide por artigo e grava:
 *  - data/legal/corpus.json  (sempre — usado na busca por palavras, sem banco)
 *  - tabela legal_chunks com embeddings (se DATABASE_URL + GEMINI_API_KEY)
 *
 * Uso:
 *   npm run legal:ingest
 *   npm run legal:ingest -- --only cf88,cpc
 *   npm run legal:ingest -- --no-db
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "./load-env";
import { LEGAL_SOURCES } from "../src/server/legal/laws";
import { chunkLawText, type LegalChunk } from "../src/lib/legal/chunk";
import { fetchOfficialSource, stripHtmlToText } from "../src/lib/tutor/fonte";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "data", "legal", "corpus.json");

const args = process.argv.slice(2);
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "").split(",") : null;
const noDb = args.includes("--no-db");

/** Planalto mostra texto revogado riscado (<strike>/<s>) — não é lei vigente. */
function removeRevoked(html: string): string {
  return html
    .replace(/<strike[\s\S]*?<\/strike>/gi, " ")
    .replace(/<s>[\s\S]*?<\/s>/gi, " ")
    .replace(/<del[\s\S]*?<\/del>/gi, " ");
}

async function fetchPdfText(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text ?? "");
}

async function loadExisting(): Promise<LegalChunk[]> {
  try {
    const raw = JSON.parse(await readFile(outPath, "utf8")) as { chunks?: LegalChunk[] };
    return raw.chunks ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const sources = LEGAL_SOURCES.filter((s) => !only || only.includes(s.id));
  const existing = await loadExisting();
  const fresh: LegalChunk[] = [];

  for (const src of sources) {
    process.stdout.write(`↓ ${src.id} … `);
    try {
      let text: string | null;
      if (src.format === "pdf") {
        text = await fetchPdfText(src.url);
      } else {
        const html = await fetchOfficialSource(src.url, { timeoutMs: 60_000 });
        text = html ? stripHtmlToText(removeRevoked(html), 20_000_000) : null;
      }
      if (!text || text.length < 500) {
        console.log("falhou (sem texto)");
        continue;
      }
      const chunks = chunkLawText(text, src);
      fresh.push(...chunks);
      console.log(`${chunks.length} blocos`);
    } catch (e) {
      console.log(`erro: ${(e as Error).message}`);
    }
  }

  // Lei que falhou agora mantém a versão anterior do corpus.
  const updated = new Set(fresh.map((c) => c.lawId));
  const keep = existing.filter((c) => !updated.has(c.lawId));
  const all = [...keep, ...fresh];
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), chunks: all }),
    "utf8",
  );
  console.log(`✓ ${all.length} blocos em ${path.relative(root, outPath)}`);

  if (noDb || !process.env["DATABASE_URL"]?.trim() || !process.env["GEMINI_API_KEY"]?.trim()) {
    console.log("(sem DATABASE_URL/GEMINI_API_KEY ou --no-db: pulando pgvector)");
    return;
  }

  const { geminiEmbed } = await import("../src/server/gemini/client");
  const { query, closePool } = await import("../src/server/db/client");
  const BATCH = 50;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const vectors = await geminiEmbed(
      batch.map((c) => `${c.lawName} — ${c.article}\n${c.content}`),
      { taskType: "RETRIEVAL_DOCUMENT" },
    );
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j]!;
      const v = vectors[j];
      await query(
        `insert into legal_chunks (id, law_id, law_name, article, content, source_url, embedding, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::vector, now())
         on conflict (id) do update set
           law_name = excluded.law_name, article = excluded.article, content = excluded.content,
           source_url = excluded.source_url, embedding = excluded.embedding, updated_at = now()`,
        [
          c.id,
          c.lawId,
          c.lawName,
          c.article,
          c.content,
          c.sourceUrl,
          v?.length ? `[${v.join(",")}]` : null,
        ],
      );
    }
    process.stdout.write(`\r⇪ pgvector ${Math.min(i + BATCH, fresh.length)}/${fresh.length}`);
  }
  console.log("\n✓ pgvector atualizado");
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

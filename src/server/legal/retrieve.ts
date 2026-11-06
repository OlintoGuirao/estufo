/**
 * Recupera trechos da lei seca para fundamentar a resposta do professor (RAG).
 *
 * Ordem:
 * 1. pgvector (tabela legal_chunks — migration 013) se DATABASE_URL e GEMINI_API_KEY existirem;
 * 2. busca por palavras no corpus local data/legal/corpus.json (gerado por `npm run legal:ingest`);
 * 3. nada — o prompt segue sem FONTE LEGAL (e o professor é instruído a não inventar).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { formatLegalContext, keywordSearch, type LegalChunk } from "@/lib/legal/chunk";
import { guessLawIds } from "./laws";

export type LegalRetrieval = {
  text: string;
  sources: { lawName: string; article: string; url: string }[];
  via: "pgvector" | "keyword" | "none";
};

const EMPTY: LegalRetrieval = { text: "", sources: [], via: "none" };

let corpusCache: LegalChunk[] | null = null;

function corpusPath(): string {
  return (
    process.env["LEGAL_CORPUS_PATH"]?.trim() ||
    path.resolve(process.cwd(), "data", "legal", "corpus.json")
  );
}

export function loadLocalCorpus(): LegalChunk[] {
  if (corpusCache) return corpusCache;
  const p = corpusPath();
  if (!existsSync(p)) {
    corpusCache = [];
    return corpusCache;
  }
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as { chunks?: LegalChunk[] };
    corpusCache = raw.chunks ?? [];
  } catch (e) {
    console.warn("[legal] corpus inválido", e);
    corpusCache = [];
  }
  return corpusCache;
}

function toResult(chunks: LegalChunk[], via: LegalRetrieval["via"]): LegalRetrieval {
  if (!chunks.length) return EMPTY;
  return {
    text: formatLegalContext(chunks),
    sources: chunks.map((c) => ({ lawName: c.lawName, article: c.article, url: c.sourceUrl })),
    via,
  };
}

async function vectorSearch(
  query: string,
  limit: number,
  lawIds: string[],
): Promise<LegalChunk[] | null> {
  if (!process.env["DATABASE_URL"]?.trim() || !process.env["GEMINI_API_KEY"]?.trim()) return null;
  if ((process.env["LEGAL_RAG_VECTOR"] ?? "on").toLowerCase() === "off") return null;
  try {
    const { geminiEmbed } = await import("@/server/gemini/client");
    const { query: sql } = await import("@/server/db/client");
    const [vec] = await geminiEmbed([query.slice(0, 6_000)], { taskType: "RETRIEVAL_QUERY" });
    if (!vec?.length) return null;
    const r = await sql<{
      id: string;
      law_id: string;
      law_name: string;
      article: string;
      content: string;
      source_url: string;
    }>(
      `select id, law_id, law_name, article, content, source_url
         from match_legal_chunks($1::vector, $2::int, $3::text[])`,
      [`[${vec.join(",")}]`, limit, lawIds.length ? lawIds : null],
    );
    return r.rows.map((row) => ({
      id: row.id,
      lawId: row.law_id,
      lawName: row.law_name,
      article: row.article,
      content: row.content,
      sourceUrl: row.source_url,
    }));
  } catch (e) {
    console.warn("[legal] pgvector indisponível — usando busca local:", (e as Error).message);
    return null;
  }
}

export async function retrieveLegalContext(
  query: string,
  opts?: { limit?: number; lawIds?: string[] },
): Promise<LegalRetrieval> {
  if ((process.env["LEGAL_RAG"] ?? "on").toLowerCase() === "off") return EMPTY;
  const q = query.trim();
  if (q.length < 10) return EMPTY;
  const limit = opts?.limit ?? 6;
  const lawIds = opts?.lawIds ?? guessLawIds(q);

  const vec = await vectorSearch(q, limit, lawIds);
  if (vec?.length) return toResult(vec, "pgvector");

  const corpus = loadLocalCorpus();
  if (!corpus.length) return EMPTY;
  let hits = keywordSearch(corpus, q, { limit, lawIds });
  if (!hits.length && lawIds.length) hits = keywordSearch(corpus, q, { limit });
  return toResult(hits, "keyword");
}

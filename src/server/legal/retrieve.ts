/**
 * Recupera trechos da lei seca para fundamentar a resposta do professor (RAG).
 *
 * Ordem:
 * 1. pgvector (tabela legal_chunks — migration 013) se DATABASE_URL e GEMINI_API_KEY existirem;
 * 2. busca por palavras no corpus `public/legal/<lei>.json` (gerado por `npm run legal:ingest`);
 * 3. nada — o prompt segue sem FONTE LEGAL (e o professor é instruído a não inventar).
 *
 * O corpus é ARQUIVO ESTÁTICO de propósito: no Cloudflare Workers o servidor
 * não enxerga o disco do projeto (`existsSync("data/legal/corpus.json")` era
 * sempre falso em produção e a IA explicava artigo sem o texto da lei).
 * Aqui: lê do disco quando existe (Node/dev/scripts); senão busca
 * `/legal/<lei>.json` na própria origem da requisição.
 */
import { formatLegalContext, keywordSearch, mergeArticleChunks, type LegalChunk } from "@/lib/legal/chunk";
import { guessLawIds, LEGAL_SOURCES } from "./laws";

export type LegalRetrieval = {
  text: string;
  sources: { lawName: string; article: string; url: string }[];
  via: "pgvector" | "keyword" | "none";
};

const EMPTY: LegalRetrieval = { text: "", sources: [], via: "none" };

/**
 * Cache por isolate SÓ com dados já resolvidos. Guardar a Promise do fetch e
 * aguardá-la em outra requisição é proibido no Workers (I/O de outra requisição).
 */
const lawCache = new Map<string, LegalChunk[]>();

type LawLoader = (lawId: string) => Promise<LegalChunk[] | null>;

async function readLawFromDisk(lawId: string): Promise<LegalChunk[] | null> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = process.env["LEGAL_CORPUS_DIR"]?.trim() || path.resolve(process.cwd(), "public", "legal");
    const file = path.join(dir, `${lawId}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { chunks?: LegalChunk[] };
    return raw.chunks ?? null;
  } catch {
    return null; // runtime sem disco (Workers) ou arquivo inválido
  }
}

async function requestOrigin(): Promise<string | null> {
  const fromEnv = process.env["PUBLIC_APP_URL"]?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return new URL(getRequest().url).origin;
  } catch {
    return null;
  }
}

async function fetchLawAsset(lawId: string): Promise<LegalChunk[] | null> {
  const origin = await requestOrigin();
  if (!origin) return null;
  try {
    const res = await fetch(`${origin}/legal/${encodeURIComponent(lawId)}.json`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[legal] corpus ${lawId} indisponível: HTTP ${res.status}`);
      return null;
    }
    const raw = (await res.json()) as { chunks?: LegalChunk[] };
    return raw.chunks ?? null;
  } catch (e) {
    console.warn(`[legal] corpus ${lawId} falhou:`, (e as Error).message);
    return null;
  }
}

const defaultLoaders: LawLoader[] = [readLawFromDisk, fetchLawAsset];
let loaders: LawLoader[] = defaultLoaders;

/** Testes: troca a origem do corpus. */
export function __setLawLoadersForTest(next: LawLoader[] | null): void {
  loaders = next ?? defaultLoaders;
  lawCache.clear();
}

export async function loadLawChunks(lawIds: string[]): Promise<LegalChunk[]> {
  const ids = lawIds.length ? lawIds : LEGAL_SOURCES.map((l) => l.id);
  const out: LegalChunk[] = [];
  await Promise.all(
    ids.map(async (id) => {
      let chunks = lawCache.get(id);
      if (!chunks) {
        for (const load of loaders) {
          const got = await load(id);
          if (got?.length) {
            chunks = got;
            break;
          }
        }
        if (chunks) lawCache.set(id, chunks); // falha não fica em cache
      }
      if (chunks) out.push(...chunks);
    }),
  );
  return out;
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

  const corpus = await loadLawChunks(lawIds);
  if (!corpus.length) {
    console.warn(`[legal] corpus vazio para [${lawIds.join(",") || "todas"}] — prompt sem FONTE LEGAL`);
    return EMPTY;
  }
  let pool = corpus;
  let hits = keywordSearch(pool, q, { limit, lawIds });
  // Só amplia para todas as leis se a consulta NÃO trouxe a lei explícita:
  // com "(CPP)" no rótulo, cair no art. 351 do CP seria a lei errada.
  if (!hits.length && lawIds.length && !/\((CPP|CPC|CP|CF|Lei|LC)\b/.test(q)) {
    pool = await loadLawChunks([]);
    hits = keywordSearch(pool, q, { limit });
  }
  return toResult(mergeArticleChunks(hits, pool), "keyword");
}

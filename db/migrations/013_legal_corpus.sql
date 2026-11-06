-- Lei seca do edital para o Professor IA (RAG).
-- Preenchido por: npm run legal:ingest  (com DATABASE_URL e GEMINI_API_KEY)
-- No Supabase: Database → Extensions → habilite "vector" (ou o CREATE abaixo faz isso).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS legal_chunks (
  id          TEXT PRIMARY KEY,
  law_id      TEXT NOT NULL,
  law_name    TEXT NOT NULL,
  article     TEXT NOT NULL,
  content     TEXT NOT NULL,
  source_url  TEXT NOT NULL,
  embedding   vector(768),
  fts         tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_chunks_law_idx ON legal_chunks (law_id);
CREATE INDEX IF NOT EXISTS legal_chunks_fts_idx ON legal_chunks USING gin (fts);
CREATE INDEX IF NOT EXISTS legal_chunks_embedding_idx
  ON legal_chunks USING hnsw (embedding vector_cosine_ops);

-- Busca semântica (cosseno), opcionalmente filtrada por lei.
CREATE OR REPLACE FUNCTION match_legal_chunks(
  query_embedding vector(768),
  match_count INT DEFAULT 6,
  law_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id TEXT, law_id TEXT, law_name TEXT, article TEXT,
  content TEXT, source_url TEXT, similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.law_id, c.law_name, c.article, c.content, c.source_url,
         1 - (c.embedding <=> query_embedding) AS similarity
    FROM legal_chunks c
   WHERE c.embedding IS NOT NULL
     AND (law_filter IS NULL OR c.law_id = ANY (law_filter))
   ORDER BY c.embedding <=> query_embedding
   LIMIT match_count;
$$;

-- Texto oficial é público: leitura liberada, escrita só pelo servidor (service role / DATABASE_URL).
ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_chunks_select_public ON legal_chunks;
CREATE POLICY legal_chunks_select_public ON legal_chunks
  FOR SELECT TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';

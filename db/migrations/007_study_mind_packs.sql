-- Pacotes de estudo (mapa mental + flashcards) por device_id.
-- Complementa o schema mind_maps de 001 (ainda ligado a users) com sync anônimo.

CREATE TABLE IF NOT EXISTS study_mind_packs (
  id               TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL,
  title            TEXT NOT NULL DEFAULT '',
  subject          TEXT NOT NULL DEFAULT '',
  material         TEXT NOT NULL DEFAULT '',
  summary          TEXT NOT NULL DEFAULT '',
  pack             JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_generated     BOOLEAN NOT NULL DEFAULT false,
  mocked           BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_mind_packs_device_updated
  ON study_mind_packs (device_id, updated_at DESC);

ALTER TABLE study_mind_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_mind_packs_anon_all ON study_mind_packs;
CREATE POLICY study_mind_packs_anon_all ON study_mind_packs
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

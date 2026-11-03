-- Prova diagnóstica (plano de estudo): tentativa + respostas por dispositivo.
-- Sem auth Supabase ainda — device_id no client. Trocar por user_id quando login real existir.

CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id                    TEXT PRIMARY KEY,
  device_id             TEXT NOT NULL,
  prova_id              INTEGER,
  prova_title           TEXT,
  status                TEXT NOT NULL DEFAULT 'running'
                          CHECK (status IN ('running', 'finished')),
  current_index         INTEGER NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  drafts                JSONB NOT NULL DEFAULT '{}'::jsonb,
  question_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions_snapshot    JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers_snapshot      JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis              JSONB,
  scheduled_focus_keys  JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_device_status
  ON diagnostic_runs (device_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_device_finished
  ON diagnostic_runs (device_id, finished_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS diagnostic_answers (
  run_id       TEXT NOT NULL REFERENCES diagnostic_runs (id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL,
  subject      TEXT NOT NULL,
  topic        TEXT NOT NULL,
  choice       CHAR(1) NOT NULL CHECK (choice ~ '^[A-E]$'),
  correct_key  CHAR(1) NOT NULL CHECK (correct_key ~ '^[A-E]$'),
  correct      BOOLEAN NOT NULL,
  answered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_answers_run
  ON diagnostic_answers (run_id);

-- RLS: catálogo de tentativas acessível via anon (filtro device_id no app).
-- Quando houver auth, restringir a auth.uid() / user_id.
ALTER TABLE diagnostic_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostic_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diagnostic_runs_anon_all ON diagnostic_runs;
CREATE POLICY diagnostic_runs_anon_all ON diagnostic_runs
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS diagnostic_answers_anon_all ON diagnostic_answers;
CREATE POLICY diagnostic_answers_anon_all ON diagnostic_answers
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

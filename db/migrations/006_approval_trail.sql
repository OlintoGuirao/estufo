-- Trilha da aprovação: plano da IA, aulas semanais e progresso do aluno.
-- Sem auth Supabase ainda — device_id no client (mesmo padrão de diagnostic_runs).

CREATE TABLE IF NOT EXISTS approval_trails (
  id                 TEXT PRIMARY KEY,
  device_id          TEXT NOT NULL,
  file_name          TEXT NOT NULL DEFAULT '',
  contest_name       TEXT NOT NULL DEFAULT '',
  organ              TEXT NOT NULL DEFAULT '',
  role               TEXT NOT NULL DEFAULT '',
  board              TEXT NOT NULL DEFAULT '',
  exam_date          DATE,
  summary            TEXT NOT NULL DEFAULT '',
  source_text_chars  INTEGER NOT NULL DEFAULT 0,
  mocked             BOOLEAN NOT NULL DEFAULT false,
  plan               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_trails_device_updated
  ON approval_trails (device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trail_week_lessons (
  trail_id    TEXT NOT NULL,
  week        INTEGER NOT NULL CHECK (week >= 1 AND week <= 52),
  device_id   TEXT NOT NULL,
  lesson      JSONB NOT NULL DEFAULT '{}'::jsonb,
  mocked      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trail_id, week)
);

CREATE INDEX IF NOT EXISTS idx_trail_week_lessons_device
  ON trail_week_lessons (device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trail_week_progress (
  trail_id               TEXT NOT NULL,
  week                   INTEGER NOT NULL CHECK (week >= 1 AND week <= 52),
  device_id              TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pendente'
                           CHECK (status IN ('pendente', 'em-andamento', 'concluida')),
  active_module_id       TEXT,
  completed_module_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
  practice_answers       JSONB NOT NULL DEFAULT '{}'::jsonb,
  chat                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trail_id, week, device_id)
);

CREATE INDEX IF NOT EXISTS idx_trail_week_progress_device
  ON trail_week_progress (device_id, updated_at DESC);

ALTER TABLE approval_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_week_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_week_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_trails_anon_all ON approval_trails;
CREATE POLICY approval_trails_anon_all ON approval_trails
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS trail_week_lessons_anon_all ON trail_week_lessons;
CREATE POLICY trail_week_lessons_anon_all ON trail_week_lessons
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS trail_week_progress_anon_all ON trail_week_progress;
CREATE POLICY trail_week_progress_anon_all ON trail_week_progress
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

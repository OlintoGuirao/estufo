-- Dados do aluno (simulado, caderno, revisões, plano, Quest) por device_id.
-- Espelha o que hoje vive em localStorage (aprovamind.mockdb / tjsp-quest / etc.).
-- Rode no SQL Editor do Supabase após 001–007.

-- ---------------------------------------------------------------------------
-- Caderno de erros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_error_notes (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_error_notes_device
  ON user_error_notes (device_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Simulados + resultado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_mock_exams (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  exam         JSONB NOT NULL DEFAULT '{}'::jsonb,
  result       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mock_exams_device
  ON user_mock_exams (device_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Revisões SRS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_reviews (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_reviews_device_due
  ON user_reviews (device_id, due_date);

-- ---------------------------------------------------------------------------
-- Sessões do plano / cronograma
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_study_sessions (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_date DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_study_sessions_device_date
  ON user_study_sessions (device_id, session_date);

-- ---------------------------------------------------------------------------
-- TJSP Quest — estado completo do jogador
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_quest_state (
  device_id    TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Cache IA do Quest (aula + questões VUNESP por fase)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_quest_phase_ai (
  id           TEXT PRIMARY KEY, -- device_id:phaseId
  device_id    TEXT NOT NULL,
  phase_id     TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  model        TEXT,
  mocked       BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, phase_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_phase_ai_device
  ON user_quest_phase_ai (device_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Estado local de questões do banco (favorito / respondida)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_question_local_state (
  device_id    TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS permissivo por device (mesmo padrão de study_mind_packs / diagnostic)
-- ---------------------------------------------------------------------------
ALTER TABLE user_error_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quest_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quest_phase_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_question_local_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_error_notes_anon_all ON user_error_notes;
CREATE POLICY user_error_notes_anon_all ON user_error_notes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_mock_exams_anon_all ON user_mock_exams;
CREATE POLICY user_mock_exams_anon_all ON user_mock_exams
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_reviews_anon_all ON user_reviews;
CREATE POLICY user_reviews_anon_all ON user_reviews
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_study_sessions_anon_all ON user_study_sessions;
CREATE POLICY user_study_sessions_anon_all ON user_study_sessions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_quest_state_anon_all ON user_quest_state;
CREATE POLICY user_quest_state_anon_all ON user_quest_state
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_quest_phase_ai_anon_all ON user_quest_phase_ai;
CREATE POLICY user_quest_phase_ai_anon_all ON user_quest_phase_ai
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_question_local_state_anon_all ON user_question_local_state;
CREATE POLICY user_question_local_state_anon_all ON user_question_local_state
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

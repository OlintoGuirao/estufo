-- Redação + agenda semanal (estudo / redação / prova) por device_id.
-- Rode após 009_video_lessons.sql.

CREATE TABLE IF NOT EXISTS user_redacao_state (
  device_id    TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_study_schedule (
  device_id    TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_redacao_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_study_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_redacao_state_anon_all ON user_redacao_state;
CREATE POLICY user_redacao_state_anon_all ON user_redacao_state
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_study_schedule_anon_all ON user_study_schedule;
CREATE POLICY user_study_schedule_anon_all ON user_study_schedule
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

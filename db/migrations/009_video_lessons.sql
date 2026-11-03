-- Progresso, anotações, quiz e respostas das videoaulas por device_id.
-- Rode após 008_study_user_data.sql.

CREATE TABLE IF NOT EXISTS user_video_lesson_progress (
  device_id    TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_video_lesson_notes (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  lesson_id    TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_video_lesson_notes_device
  ON user_video_lesson_notes (device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_video_lesson_quiz (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  lesson_id    TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_user_video_lesson_quiz_device
  ON user_video_lesson_quiz (device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_video_lesson_answers (
  device_id    TEXT PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_video_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_lesson_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_lesson_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_video_lesson_progress_anon_all ON user_video_lesson_progress;
CREATE POLICY user_video_lesson_progress_anon_all ON user_video_lesson_progress
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_video_lesson_notes_anon_all ON user_video_lesson_notes;
CREATE POLICY user_video_lesson_notes_anon_all ON user_video_lesson_notes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_video_lesson_quiz_anon_all ON user_video_lesson_quiz;
CREATE POLICY user_video_lesson_quiz_anon_all ON user_video_lesson_quiz
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_video_lesson_answers_anon_all ON user_video_lesson_answers;
CREATE POLICY user_video_lesson_answers_anon_all ON user_video_lesson_answers
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

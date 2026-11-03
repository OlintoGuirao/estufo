-- Sessões diárias da trilha (podem passar de 52) + topic_ids no progresso.

ALTER TABLE trail_week_lessons
  DROP CONSTRAINT IF EXISTS trail_week_lessons_week_check;
ALTER TABLE trail_week_lessons
  ADD CONSTRAINT trail_week_lessons_week_check
  CHECK (week >= 1 AND week <= 366);

ALTER TABLE trail_week_progress
  DROP CONSTRAINT IF EXISTS trail_week_progress_week_check;
ALTER TABLE trail_week_progress
  ADD CONSTRAINT trail_week_progress_week_check
  CHECK (week >= 1 AND week <= 366);

ALTER TABLE trail_week_progress
  ADD COLUMN IF NOT EXISTS topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

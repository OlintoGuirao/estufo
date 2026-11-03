-- Índice do módulo ativo (ex.: material 12) para "Continuar de onde parei".

ALTER TABLE trail_week_progress
  ADD COLUMN IF NOT EXISTS active_module_index INTEGER
  CHECK (active_module_index IS NULL OR active_module_index >= 1);

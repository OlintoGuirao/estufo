-- Políticas RLS: catálogo legível pela anon/authenticated key (PostgREST).
-- Dados de usuário continuam restritos.
-- Rode no SQL Editor do Supabase após o seed.

-- ---------------------------------------------------------------------------
-- Catálogo público (leitura)
-- ---------------------------------------------------------------------------

ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_alternatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contests_select_public ON contests;
CREATE POLICY contests_select_public ON contests
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS subjects_select_public ON subjects;
CREATE POLICY subjects_select_public ON subjects
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS topics_select_public ON topics;
CREATE POLICY topics_select_public ON topics
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS contest_subjects_select_public ON contest_subjects;
CREATE POLICY contest_subjects_select_public ON contest_subjects
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS contest_topics_select_public ON contest_topics;
CREATE POLICY contest_topics_select_public ON contest_topics
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS questions_select_public ON questions;
CREATE POLICY questions_select_public ON questions
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS question_alternatives_select_public ON question_alternatives;
CREATE POLICY question_alternatives_select_public ON question_alternatives
  FOR SELECT TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Tabelas de usuário: RLS ligado, sem policy pública (só service_role / policies futuras)
-- ---------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_study_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_priority_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- exam_imports (se existir da migration 002)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exam_imports'
  ) THEN
    EXECUTE 'ALTER TABLE exam_imports ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- =============================================================================
-- ISOLAMENTO POR CONTA NO BANCO (RLS)
--
-- Antes: as tabelas de estudo tinham política "USING (true)" — qualquer
-- cliente podia ler/gravar linhas de QUALQUER aluno, e o isolamento dependia
-- só do filtro device_id feito pelo app.
--
-- Agora o próprio banco garante:
--   * Logado (JWT do Supabase): só enxerga/grava linhas com
--     device_id = 'user_' || auth.uid()   (as dele)
--     e linhas 'dev_%' (dados feitos sem login neste aparelho, para o app
--     poder "adotá-los" no 1º login).
--   * Sem login: só linhas 'dev_%'.
--   Uma conta NUNCA lê nem grava linhas 'user_<outra conta>'.
--
-- O servidor (DATABASE_URL / service role) não passa por RLS — scripts seguem
-- funcionando.
--
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.estufoo_owner_ok(owner TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN owner IS NULL THEN FALSE
    WHEN auth.uid() IS NOT NULL
      THEN owner = 'user_' || auth.uid()::text OR owner LIKE 'dev\_%'
    ELSE owner LIKE 'dev\_%'
  END
$$;

DO $$
DECLARE
  t TEXT;
  p RECORD;
  tables TEXT[] := ARRAY[
    'approval_trails',
    'trail_week_lessons',
    'trail_week_progress',
    'diagnostic_runs',
    'study_mind_packs',
    'user_error_notes',
    'user_mock_exams',
    'user_reviews',
    'user_study_sessions',
    'user_quest_phase_ai',
    'user_quest_state',
    'user_question_local_state',
    'user_video_lesson_progress',
    'user_video_lesson_answers',
    'user_video_lesson_notes',
    'user_video_lesson_quiz',
    'user_redacao_state',
    'user_study_schedule'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'tabela % não existe — pulando', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Remove TODAS as políticas antigas (inclusive as "USING (true)").
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated
         USING (public.estufoo_owner_ok(device_id))
         WITH CHECK (public.estufoo_owner_ok(device_id))',
      t || '_owner_only', t
    );
  END LOOP;
END $$;

-- Respostas do diagnóstico não têm device_id: seguem o dono da tentativa.
DO $$
DECLARE p RECORD;
BEGIN
  IF to_regclass('public.diagnostic_answers') IS NOT NULL THEN
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'diagnostic_answers' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.diagnostic_answers', p.policyname);
    END LOOP;
    ALTER TABLE public.diagnostic_answers ENABLE ROW LEVEL SECURITY;
    CREATE POLICY diagnostic_answers_owner_only ON public.diagnostic_answers
      FOR ALL TO anon, authenticated
      USING (EXISTS (
        SELECT 1 FROM public.diagnostic_runs r
        WHERE r.id = run_id AND public.estufoo_owner_ok(r.device_id)))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.diagnostic_runs r
        WHERE r.id = run_id AND public.estufoo_owner_ok(r.device_id)));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Conferência: todas devem aparecer com a política *_owner_only.
-- SELECT tablename, policyname, qual FROM pg_policies
--  WHERE schemaname = 'public' AND policyname LIKE '%owner_only' ORDER BY 1;

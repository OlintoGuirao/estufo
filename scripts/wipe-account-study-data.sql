-- Limpa dados de estudo das contas (mantém login em auth.users).
-- Cole no Supabase → SQL Editor → Run.
-- device_id das tabelas sync = 'user_' || auth.users.id

DO $$
DECLARE
  u RECORD;
  owner TEXT;
  n BIGINT;
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
  t TEXT;
BEGIN
  FOR u IN
    SELECT id, email
    FROM auth.users
    WHERE lower(email) IN (
      lower('fabiolaferreiraconcursos@gmail.com'),
      lower('Fabiola_ferreira@hotmail.com')
    )
  LOOP
    owner := 'user_' || u.id::text;
    RAISE NOTICE 'Limpando % → %', u.email, owner;

    FOREACH t IN ARRAY tables LOOP
      EXECUTE format('DELETE FROM public.%I WHERE device_id = $1', t)
        USING owner;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        RAISE NOTICE '  %: % linha(s)', t, n;
      END IF;
    END LOOP;

    -- Quest com user_id (attempts/reviews caem em cascade)
    DELETE FROM public.quest_player_progress WHERE user_id = u.id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE '  quest_player_progress: %', n;
    END IF;

    DELETE FROM public.quest_player_progress WHERE device_id = owner;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) IN (
      lower('fabiolaferreiraconcursos@gmail.com'),
      lower('Fabiola_ferreira@hotmail.com')
    )
  ) THEN
    RAISE NOTICE 'Nenhuma conta encontrada com esses e-mails.';
  END IF;
END $$;

-- Conferência
SELECT u.email, u.id, ('user_' || u.id::text) AS owner_key
FROM auth.users u
WHERE lower(u.email) IN (
  lower('fabiolaferreiraconcursos@gmail.com'),
  lower('Fabiola_ferreira@hotmail.com')
);

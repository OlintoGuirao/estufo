-- EstuFoo / AprovaMind — schema inicial (PostgreSQL 14+)
-- Catálogo compartilhado + dados por usuário (multi-tenant)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE contest_status AS ENUM ('aberto', 'previsto', 'encerrado');
CREATE TYPE difficulty AS ENUM ('facil', 'media', 'dificil');
CREATE TYPE study_level AS ENUM ('iniciante', 'intermediario', 'avancado');
CREATE TYPE session_status AS ENUM ('planejada', 'concluida', 'atrasada');
CREATE TYPE activity_type AS ENUM ('teoria', 'questoes', 'revisao', 'simulado');
CREATE TYPE priority_level AS ENUM ('alta', 'media', 'baixa');
CREATE TYPE mastery AS ENUM ('nao-estudado', 'baixo', 'intermediario', 'bom', 'revisado');
CREATE TYPE exam_status AS ENUM ('pendente', 'concluido');
CREATE TYPE correction_mode AS ENUM ('ao-final', 'imediata');

-- ---------------------------------------------------------------------------
-- Função utilitária: updated_at automático
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Catálogo: concursos, matérias, tópicos
-- ---------------------------------------------------------------------------

CREATE TABLE contests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  organ         TEXT NOT NULL,
  role          TEXT NOT NULL,
  board         TEXT NOT NULL,
  status        contest_status NOT NULL DEFAULT 'previsto',
  exam_date     DATE,
  vacancies     INTEGER NOT NULL DEFAULT 0 CHECK (vacancies >= 0),
  salary        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  source_file   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contests_status ON contests (status);
CREATE INDEX idx_contests_board ON contests (board);
CREATE INDEX idx_contests_exam_date ON contests (exam_date);

CREATE TRIGGER trg_contests_updated_at
  BEFORE UPDATE ON contests
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug),
  UNIQUE (subject_id, name)
);

CREATE INDEX idx_topics_subject ON topics (subject_id);

CREATE TABLE contest_subjects (
  contest_id UUID NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, subject_id)
);

CREATE TABLE contest_topics (
  contest_id UUID NOT NULL REFERENCES contests (id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, topic_id)
);

-- ---------------------------------------------------------------------------
-- Usuários e onboarding
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  onboarded         BOOLEAN NOT NULL DEFAULT false,
  active_contest_id UUID REFERENCES contests (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_active_contest ON users (active_contest_id);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE user_study_profiles (
  user_id         UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  contest_id      UUID NOT NULL REFERENCES contests (id) ON DELETE RESTRICT,
  role            TEXT NOT NULL,
  board           TEXT NOT NULL,
  exam_date       DATE,
  hours_per_day   NUMERIC(4, 1) NOT NULL CHECK (hours_per_day > 0 AND hours_per_day <= 24),
  week_days       SMALLINT[] NOT NULL DEFAULT '{}',
  level           study_level NOT NULL DEFAULT 'iniciante',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT week_days_valid CHECK (
    week_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
  )
);

CREATE TRIGGER trg_user_study_profiles_updated_at
  BEFORE UPDATE ON user_study_profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE user_priority_subjects (
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, subject_id)
);

-- ---------------------------------------------------------------------------
-- Banco de questões
-- ---------------------------------------------------------------------------

CREATE TABLE questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement     TEXT NOT NULL,
  board         TEXT NOT NULL,
  year          SMALLINT NOT NULL CHECK (year >= 1990 AND year <= 2100),
  contest_id    UUID REFERENCES contests (id) ON DELETE SET NULL,
  contest_label TEXT,
  subject_id    UUID NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  topic_id      UUID NOT NULL REFERENCES topics (id) ON DELETE RESTRICT,
  difficulty    difficulty NOT NULL DEFAULT 'media',
  source        TEXT NOT NULL DEFAULT '',
  correct_key   CHAR(1) NOT NULL CHECK (correct_key ~ '^[A-E]$'),
  explanation   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_subject ON questions (subject_id);
CREATE INDEX idx_questions_topic ON questions (topic_id);
CREATE INDEX idx_questions_contest ON questions (contest_id);
CREATE INDEX idx_questions_board_year ON questions (board, year);
CREATE INDEX idx_questions_difficulty ON questions (difficulty);

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE question_alternatives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  key         CHAR(1) NOT NULL CHECK (key ~ '^[A-E]$'),
  text        TEXT NOT NULL,
  UNIQUE (question_id, key)
);

CREATE INDEX idx_question_alternatives_question ON question_alternatives (question_id);

-- Estado por usuário (favorito, marcar revisão, última resposta)
CREATE TABLE question_user_states (
  user_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_id       UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  favorite          BOOLEAN NOT NULL DEFAULT false,
  marked_for_review BOOLEAN NOT NULL DEFAULT false,
  last_choice       CHAR(1) CHECK (last_choice IS NULL OR last_choice ~ '^[A-E]$'),
  last_correct      BOOLEAN,
  last_answered_at  TIMESTAMPTZ,
  last_time_sec     INTEGER CHECK (last_time_sec IS NULL OR last_time_sec >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

CREATE INDEX idx_question_user_states_user_fav
  ON question_user_states (user_id) WHERE favorite = true;
CREATE INDEX idx_question_user_states_user_review
  ON question_user_states (user_id) WHERE marked_for_review = true;
CREATE INDEX idx_question_user_states_answered
  ON question_user_states (user_id, last_answered_at)
  WHERE last_answered_at IS NOT NULL;

CREATE TRIGGER trg_question_user_states_updated_at
  BEFORE UPDATE ON question_user_states
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Histórico de respostas (desempenho / analytics)
CREATE TABLE question_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  choice      CHAR(1) NOT NULL CHECK (choice ~ '^[A-E]$'),
  correct     BOOLEAN NOT NULL,
  time_sec    INTEGER CHECK (time_sec IS NULL OR time_sec >= 0),
  source      TEXT NOT NULL DEFAULT 'practice'
                CHECK (source IN ('practice', 'exam', 'review')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_question_answers_user ON question_answers (user_id, created_at DESC);
CREATE INDEX idx_question_answers_question ON question_answers (question_id);
CREATE INDEX idx_question_answers_user_correct ON question_answers (user_id, correct);

-- ---------------------------------------------------------------------------
-- Plano de estudos (sessões)
-- ---------------------------------------------------------------------------

CREATE TABLE study_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  contest_id   UUID REFERENCES contests (id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  subject_id   UUID REFERENCES subjects (id) ON DELETE SET NULL,
  topic_id     UUID REFERENCES topics (id) ON DELETE SET NULL,
  subject_name TEXT NOT NULL,
  topic_name   TEXT NOT NULL,
  activity     activity_type NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  priority     priority_level NOT NULL DEFAULT 'media',
  status       session_status NOT NULL DEFAULT 'planejada',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_sessions_user_date ON study_sessions (user_id, date);
CREATE INDEX idx_study_sessions_user_status ON study_sessions (user_id, status);

CREATE TRIGGER trg_study_sessions_updated_at
  BEFORE UPDATE ON study_sessions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ---------------------------------------------------------------------------
-- Simulados
-- ---------------------------------------------------------------------------

CREATE TABLE mock_exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  contest_id       UUID NOT NULL REFERENCES contests (id) ON DELETE RESTRICT,
  title            TEXT NOT NULL,
  question_count   INTEGER NOT NULL CHECK (question_count > 0),
  time_limit_min   INTEGER NOT NULL CHECK (time_limit_min > 0),
  correction_mode  correction_mode NOT NULL DEFAULT 'ao-final',
  status           exam_status NOT NULL DEFAULT 'pendente',
  score            INTEGER CHECK (score IS NULL OR score >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mock_exams_user ON mock_exams (user_id, created_at DESC);
CREATE INDEX idx_mock_exams_contest ON mock_exams (contest_id);

CREATE TRIGGER trg_mock_exams_updated_at
  BEFORE UPDATE ON mock_exams
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE mock_exam_subjects (
  mock_exam_id UUID NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
  subject_id   UUID NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  subject_name TEXT NOT NULL,
  PRIMARY KEY (mock_exam_id, subject_id)
);

CREATE TABLE mock_exam_questions (
  mock_exam_id UUID NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  position     INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (mock_exam_id, question_id),
  UNIQUE (mock_exam_id, position)
);

CREATE TABLE mock_exam_results (
  mock_exam_id     UUID PRIMARY KEY REFERENCES mock_exams (id) ON DELETE CASCADE,
  score            INTEGER NOT NULL CHECK (score >= 0),
  correct_pct      NUMERIC(5, 2) NOT NULL CHECK (correct_pct >= 0 AND correct_pct <= 100),
  time_used_sec    INTEGER NOT NULL CHECK (time_used_sec >= 0),
  by_subject       JSONB NOT NULL DEFAULT '[]'::jsonb,
  by_topic         JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mock_exam_answers (
  mock_exam_id UUID NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  choice       CHAR(1) CHECK (choice IS NULL OR choice ~ '^[A-E]$'),
  correct      BOOLEAN,
  PRIMARY KEY (mock_exam_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Mapas mentais
-- ---------------------------------------------------------------------------

CREATE TABLE mind_maps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  subject_id   UUID REFERENCES subjects (id) ON DELETE SET NULL,
  subject_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mind_maps_user ON mind_maps (user_id, updated_at DESC);

CREATE TRIGGER trg_mind_maps_updated_at
  BEFORE UPDATE ON mind_maps
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE mind_nodes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mind_map_id  UUID NOT NULL REFERENCES mind_maps (id) ON DELETE CASCADE,
  pos_x        DOUBLE PRECISION NOT NULL DEFAULT 0,
  pos_y        DOUBLE PRECISION NOT NULL DEFAULT 0,
  title        TEXT NOT NULL,
  description  TEXT,
  summary      TEXT,
  notes        TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  mastery      mastery NOT NULL DEFAULT 'nao-estudado',
  last_review  DATE,
  is_root      BOOLEAN NOT NULL DEFAULT false,
  collapsed    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mind_nodes_map ON mind_nodes (mind_map_id);

CREATE TRIGGER trg_mind_nodes_updated_at
  BEFORE UPDATE ON mind_nodes
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE mind_node_questions (
  node_id     UUID NOT NULL REFERENCES mind_nodes (id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, question_id)
);

CREATE TABLE mind_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mind_map_id     UUID NOT NULL REFERENCES mind_maps (id) ON DELETE CASCADE,
  source_node_id  UUID NOT NULL REFERENCES mind_nodes (id) ON DELETE CASCADE,
  target_node_id  UUID NOT NULL REFERENCES mind_nodes (id) ON DELETE CASCADE,
  UNIQUE (mind_map_id, source_node_id, target_node_id),
  CHECK (source_node_id <> target_node_id)
);

CREATE INDEX idx_mind_links_map ON mind_links (mind_map_id);

-- ---------------------------------------------------------------------------
-- Revisões espaçadas (SRS)
-- Intervalos por confiança 1–5: 1, 1, 3, 7, 15 dias
-- ---------------------------------------------------------------------------

CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subject_id      UUID REFERENCES subjects (id) ON DELETE SET NULL,
  topic_id        UUID REFERENCES topics (id) ON DELETE SET NULL,
  subject_name    TEXT NOT NULL,
  topic_name      TEXT NOT NULL,
  due_date        DATE NOT NULL,
  mastery         mastery NOT NULL DEFAULT 'nao-estudado',
  last_confidence SMALLINT CHECK (last_confidence IS NULL OR (last_confidence BETWEEN 1 AND 5)),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_name, topic_name)
);

CREATE INDEX idx_reviews_user_due ON reviews (user_id, due_date);
CREATE INDEX idx_reviews_user_mastery ON reviews (user_id, mastery);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read = false;
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Importação de editais (pipeline assíncrono)
-- ---------------------------------------------------------------------------

CREATE TABLE contest_imports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  contest_id   UUID REFERENCES contests (id) ON DELETE SET NULL,
  file_name    TEXT NOT NULL,
  storage_path TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ
);

CREATE INDEX idx_contest_imports_user ON contest_imports (user_id, created_at DESC);

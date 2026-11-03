-- Importação manual de provas/gabaritos (PDF enviados por usuário autorizado)
-- Schema futuro — a app atual persiste rascunhos em localStorage (mock).

CREATE TYPE exam_import_batch_status AS ENUM (
  'uploaded',
  'extracted',
  'needs_review',
  'partially_published',
  'failed'
);

CREATE TYPE exam_import_item_status AS ENUM ('draft', 'approved', 'rejected');

CREATE TABLE exam_imports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id       UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status                   exam_import_batch_status NOT NULL DEFAULT 'uploaded',
  authorization_confirmed  BOOLEAN NOT NULL DEFAULT false,
  board                    TEXT NOT NULL,
  organ                    TEXT NOT NULL,
  role                     TEXT NOT NULL,
  year                     SMALLINT NOT NULL CHECK (year >= 1990 AND year <= 2100),
  exam_name                TEXT NOT NULL,
  booklet_type             TEXT NOT NULL DEFAULT '',
  source_url               TEXT NOT NULL DEFAULT '',
  exam_file_name           TEXT NOT NULL,
  exam_mime_type           TEXT NOT NULL DEFAULT 'application/pdf',
  exam_size_bytes          BIGINT NOT NULL CHECK (exam_size_bytes > 0),
  exam_sha256              CHAR(64) NOT NULL,
  exam_storage_path        TEXT,
  answer_file_name         TEXT,
  answer_mime_type         TEXT,
  answer_size_bytes        BIGINT CHECK (answer_size_bytes IS NULL OR answer_size_bytes > 0),
  answer_sha256            CHAR(64),
  answer_storage_path      TEXT,
  text_extractable         BOOLEAN NOT NULL DEFAULT false,
  needs_ocr                BOOLEAN NOT NULL DEFAULT false,
  error                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_sha256)
);

CREATE INDEX idx_exam_imports_meta
  ON exam_imports (board, organ, role, year, exam_name, booklet_type);
CREATE INDEX idx_exam_imports_user ON exam_imports (created_by_user_id, created_at DESC);

CREATE TRIGGER trg_exam_imports_updated_at
  BEFORE UPDATE ON exam_imports
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE exam_import_pages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id  UUID NOT NULL REFERENCES exam_imports (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('exam', 'answer_key')),
  page       INTEGER NOT NULL CHECK (page >= 1),
  text       TEXT NOT NULL DEFAULT '',
  char_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (import_id, kind, page)
);

CREATE TABLE exam_import_questions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id              UUID NOT NULL REFERENCES exam_imports (id) ON DELETE CASCADE,
  number                 INTEGER NOT NULL CHECK (number >= 1),
  statement              TEXT NOT NULL DEFAULT '',
  correct_key            CHAR(1) CHECK (correct_key IS NULL OR correct_key ~ '^[A-E]$'),
  subject_name           TEXT NOT NULL DEFAULT '',
  topic_name             TEXT NOT NULL DEFAULT '',
  status                 exam_import_item_status NOT NULL DEFAULT 'draft',
  page_start             INTEGER,
  page_end               INTEGER,
  confidence             NUMERIC(4, 3) NOT NULL DEFAULT 0,
  explanation            TEXT NOT NULL DEFAULT '',
  explanation_source     TEXT NOT NULL DEFAULT 'none'
                           CHECK (explanation_source IN ('none', 'official', 'ai')),
  published_question_id  UUID REFERENCES questions (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (import_id, number, id)
);

CREATE INDEX idx_exam_import_questions_status
  ON exam_import_questions (import_id, status);

CREATE TRIGGER trg_exam_import_questions_updated_at
  BEFORE UPDATE ON exam_import_questions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TABLE exam_import_alternatives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES exam_import_questions (id) ON DELETE CASCADE,
  key         CHAR(1) NOT NULL CHECK (key ~ '^[A-E]$'),
  text        TEXT NOT NULL,
  UNIQUE (question_id, key)
);

CREATE TABLE exam_import_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id       UUID NOT NULL REFERENCES exam_imports (id) ON DELETE CASCADE,
  question_id     UUID REFERENCES exam_import_questions (id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  message         TEXT NOT NULL,
  question_number INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questões do catálogo público só após aprovação (published_question_id).
-- Nunca publicar automaticamente a partir deste schema.

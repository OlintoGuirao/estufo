# Supabase (padrão do projeto)

Mesmo estilo dos outros apps Vite/Lovable:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # ou a anon key eyJ...
```

Client: `src/lib/supabase.ts` → `import { supabase } from "@/lib/supabase"`.

## Onde pegar as chaves

1. [Dashboard](https://supabase.com/dashboard) → seu projeto  
2. **Project Settings → API**  
3. **Project URL** → `VITE_SUPABASE_URL`  
4. **Publishable key** (ou **anon public**) → `VITE_SUPABASE_PUBLISHABLE_KEY`

Nunca coloque **service_role** em variável `VITE_` (expõe no browser).

## Schema SQL

Com esse padrão, o schema sobe pelo **SQL Editor** do Supabase (ou CLI), não pela URI `postgresql://`:

1. Abra **SQL Editor** no Dashboard  
2. Cole e rode, nesta ordem:  
   - `db/migrations/001_init.sql`  
   - `db/migrations/002_exam_imports.sql`  
   - `db/seed.sql` (idempotente)  
   - `db/migrations/003_rls_public_catalog.sql` (leitura pública do catálogo via anon key)  
   - `db/migrations/004_diagnostic_runs.sql` (prova diagnóstica + respostas por `device_id`)  
   - `db/migrations/006_approval_trail.sql` (trilha IA + aulas + progresso por `device_id`)  
   - `db/migrations/007_study_mind_packs.sql` (mapa mental + flashcards por `device_id`)  
   - `db/migrations/008_study_user_data.sql` (erros, simulados, revisões, plano, Quest, estado de questões por `device_id`)  
   - `db/migrations/009_video_lessons.sql` (progresso, anotações, quiz e respostas das videoaulas por `device_id`)

## Opcional: `DATABASE_URL`

Só se quiser `npm run db:migrate` via `pg` direto. **Não é necessário** para o client JS.

```env
# DATABASE_URL=postgresql://postgres.xxx:SENHA@…pooler.supabase.com:6543/postgres
```

## Estado do app

| Módulo | Fonte |
|--------|--------|
| Concursos (`/concursos`) | Supabase (se `VITE_SUPABASE_*` ok) |
| Questões locais (`/questoes`) | Supabase + estado local (favorito/resposta) |
| Plano de estudo / diagnóstico | `localStorage` + sync Supabase (`diagnostic_runs` / `diagnostic_answers`) por `device_id` |
| Trilha da aprovação | `localStorage` + sync Supabase (`approval_trails`, `trail_week_lessons`, `trail_week_progress`) por `device_id` |
| Mapas / flashcards | mock `localStorage` + sync opcional Supabase (`study_mind_packs`) por `device_id` |
| Caderno de erros | `localStorage` + sync Supabase (`user_error_notes`) por `device_id` |
| Simulados + resultados | `localStorage` + sync Supabase (`user_mock_exams`) por `device_id` |
| Revisões SRS / sessões do plano | `localStorage` + sync Supabase (`user_reviews`, `user_study_sessions`) |
| TJSP Quest (progresso + cache IA) | `localStorage` + sync Supabase (`user_quest_state`, `user_quest_phase_ai`) |
| Favoritos / respostas do banco | `localStorage` + sync Supabase (`user_question_local_state`) |
| Video aulas | arquivos locais (`VIDEO_LESSONS_ROOT`) + sync progresso/anotações/quiz (`009`) |
| Auth | Mock/`localStorage` (ainda sem Auth Supabase) |

### Diagnóstico no banco (`004`)

- Cada tentativa grava progresso, drafts, snapshot das questões e análise.
- Respostas também vão em `diagnostic_answers` (uma linha por questão).
- Sem login ainda: o app usa `estufoo.device-id` no browser e filtra por `device_id`.
- Rode o SQL `004_diagnostic_runs.sql` no SQL Editor do Supabase para ativar.

### Trilha da aprovação (`006`)

- `approval_trails.plan` guarda o JSON completo do plano gerado pela IA (edital).
- `trail_week_lessons.lesson` guarda a aula modular do Professor IA por semana.
- `trail_week_progress` guarda módulos vistos, respostas da prática, chat e status da semana.
- Rode `006_approval_trail.sql` no SQL Editor do Supabase para ativar.

### Dados do aluno (`008`)

- Caderno de erros, simulados, revisões, sessões do plano, Quest e estado de questões sincronizam por `device_id` (`estufoo.device-id`).
- Escrita continua imediata no `localStorage`; o push para o Supabase é best-effort (não quebra o fluxo se o banco falhar).
- No carregamento, o app faz hydrate: se o local estiver vazio (ou simulados limpos com catálogo Supabase), restaura do banco.
- Rode `008_study_user_data.sql` no SQL Editor do Supabase para ativar.

### Video aulas (`009`)

- Preferência: **Bunny Storage + Pull Zone** (`BUNNY_STORAGE_*` + `BUNNY_CDN_BASE_URL`). O catálogo lista pastas/arquivos via API; o player usa a URL do CDN.
- Fallback local: `VIDEO_LESSONS_ROOT` + `/api/video-lessons/stream` (só na máquina do servidor).
- No Pull Zone da Bunny: habilite **CORS** para o domínio do app e suporte a **Range**.
- Progresso, anotações e quiz sincronizam por `device_id` (`009_video_lessons.sql`).

Com Supabase, o app limpa demo antiga do `estufoo.mockdb` (36 questões, plano, revisões, notificações fake).

As 10 questões do `db/seed.sql` no Supabase são conteúdo didático de exemplo — para zerar o catálogo, apague no SQL Editor (`DELETE FROM question_alternatives; DELETE FROM questions; …`).

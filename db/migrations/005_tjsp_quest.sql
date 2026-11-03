-- TJSP Quest — progresso gamificado (opcional / futuro sync Supabase)
-- Por enquanto o app persiste em localStorage (`aprovamind.tjsp-quest.v1`).
-- Rode esta migration quando quiser espelhar o progresso no Postgres.

create table if not exists public.quest_player_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  device_id text,
  xp integer not null default 0,
  level integer not null default 1,
  streak_days integer not null default 0,
  last_study_date date,
  daily_xp integer not null default 0,
  daily_xp_date date,
  phases jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint quest_player_owner check (user_id is not null or device_id is not null)
);

create unique index if not exists quest_player_progress_user_uidx
  on public.quest_player_progress (user_id)
  where user_id is not null;

create unique index if not exists quest_player_progress_device_uidx
  on public.quest_player_progress (device_id)
  where device_id is not null;

create table if not exists public.quest_attempts (
  id uuid primary key default gen_random_uuid(),
  progress_id uuid not null references public.quest_player_progress (id) on delete cascade,
  phase_id text not null,
  question_id text not null,
  mode text not null check (mode in ('desafio', 'chefao', 'revisao')),
  choice text not null,
  correct boolean not null,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quest_attempts_progress_idx
  on public.quest_attempts (progress_id, created_at desc);

create table if not exists public.quest_reviews (
  id uuid primary key default gen_random_uuid(),
  progress_id uuid not null references public.quest_player_progress (id) on delete cascade,
  phase_id text not null,
  subject_id text not null,
  question_id text not null,
  due_date date not null,
  interval_days integer not null,
  wrong_count integer not null default 1,
  unique (progress_id, question_id)
);

alter table public.quest_player_progress enable row level security;
alter table public.quest_attempts enable row level security;
alter table public.quest_reviews enable row level security;

-- Políticas: usuário autenticado só vê o próprio progresso.
-- (Ajuste device_id sync depois, se usar anon + device.)

drop policy if exists quest_progress_select_own on public.quest_player_progress;
create policy quest_progress_select_own on public.quest_player_progress
  for select using (auth.uid() = user_id);

drop policy if exists quest_progress_upsert_own on public.quest_player_progress;
create policy quest_progress_upsert_own on public.quest_player_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists quest_attempts_own on public.quest_attempts;
create policy quest_attempts_own on public.quest_attempts
  for all using (
    exists (
      select 1 from public.quest_player_progress p
      where p.id = progress_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quest_player_progress p
      where p.id = progress_id and p.user_id = auth.uid()
    )
  );

drop policy if exists quest_reviews_own on public.quest_reviews;
create policy quest_reviews_own on public.quest_reviews
  for all using (
    exists (
      select 1 from public.quest_player_progress p
      where p.id = progress_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quest_player_progress p
      where p.id = progress_id and p.user_id = auth.uid()
    )
  );

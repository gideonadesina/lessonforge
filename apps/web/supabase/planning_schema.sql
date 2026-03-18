-- Planning module schema for LessonForge
-- Includes:
--   - scheme_of_work
--   - academic_calendar
--   - indexes
--   - row level security policies

create extension if not exists pgcrypto;

create table if not exists public.scheme_of_work (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_name text not null,
  subject text not null,
  term text not null,
  week_number integer not null check (week_number > 0 and week_number <= 53),
  topic text not null,
  subtopic text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_scheme_of_work_user_id
  on public.scheme_of_work(user_id);

create index if not exists idx_scheme_of_work_user_week
  on public.scheme_of_work(user_id, week_number);

create index if not exists idx_scheme_of_work_user_filters
  on public.scheme_of_work(user_id, class_name, subject, term);

create table if not exists public.academic_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_type text not null
    check (event_type in ('resumption', 'holiday', 'assessment', 'exam', 'meeting', 'deadline', 'other')),
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_academic_calendar_user_id
  on public.academic_calendar(user_id);

create index if not exists idx_academic_calendar_user_event_date
  on public.academic_calendar(user_id, event_date);

alter table public.scheme_of_work enable row level security;
alter table public.academic_calendar enable row level security;

drop policy if exists "scheme_of_work_select_own" on public.scheme_of_work;
create policy "scheme_of_work_select_own"
  on public.scheme_of_work
  for select
  using (auth.uid() = user_id);

drop policy if exists "scheme_of_work_insert_own" on public.scheme_of_work;
create policy "scheme_of_work_insert_own"
  on public.scheme_of_work
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "scheme_of_work_update_own" on public.scheme_of_work;
create policy "scheme_of_work_update_own"
  on public.scheme_of_work
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "scheme_of_work_delete_own" on public.scheme_of_work;
create policy "scheme_of_work_delete_own"
  on public.scheme_of_work
  for delete
  using (auth.uid() = user_id);

drop policy if exists "academic_calendar_select_own" on public.academic_calendar;
create policy "academic_calendar_select_own"
  on public.academic_calendar
  for select
  using (auth.uid() = user_id);

drop policy if exists "academic_calendar_insert_own" on public.academic_calendar;
create policy "academic_calendar_insert_own"
  on public.academic_calendar
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "academic_calendar_update_own" on public.academic_calendar;
create policy "academic_calendar_update_own"
  on public.academic_calendar
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "academic_calendar_delete_own" on public.academic_calendar;
create policy "academic_calendar_delete_own"
  on public.academic_calendar
  for delete
  using (auth.uid() = user_id);

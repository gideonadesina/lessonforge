-- Dedicated Exam Builder storage (separate from worksheets).
-- Safe to run multiple times due to IF NOT EXISTS checks.

create extension if not exists pgcrypto;

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  subject text not null,
  topic_or_coverage text not null,
  class_or_grade text not null,
  school_level text not null,
  curriculum text not null,
  exam_alignment text not null,
  exam_type text not null,
  duration_mins integer not null check (duration_mins > 0),
  total_marks integer not null check (total_marks > 0),
  objective_question_count integer not null check (objective_question_count >= 0),
  theory_question_count integer not null check (theory_question_count >= 0),
  difficulty_level text not null,
  instructions text[] not null default '{}',
  special_notes text null,
  school_name text null,
  exam_title_override text null,

  exam_title text not null,
  result_json jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published')),

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists exams_user_id_created_at_idx
  on public.exams (user_id, created_at desc);

create index if not exists exams_result_json_gin_idx
  on public.exams using gin (result_json);

create or replace function public.set_exams_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_exams_updated_at on public.exams;
create trigger trg_set_exams_updated_at
before update on public.exams
for each row
execute function public.set_exams_updated_at();

alter table public.exams enable row level security;

drop policy if exists "users_can_select_own_exams" on public.exams;
create policy "users_can_select_own_exams"
on public.exams
for select
using (auth.uid() = user_id);

drop policy if exists "users_can_insert_own_exams" on public.exams;
create policy "users_can_insert_own_exams"
on public.exams
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_exams" on public.exams;
create policy "users_can_update_own_exams"
on public.exams
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_exams" on public.exams;
create policy "users_can_delete_own_exams"
on public.exams
for delete
using (auth.uid() = user_id);

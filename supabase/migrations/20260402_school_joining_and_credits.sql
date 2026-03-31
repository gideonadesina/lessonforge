-- Add shared credit and school joining support to schools and profiles
-- For school billing and teacher school membership

-- Add columns to schools table if they don't exist
alter table public.schools
add column if not exists shared_credits integer not null default 0,
add column if not exists teacher_limit integer not null default 15,
add column if not exists code text unique,
add column if not exists plan text default 'starter';

-- Create index for school code lookup (for join flow)
create index if not exists schools_code_idx on public.schools (code);

-- Add school_id to profiles table for teacher school membership tracking
alter table public.profiles
add column if not exists school_id uuid references public.schools(id) on delete set null;

-- Create index for teacher to school lookup
create index if not exists profiles_school_id_idx on public.profiles (school_id);

-- Create school_members table to track teacher membership
create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('principal', 'admin', 'owner', 'teacher')),
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  
  unique(school_id, user_id)
);

-- Index for finding school members
create index if not exists school_members_school_id_idx on public.school_members (school_id);
create index if not exists school_members_user_id_idx on public.school_members (user_id);

-- Automatic updated_at trigger for school_members
create or replace function public.set_school_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_school_members_updated_at on public.school_members;
create trigger trg_set_school_members_updated_at
before update on public.school_members
for each row
execute function public.set_school_members_updated_at();

-- RLS: Users can view their school memberships
alter table public.school_members enable row level security;

drop policy if exists "users_can_view_own_school_membership" on public.school_members;
create policy "users_can_view_own_school_membership"
on public.school_members
for select
using (auth.uid() = user_id or user_id in (
  select user_id from public.school_members 
  where school_id = school_members.school_id and role in ('principal', 'admin', 'owner')
  and user_id = auth.uid()
));

-- RLS: Principals can manage teachers in their school
drop policy if exists "principals_can_manage_school_members" on public.school_members;
create policy "principals_can_manage_school_members"
on public.school_members
for all
using (
  exists (
    select 1 from public.school_members sm
    where sm.school_id = school_members.school_id
      and sm.user_id = auth.uid()
      and sm.role in ('principal', 'admin', 'owner')
  )
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  teacher_name text not null,
  email text not null unique,
  first_email_sent_at timestamptz null,
  follow_up_sent boolean not null default false,
  follow_up_sent_at timestamptz null,
  replied boolean not null default false,
  opened boolean not null default false,
  opened_at timestamptz null,
  clicked boolean not null default false,
  clicked_at timestamptz null,
  first_resend_id text null,
  follow_up_resend_id text null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_logs_email_idx on public.email_logs (lower(email));
create index if not exists email_logs_first_email_sent_at_idx on public.email_logs (first_email_sent_at);
create index if not exists email_logs_follow_up_due_idx
  on public.email_logs (first_email_sent_at, follow_up_sent, replied);

alter table public.email_logs
  add column if not exists clicked boolean not null default false,
  add column if not exists clicked_at timestamptz null;

alter table public.email_logs enable row level security;

drop policy if exists "Service role manages email logs" on public.email_logs;
create policy "Service role manages email logs"
on public.email_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

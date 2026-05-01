create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Notification',
  message text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'success', 'reminder')),
  read boolean not null default false,
  created_at timestamptz not null default now(),

  -- Compatibility columns for the existing planning UI.
  notification_type text,
  sub_message text,
  action_label text,
  action_url text,
  timetable_slot_id uuid,
  dismissed_at timestamptz,
  read_at timestamptz,
  notification_date date not null default current_date
);

alter table public.notifications
  add column if not exists title text not null default 'Notification',
  add column if not exists type text not null default 'info',
  add column if not exists read boolean not null default false,
  add column if not exists notification_type text,
  add column if not exists sub_message text,
  add column if not exists action_label text,
  add column if not exists action_url text,
  add column if not exists timetable_slot_id uuid,
  add column if not exists dismissed_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists notification_date date not null default current_date;

alter table public.notifications
  alter column notification_date set default current_date;

update public.notifications
set notification_date = created_at::date
where notification_date is null;

alter table public.notifications
  alter column notification_date set not null;

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users insert own notifications" on public.notifications;
create policy "Users insert own notifications"
on public.notifications for insert
with check (auth.uid() = user_id);

alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when undefined_object then null;
end $$;

create table if not exists public.first_generation_email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid,
  email text not null,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id)
);

create index if not exists first_generation_email_logs_user_idx
  on public.first_generation_email_logs (user_id);

alter table public.first_generation_email_logs enable row level security;

drop policy if exists "Service role manages first generation email logs" on public.first_generation_email_logs;
create policy "Service role manages first generation email logs"
on public.first_generation_email_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

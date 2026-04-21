-- Planning and notifications foundation.
-- All date/time defaults use UTC.

create extension if not exists pgcrypto;

-- Shared trigger helper for updated_at.
create or replace function public.set_updated_at_utc()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Extend existing academic_calendar without recreating it.
alter table public.academic_calendar
  add column if not exists end_date date null,
  add column if not exists affected_classes text[] null,
  add column if not exists notification_sent boolean not null default false;

create table if not exists public.teacher_timetable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  academic_year text not null,
  weeks_in_term integer not null check (weeks_in_term > 0),
  teaching_days text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists teacher_timetable_user_term_year_uidx
  on public.teacher_timetable (user_id, term, academic_year);

create index if not exists teacher_timetable_user_id_idx
  on public.teacher_timetable (user_id);

drop trigger if exists trg_teacher_timetable_set_updated_at on public.teacher_timetable;
create trigger trg_teacher_timetable_set_updated_at
before update on public.teacher_timetable
for each row
execute function public.set_updated_at_utc();

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.teacher_timetable(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  class_name text not null,
  subject text not null,
  room text null,
  scheme_entry_id uuid null references public.scheme_of_work(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists timetable_slots_timetable_day_start_idx
  on public.timetable_slots (timetable_id, day_of_week, start_time);

create index if not exists timetable_slots_scheme_entry_id_idx
  on public.timetable_slots (scheme_entry_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('URGENT', 'PREP_WARNING', 'COMPLETED', 'INFO', 'NEUTRAL')),
  message text not null,
  sub_message text null,
  action_label text null,
  action_url text null,
  timetable_slot_id uuid null references public.timetable_slots(id) on delete set null,
  dismissed_at timestamptz null,
  read_at timestamptz null,
  notification_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint notifications_user_slot_type_date_unique
    unique (user_id, timetable_slot_id, notification_type, notification_date)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_active_idx
  on public.notifications (user_id, notification_date desc)
  where dismissed_at is null;

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where dismissed_at is null and read_at is null;

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_minutes integer not null check (reminder_minutes > 0),
  delivery_method text not null check (delivery_method in ('in_app', 'email', 'both')),
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_preferences_user_unique unique (user_id)
);

create index if not exists notification_preferences_user_id_idx
  on public.notification_preferences (user_id);

drop trigger if exists trg_notification_preferences_set_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at_utc();

create table if not exists public.lesson_pack_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timetable_slot_id uuid not null references public.timetable_slots(id) on delete cascade,
  scheme_entry_id uuid null references public.scheme_of_work(id) on delete set null,
  viewed_at timestamptz not null default timezone('utc', now()),
  view_date date not null,
  constraint lesson_pack_views_user_slot_date_unique
    unique (user_id, timetable_slot_id, view_date)
);

create index if not exists lesson_pack_views_user_date_idx
  on public.lesson_pack_views (user_id, view_date desc);

create index if not exists lesson_pack_views_slot_date_idx
  on public.lesson_pack_views (timetable_slot_id, view_date desc);

create table if not exists public.ai_tip_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  subject text not null,
  tip_text text not null,
  generated_for_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_tip_cache_user_topic_date_unique
    unique (user_id, topic, generated_for_date)
);

create index if not exists ai_tip_cache_user_date_idx
  on public.ai_tip_cache (user_id, generated_for_date desc);

-- RLS: teacher_timetable
alter table public.teacher_timetable enable row level security;

drop policy if exists "users_can_select_own_teacher_timetable" on public.teacher_timetable;
create policy "users_can_select_own_teacher_timetable"
on public.teacher_timetable
for select
using (auth.uid() = user_id);

drop policy if exists "users_can_insert_own_teacher_timetable" on public.teacher_timetable;
create policy "users_can_insert_own_teacher_timetable"
on public.teacher_timetable
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_teacher_timetable" on public.teacher_timetable;
create policy "users_can_update_own_teacher_timetable"
on public.teacher_timetable
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_teacher_timetable" on public.teacher_timetable;
create policy "users_can_delete_own_teacher_timetable"
on public.teacher_timetable
for delete
using (auth.uid() = user_id);

-- RLS: timetable_slots
alter table public.timetable_slots enable row level security;

drop policy if exists "users_can_select_own_timetable_slots" on public.timetable_slots;
create policy "users_can_select_own_timetable_slots"
on public.timetable_slots
for select
using (
  exists (
    select 1
    from public.teacher_timetable tt
    where tt.id = timetable_slots.timetable_id
      and tt.user_id = auth.uid()
  )
);

drop policy if exists "users_can_insert_own_timetable_slots" on public.timetable_slots;
create policy "users_can_insert_own_timetable_slots"
on public.timetable_slots
for insert
with check (
  exists (
    select 1
    from public.teacher_timetable tt
    where tt.id = timetable_slots.timetable_id
      and tt.user_id = auth.uid()
  )
);

drop policy if exists "users_can_update_own_timetable_slots" on public.timetable_slots;
create policy "users_can_update_own_timetable_slots"
on public.timetable_slots
for update
using (
  exists (
    select 1
    from public.teacher_timetable tt
    where tt.id = timetable_slots.timetable_id
      and tt.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.teacher_timetable tt
    where tt.id = timetable_slots.timetable_id
      and tt.user_id = auth.uid()
  )
);

drop policy if exists "users_can_delete_own_timetable_slots" on public.timetable_slots;
create policy "users_can_delete_own_timetable_slots"
on public.timetable_slots
for delete
using (
  exists (
    select 1
    from public.teacher_timetable tt
    where tt.id = timetable_slots.timetable_id
      and tt.user_id = auth.uid()
  )
);

-- RLS: notifications
alter table public.notifications enable row level security;

drop policy if exists "users_can_select_own_notifications" on public.notifications;
create policy "users_can_select_own_notifications"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "users_can_insert_own_notifications" on public.notifications;
create policy "users_can_insert_own_notifications"
on public.notifications
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_notifications" on public.notifications;
create policy "users_can_update_own_notifications"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_notifications" on public.notifications;
create policy "users_can_delete_own_notifications"
on public.notifications
for delete
using (auth.uid() = user_id);

-- RLS: notification_preferences
alter table public.notification_preferences enable row level security;

drop policy if exists "users_can_select_own_notification_preferences" on public.notification_preferences;
create policy "users_can_select_own_notification_preferences"
on public.notification_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "users_can_insert_own_notification_preferences" on public.notification_preferences;
create policy "users_can_insert_own_notification_preferences"
on public.notification_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_notification_preferences" on public.notification_preferences;
create policy "users_can_update_own_notification_preferences"
on public.notification_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_notification_preferences" on public.notification_preferences;
create policy "users_can_delete_own_notification_preferences"
on public.notification_preferences
for delete
using (auth.uid() = user_id);

-- RLS: lesson_pack_views
alter table public.lesson_pack_views enable row level security;

drop policy if exists "users_can_select_own_lesson_pack_views" on public.lesson_pack_views;
create policy "users_can_select_own_lesson_pack_views"
on public.lesson_pack_views
for select
using (auth.uid() = user_id);

drop policy if exists "users_can_insert_own_lesson_pack_views" on public.lesson_pack_views;
create policy "users_can_insert_own_lesson_pack_views"
on public.lesson_pack_views
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_lesson_pack_views" on public.lesson_pack_views;
create policy "users_can_update_own_lesson_pack_views"
on public.lesson_pack_views
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_lesson_pack_views" on public.lesson_pack_views;
create policy "users_can_delete_own_lesson_pack_views"
on public.lesson_pack_views
for delete
using (auth.uid() = user_id);

-- RLS: ai_tip_cache
alter table public.ai_tip_cache enable row level security;

drop policy if exists "users_can_select_own_ai_tip_cache" on public.ai_tip_cache;
create policy "users_can_select_own_ai_tip_cache"
on public.ai_tip_cache
for select
using (auth.uid() = user_id);

drop policy if exists "users_can_insert_own_ai_tip_cache" on public.ai_tip_cache;
create policy "users_can_insert_own_ai_tip_cache"
on public.ai_tip_cache
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_can_update_own_ai_tip_cache" on public.ai_tip_cache;
create policy "users_can_update_own_ai_tip_cache"
on public.ai_tip_cache
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_can_delete_own_ai_tip_cache" on public.ai_tip_cache;
create policy "users_can_delete_own_ai_tip_cache"
on public.ai_tip_cache
for delete
using (auth.uid() = user_id);

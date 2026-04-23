-- Auth onboarding flow flags + answer storage for personalised setup.
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists welcome_seen boolean not null default false,
  add column if not exists onboarding_answers jsonb;

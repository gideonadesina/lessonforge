-- Ensure new users receive 8 free credits on account/profile creation.
-- This changes the database default values for onboarding credits only.

alter table public.profiles
  alter column free_credits set default 8,
  alter column credits_balance set default 8;

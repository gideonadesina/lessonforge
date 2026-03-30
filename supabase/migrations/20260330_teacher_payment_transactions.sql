-- Teacher payment tracking table for idempotency and audit trail.
-- Prevents double-crediting and allows reconciliation.

create table if not exists public.teacher_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  
  -- Payment reference from Paystack
  reference text not null unique,
  
  -- User who made the payment
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Payment details
  provider text not null default 'paystack',
  flow text,
  plan text not null, -- 'basic', 'pro', 'pro_plus', 'ultra_pro'
  amount integer, -- In minor units (kobo for NGN, cents for USD)
  currency text, -- 'NGN' or 'USD'
  
  -- Idempotency flags
  status text not null default 'success' check (status in ('success', 'failed', 'cancelled')),
  processed boolean not null default false,
  processed_at timestamptz,
  
  -- Paystack metadata
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email text,
  
  -- Credit grant details
  credits_awarded integer not null default 0,
  credits_awarded_at timestamptz,
  
  -- Raw payload storage for debugging
  provider_payload jsonb,
  result_snapshot jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Index for efficient lookups by reference
create index if not exists teacher_payment_transactions_reference_idx
  on public.teacher_payment_transactions (reference);

-- Index for finding pending payments
create index if not exists teacher_payment_transactions_user_processed_idx
  on public.teacher_payment_transactions (user_id, processed);

-- Index for finding recent payments
create index if not exists teacher_payment_transactions_user_created_idx
  on public.teacher_payment_transactions (user_id, created_at desc);

-- Automatic updated_at trigger
create or replace function public.set_teacher_payment_transactions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_set_teacher_payment_transactions_updated_at on public.teacher_payment_transactions;
create trigger trg_set_teacher_payment_transactions_updated_at
before update on public.teacher_payment_transactions
for each row
execute function public.set_teacher_payment_transactions_updated_at();

-- RLS: Users can view their own transactions
alter table public.teacher_payment_transactions enable row level security;

drop policy if exists "users_can_view_own_payment_transactions" on public.teacher_payment_transactions;
create policy "users_can_view_own_payment_transactions"
on public.teacher_payment_transactions
for select
using (auth.uid() = user_id);

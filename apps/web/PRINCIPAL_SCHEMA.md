# Principal / School Admin data model (Supabase-ready)

This project now supports a principal workspace with per-teacher subscriptions.

## 1) `schools`

Core school workspace metadata.

```sql
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  principal_name text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  code text null, -- legacy compatibility mirror of active school code
  created_at timestamptz not null default now()
);
```

## 2) `school_members` (teachers + principal linkage)

Teachers and principal are linked to `schools.id` via membership.

```sql
create table if not exists public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'teacher', -- principal | admin | teacher | disabled_teacher | removed_teacher
  status text null default 'active',    -- active | pending | disabled | removed
  last_active_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);
```

## 3) `teacher_slots`

Defines paid teacher seat capacity per school.

```sql
create table if not exists public.teacher_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  slot_limit int not null check (slot_limit > 0),
  slot_price numeric(12,2) not null default 3500,
  currency text not null default 'NGN',
  status text not null default 'active',
  created_at timestamptz not null default now()
);
```

## 4) `school_codes`

Invite/join codes for teacher onboarding.

```sql
create table if not exists public.school_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  is_active boolean not null default true,
  generated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
```

## 5) `subscriptions`

Billing records and payment state (placeholder-compatible, provider-ready).

```sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  status text not null default 'pending', -- paid | pending | failed | refunded | active | trialing
  provider text not null default 'placeholder', -- placeholder | paystack | stripe
  reference text null,
  teacher_slots int null,
  billing_cycle text not null default 'monthly',
  paid_at timestamptz null,
  created_at timestamptz not null default now()
);
```

---

## Join flow rule (teacher invite system)

When a teacher submits a school code:

1. Validate code from `school_codes` (active only), fallback to `schools.code`.
2. Resolve seat limit from `teacher_slots.slot_limit` (latest row), fallback to legacy seat fields.
3. Count current non-principal members in `school_members`.
4. If `used >= slot_limit`, block with `"no available teacher slots"`.
5. Else insert membership as teacher.

---

## Notes

- The app APIs are written to be backward-compatible with existing `schools` / `school_members` usage.
- Placeholder payment is implemented now; real gateway integration can replace the payment step without changing dashboard or slot logic.

-- Prepaid/manual credit model:
-- consume_generation_credit must only use profiles.credits_balance.
-- No monthly resets and no dependence on free_credits / is_pro / allowance fields.
create or replace function public.consume_generation_credit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_balance integer;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select credits_balance
  into current_balance
  from public.profiles
  where id = uid;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile missing');
  end if;

  current_balance := coalesce(current_balance, 0);
  if current_balance <= 0 then
    return jsonb_build_object('ok', false, 'error', 'No credits');
  end if;

  update public.profiles
  set
    credits_balance = current_balance - 1,
    updated_at = now()
  where id = uid
    and credits_balance = current_balance;

  if found then
    return jsonb_build_object(
      'ok', true,
      'before_balance', current_balance,
      'after_balance', current_balance - 1
    );
  end if;

  return jsonb_build_object('ok', false, 'error', 'Credit balance changed. Please retry.');
end;
$$;

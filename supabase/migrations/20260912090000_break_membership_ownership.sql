-- 故意弄坏：拿掉 collect_membership_fee 的 sees_money 检查，
-- 看 check:memberships 第⑦段真的红——别人家不该收得到我的会员费。
-- 单独推、单独跑，看过它红，再改回去。
create or replace function public.collect_membership_fee(
  in_membership_id uuid,
  in_idempotency_key uuid default null
)
returns membership_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.memberships;
  party public.directory_entries;
  existing public.membership_payments;
  entry public.ledger_entries;
  row public.membership_payments;
begin
  select * into m from public.memberships
   where id = in_membership_id; /* 🔴 弄坏的地方：拿掉 and public.sees_money(project_id) */
  if not found then
    raise exception 'no such membership in your business';
  end if;
  if m.archived_at is not null then
    raise exception 'that membership was cancelled';
  end if;

  if in_idempotency_key is not null then
    select * into existing from public.membership_payments
     where membership_id = in_membership_id and idempotency_key = in_idempotency_key;
    if found then
      return existing;
    end if;
  end if;

  select * into party from public.directory_entries where id = m.party_id;

  entry := public.add_ledger_entry(
    in_project_id := m.project_id,
    in_module_key := 'payments',
    in_direction := 'in',
    in_amount_cents := m.monthly_fee_cents,
    in_party := coalesce(party.name, ''),
    in_party_id := m.party_id,
    in_category := 'membership',
    in_note := coalesce(nullif(btrim(m.plan_name), ''), 'Membership')
  );

  insert into public.membership_payments (
    membership_id, project_id, amount_cents, paid_on,
    ledger_entry_id, idempotency_key, created_by
  ) values (
    in_membership_id, m.project_id, m.monthly_fee_cents, public.today_myt(),
    entry.id, in_idempotency_key, auth.uid()
  )
  returning * into row;

  update public.memberships
     set next_due_on = (m.next_due_on + interval '1 month')::date
   where id = in_membership_id;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.membership_payments
       where membership_id = in_membership_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

-- 故意弄坏：拿掉幂等短路那一段，看 check:memberships 第④段真的红——
-- 同一把钥匙按两次应该收回同一笔，不是收两次、日期也跟着推两次。
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
  entry public.ledger_entries;
  row public.membership_payments;
begin
  select * into m from public.memberships
   where id = in_membership_id and public.sees_money(project_id);
  if not found then
    raise exception 'no such membership in your business';
  end if;
  if m.archived_at is not null then
    raise exception 'that membership was cancelled';
  end if;

  /* 🔴 弄坏的地方：幂等短路整段拿掉了。 */

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
end;
$$;

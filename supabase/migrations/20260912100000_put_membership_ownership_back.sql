-- 改回来：20260912090000 弄坏的那一行撤销掉，恢复 20260912060000 的版本。
--
-- ⚠️ 诚实记录：这一次没有看过它真的红——`collect_membership_fee` 拿掉
-- `sees_money` 之后，`check:memberships` 第⑦段照样全绿。查出来的原因：
-- 它内部呼叫的 `add_ledger_entry` 自己有更严的检查
-- （`account_id = auth.uid()`——只有帐号本人，连同一家的员工都不算），
-- 这一支不管有没有自己的 `sees_money`，别人家、甚至同一家的员工，
-- 到了 `add_ledger_entry` 那一步都会被挡下来。
--
-- 这一行还是留着，理由是[重点 26] 的两层防线原则：**这一支不该靠
-- 「我知道 add_ledger_entry 现在很严」才安全**——那支哪天放宽
-- （比如老板讲了规矩之后员工也能收钱，跟储值卡 grant_credit 那次
-- 一样的放宽），这一支自己的 `sees_money` 才是真正挡住的那一道。
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
   where id = in_membership_id and public.sees_money(project_id);
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

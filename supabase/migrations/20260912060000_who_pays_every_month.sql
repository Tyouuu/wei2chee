-- 会员月费——沙龙其余那一组最后一件，[任务 396] 重新判过：地基可以先
-- 搭一半。真正要等的只有「自动扣款」那一半（要串收款闸道，闸道本身
-- 还没有），先记事实、算法晚一点——跟储值卡（20260909360000）同一条
-- 纪律。柜台每个月手动收一次、按一下「收了」，下一次该缴的日期自己
-- 往后推一个月。
--
-- 🔴 钱只有老板一个人碰——跟这个仓库今晚查到的那一条一致
-- （`add_ledger_entry` 本身只认 `account_id = auth.uid()`，员工帐号
-- 今天摸不到任何一笔收付）。这两支写钱的都是 `sees_money`，不是
-- `works_here`。

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  party_id uuid not null references public.directory_entries(id) on delete cascade,
  plan_name text not null default '',
  monthly_fee_cents bigint not null,
  started_on date not null default public.today_myt(),
  next_due_on date not null,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.memberships is
  'One customer on one recurring plan. next_due_on is a fact the owner advances by hand each time he collects -- there is no automatic billing yet (needs a payment gateway this project does not have). See 20260912060000.';

create index if not exists memberships_project_idx
  on public.memberships (project_id, next_due_on);

alter table public.memberships enable row level security;

create policy "memberships are read by money-seers" on public.memberships
  for select using (public.sees_money(project_id));

-- 🔴 没有 insert/update/delete 的 policy——只有底下这几支写得进去。

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  amount_cents bigint not null,
  paid_on date not null default public.today_myt(),
  ledger_entry_id uuid references public.ledger_entries(id) on delete set null,
  idempotency_key uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.membership_payments is
  'Append-only. One row per time a membership fee was actually collected -- the ledger_entries row is the money, this row is what it was for and which period it advanced. See 20260912060000.';

create unique index if not exists membership_payments_idem_idx
  on public.membership_payments (membership_id, idempotency_key)
  where idempotency_key is not null;

alter table public.membership_payments enable row level security;

create policy "membership payments are read by money-seers" on public.membership_payments
  for select using (public.sees_money(project_id));

create or replace function public.add_membership(
  in_project_id uuid,
  in_party_id uuid,
  in_plan_name text,
  in_monthly_fee_cents bigint,
  in_started_on date default null
)
returns memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.memberships;
  starts date;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'setting up a membership is for the owner';
  end if;
  perform 1 from public.directory_entries
    where id = in_party_id and project_id = in_project_id;
  if not found then
    raise exception 'that person is not in this project';
  end if;
  if coalesce(btrim(in_plan_name), '') = '' then
    raise exception 'say what the plan is called';
  end if;
  if in_monthly_fee_cents is null or in_monthly_fee_cents <= 0 then
    raise exception 'say how much the plan costs a month';
  end if;

  starts := coalesce(in_started_on, public.today_myt());

  insert into public.memberships (
    project_id, party_id, plan_name, monthly_fee_cents,
    started_on, next_due_on, created_by
  ) values (
    in_project_id, in_party_id, left(btrim(in_plan_name), 120), in_monthly_fee_cents,
    starts, starts, auth.uid()
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.add_membership(uuid, uuid, text, bigint, date) from public;
grant execute on function public.add_membership(uuid, uuid, text, bigint, date) to authenticated;

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

  /* 🔴 从「本来该缴的那天」往后推一个月，不是从「今天」——
     晚缴不会把下一期也跟着往后拖，跟这个仓库其他到期日算法一致。 */
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

revoke execute on function public.collect_membership_fee(uuid, uuid) from public;
grant execute on function public.collect_membership_fee(uuid, uuid) to authenticated;

create or replace function public.set_membership_archived(
  in_id uuid,
  in_archived boolean
)
returns memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.memberships;
begin
  select * into row from public.memberships
   where id = in_id and public.sees_money(project_id);
  if not found then
    raise exception 'no such membership in your business';
  end if;

  update public.memberships
     set archived_at = case when in_archived then now() else null end
   where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.set_membership_archived(uuid, boolean) from public;
grant execute on function public.set_membership_archived(uuid, boolean) to authenticated;

create or replace function public.memberships_of(in_project_id uuid)
returns table (
  id uuid, party_id uuid, name text, plan_name text,
  monthly_fee_cents bigint, next_due_on date, overdue boolean, archived_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.party_id, d.name, m.plan_name, m.monthly_fee_cents,
         m.next_due_on, m.next_due_on < public.today_myt(), m.archived_at
  from public.memberships m
  join public.directory_entries d on d.id = m.party_id
  where m.project_id = in_project_id
    and public.sees_money(in_project_id)
  order by m.archived_at nulls first, m.next_due_on asc;
$$;

revoke execute on function public.memberships_of(uuid) from public;
grant execute on function public.memberships_of(uuid) to authenticated;

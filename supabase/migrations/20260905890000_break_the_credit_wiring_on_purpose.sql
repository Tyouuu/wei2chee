-- 故意弄坏，看它红，然后改回去（20260905900000）。
-- 两支都留在历史里，因为它们就是那份证据 —— 一条没有人看过它红的守卫，
-- 等於没有守卫（重点 24）。
--
-- 拿掉的就是 20260905870000 加进去的那一段：`party_debts` 不再扣掉退过的。
-- 画面上会变成：一个把货拿回来的客人，在「谁欠我钱」那一页上还欠全额。
--
-- ⚠️ **单独推一次** —— 弄坏跟改回去在同一次推送里，红的那一刻没有人看得到
-- （20260905070000 踩过一次）。
create or replace function public.party_debts(in_project_id uuid)
returns table (
  party_id uuid,
  owed_cents bigint,
  oldest_days integer,
  limit_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select r.id, r.party_id, r.amount_cents, coalesce(r.due_on, r.issued_on) as since
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.party_id is not null
      and r.archived_at is null
      and coalesce(r.amount_cents, 0) > 0
      and r.module_key <> 'purchases'
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),
  outstanding as (
    select l.party_id,
           greatest(l.amount_cents - coalesce(p.taken, 0), 0) as still_owed,
           l.since
    from live l
    left join paid p on p.record_id = l.id
  )
  select o.party_id,
         sum(o.still_owed)::bigint as owed_cents,
         max(
           case when o.still_owed > 0 and o.since is not null
                then (public.today_myt() - o.since)
                else null end
         )::integer as oldest_days,
         max(d.credit_limit_cents)::bigint as limit_cents
  from outstanding o
  join public.directory_entries d on d.id = o.party_id
  where public.sees_money(in_project_id)
  group by o.party_id
  having sum(o.still_owed) > 0;
$$;

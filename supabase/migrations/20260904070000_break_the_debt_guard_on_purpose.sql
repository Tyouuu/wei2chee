-- 🔴 故意弄坏，看那条守卫红。跑完立刻用 20260904080000 修回去。
--
-- [重点 24]：**一条没有人看过它红的守卫，等於没有守卫。**
-- 而这一条守的是钱 —— 「哪一个客户欠我多少」不可以被师傅问到。
--
-- 这里把 `party_debts` 的判断从 `sees_money` 改回 `works_here`
-- （那正是我第一版写的），然后 `npm run check:staff` 应该报：
--
--     FAIL  师傅问不到「谁欠多少」 — 拿回 1 行
--
-- ⚠️ 这一支**留在版本记录里**，不是清掉：一个「我验过了」的宣称，
-- 跟一支跑得出来的证据，差别就在这里。跟 20260901090000 那支
-- leak_probe 同一个做法。

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
      /* 买的那一边不算他欠我 —— 进货单是我欠人家。 */
      and r.module_key <> 'purchases'
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      /* 冲正过的、跟自己是冲正的，都不算收到。
         同一条规矩写在 lib/portal/allocations.ts 的 countsAsReceived。 */
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
         /* 最老的那一笔**还没收齐的**单，欠了几天。收齐的不算 ——
            一张三年前收齐的单不该让这个客户看起来欠了三年。 */
         max(
           case when o.still_owed > 0 and o.since is not null
                then (public.today_myt() - o.since)
                else null end
         )::integer as oldest_days,
         max(d.credit_limit_cents)::bigint as limit_cents
  from outstanding o
  join public.directory_entries d on d.id = o.party_id
  /* 🔴 `sees_money`，不是 `works_here`。
     这一支是 security definer，所以它绕过 RLS —— 而它 join 的
     `ledger_allocations` 是老板一个人的。写成 works_here 的话，
     一个师傅打这一支就学得到每一个客户欠多少。
     第一版我就是写 works_here，推上去之前才看到。 */
  where public.works_here(in_project_id)
  group by o.party_id
  having sum(o.still_owed) > 0;
$$;

revoke execute on function public.party_debts(uuid) from public, anon;
grant execute on function public.party_debts(uuid) to authenticated;

comment on function public.party_debts(uuid) is
  'Per party: what is still owed, how old the oldest unsettled document is, and the credit limit. Ageing is computed here rather than stored because it changes every night. See 20260904060000.';

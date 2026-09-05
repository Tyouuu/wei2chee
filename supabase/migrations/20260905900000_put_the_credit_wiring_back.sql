-- 把 20260905890000 弄坏的那一段接回去。
--
-- 弄坏那一次两条红，而第二条才是重点：
--   FAIL  🔴 谁欠我钱：八千变六千五 — 800000
--   FAIL  🔴 月结那张纸的期末，跟「谁欠我钱」一模一样 — 纸上 650000 · 那一页 800000
--
-- **同一个问题，两个答案。** 而拿死数字比的那一条当时是绿的 ——
-- 所以那一条也跟着改成两个互相比（scripts/check-returns.mjs ⑩）。
--
-- ⚠️ 从 20260905870000 原样搬回来，不是照记忆重打。

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
  credited as (
    select t.record_id, sum(t.credit_cents) as given
    from public.returns t
    where t.project_id = in_project_id
    group by t.record_id
  ),
  outstanding as (
    select l.party_id,
           /* 🔴 退过的那一部分他不欠了。少了这一句，一个把货拿回来的客人
              在这一页上还欠全额 —— 而那是系统在说谎，不是少一个功能。 */
           greatest(l.amount_cents - coalesce(c.given, 0) - coalesce(p.taken, 0), 0) as still_owed,
           l.since
    from live l
    left join paid p on p.record_id = l.id
    left join credited c on c.record_id = l.id
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
  where public.sees_money(in_project_id)
  group by o.party_id
  having sum(o.still_owed) > 0;
$$;

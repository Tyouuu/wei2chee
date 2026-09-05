-- 我欠这一家多少，欠了多久。
--
-- [任务 81] 2026-08-31 就记着供应商那一页的「未付」是空白的，
-- [任务 85] 又记一次，[任务 208] 做退货的时候第三次撞到 --
-- 退给供应商做不了，因为**钱那一半没有地方落**。这一支就是那个地方。
--
-- 🔴 而它是 `party_debts` 的镜像，不是它的复制品。三处故意不一样，
-- 每一处后面都有一个理由:
--
-- 1. **没有信用额度那一栏。** 那是我们给客人的额度，不是供应商给我们的。
--    供应商的帐期今天没有地方存 -- 讲出来，不要发明一栏。
--
-- 2. **算日子用 `issued_on`，不用 `due_on`。**
--    卖的那一边 `due_on` 是「几时要付」；**进货单的 `due_on` 是「预计到货」**
--    (20260903010000 白纸黑字)。拿它当帐龄的起点，算出来是
--    「这一批货晚到了几天」，不是「这笔钱欠了几天」-- 一个看起来完全
--    正常的错的数字。
--
-- 3. **分摊那一边有方向。** `party_debts` 那三支没有过滤方向
--    (它们靠 `module_key <> 'purchases'` 挡着)，而买的这一边从第一天
--    就写清楚: 只有**出去的钱**才算付过供应商。
--
-- ⚠️ 它还答不了的两件，自己讲:
-- -- **退给供应商还没做**，所以退回去的货今天不会让这个数字变小。
--    做那一件的时候要回来加一段 `credited`，跟 20260905870000
--    对客户那一边做的一模一样。
-- -- **没有帐龄分段**(本期/30/60/90)。卖的那一边有 `party_aging`，
--    是因为 SQL Account 拿它当卖点；买的这一边他真正在问的是
--    「这个月要付哪几家」-- 一份清单加一个天数就答得了。
--    真的要分段，再加一支。

create or replace function public.party_payables(in_project_id uuid)
returns table (
  party_id uuid,
  ordered_cents bigint,
  paid_cents bigint,
  owed_cents bigint,
  open_docs integer,
  oldest_days integer
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select r.id, r.party_id, coalesce(r.amount_cents, 0) as worth, r.issued_on as since
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.module_key = 'purchases'
      and r.party_id is not null
      and r.archived_at is null
      and coalesce(r.amount_cents, 0) > 0
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      /* 🔴 只有出去的钱算付过供应商。 */
      and e.direction = 'out'
      /* 冲正过的、跟自己是冲正的，都不算付出去。
         同一条规矩写在 lib/portal/allocations.ts 的 countsAsReceived。 */
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),
  outstanding as (
    select l.party_id,
           l.worth,
           coalesce(p.taken, 0) as taken,
           greatest(l.worth - coalesce(p.taken, 0), 0) as still_owed,
           l.since
    from live l
    left join paid p on p.record_id = l.id
  )
  select o.party_id,
         sum(o.worth)::bigint,
         sum(o.taken)::bigint,
         sum(o.still_owed)::bigint,
         count(*) filter (where o.still_owed > 0)::integer,
         /* 最老的那一张**还没付清**的单，几天。付清的不算 --
            一张三年前付清的单不该让这一家看起来欠了三年。 */
         max(
           case when o.still_owed > 0 and o.since is not null
                then (public.today_myt() - o.since)
                else null end
         )::integer
  from outstanding o
  join public.directory_entries d on d.id = o.party_id
  /* 🔴 `sees_money`，不是 `works_here` -- 跟 `party_debts` 同一条:
     这一支是 security definer，所以它绕过 RLS，而「我欠人家多少」
     是老板一个人的事。 */
  where public.sees_money(in_project_id)
  group by o.party_id
  having sum(o.still_owed) > 0;
$$;

grant execute on function public.party_payables(uuid) to authenticated;

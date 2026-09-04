-- 🔴 `financial_position` 只把**开帐现金**算进去，另外四个开帐数字掉了。
--
-- `check:accounts` 第一次跑就红：他开帐的时候讲「我还欠供应商五千」，
-- 而这一天的位置写着「我还欠人家 RM 4,000」（只有那一张进货单）——
-- **那五千从他打进去那一刻就没有人读过。**
--
-- 而它的形状是这个仓库最常犯的那一个：**一栏写得进去，没有人读它**。
-- 20260905570000 自己只写了现金那一行的 `coalesce((select ... 'cash'))`，
-- 其余三个（客人还欠我 · 我还欠人家 · 客人先付的钱）根本没有那一句。
--
-- ⚠️ 试算表那一支**没有这个洞** —— 它读的是 `opening_balances` 全部五个。
-- 所以两份报告会互相打架：试算表说欠五千，位置说没有。
-- **同一件事两个答案，正是这一整支存在要挡的那件事。**

create or replace function public.financial_position(
  in_project_id uuid,
  in_as_of date default null
)
returns table (
  as_of date,
  cash_cents bigint,
  receivable_cents bigint,
  payable_cents bigint,
  deposits_cents bigint,
  inventory_cents bigint,
  inventory_known boolean,
  items_without_cost integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d date;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  d := coalesce(in_as_of, public.today_myt());

  return query
  with live as (
    select e.*
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.entry_on <= d
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
  ),
  /* 🔴 五个开帐数字一次读齐 —— 一个一个手写 coalesce 就是漏掉四个的方法。 */
  op as (
    select o.code, o.amount_cents
    from public.opening_balances o
    where o.project_id = in_project_id and o.as_on <= d
  ),
  opened as (
    select
      coalesce((select o.amount_cents from op o where o.code = 'cash'), 0)::bigint       as cash,
      coalesce((select o.amount_cents from op o where o.code = 'receivable'), 0)::bigint as receivable,
      coalesce((select o.amount_cents from op o where o.code = 'payable'), 0)::bigint    as payable,
      coalesce((select o.amount_cents from op o where o.code = 'deposits'), 0)::bigint   as deposits,
      coalesce((select o.amount_cents from op o where o.code = 'inventory'), 0)::bigint  as inventory
  ),
  cash as (
    select (select x.cash from opened x)
           + coalesce(sum(case when l.direction = 'in' then l.amount_cents else -l.amount_cents end), 0)
           as c
    from live l
  ),
  held as (
    select (select x.deposits from opened x)
           + coalesce(sum(greatest(l.amount_cents - l.allocated_cents, 0)), 0) as h
    from live l where l.direction = 'in'
  ),
  owed as (
    select (select x.receivable from opened x)
           + coalesce(sum(pd.owed_cents), 0) as r
    from public.party_debts(in_project_id) pd
  ),
  bills as (
    select (select x.payable from opened x)
           + coalesce(sum(greatest(
             coalesce(p.amount_cents, 0) - coalesce((
               select sum(a.amount_cents) from public.ledger_allocations a
               join public.ledger_entries e2 on e2.id = a.entry_id
               where a.record_id = p.id and e2.direction = 'out'
                 and e2.adjusts_id is null
                 and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e2.id)
             ), 0), 0)), 0) as p
    from public.pipeline_records p
    where p.project_id = in_project_id
      and p.module_key = 'purchases'
      and p.archived_at is null
      and coalesce(p.issued_on, p.created_at::date) <= d
  ),
  /* 🔴 存货只有在**每一件有货的东西都有成本**的时候才算得出来。
     ⚠️ 开帐的存货**故意不加进来**：那一格讲的是「开帐那天架上值多少」，
     而架上现在值多少是从流水算出来的 —— 两个加起来会把同一批货算两次。
     开帐存货只服务试算表（那是开帐那一天的一张快照）。 */
  stock as (
    select
      coalesce(sum(case when i.cost_cents is not null
                        then s.on_hand * i.cost_cents else 0 end), 0)::bigint as v,
      count(*) filter (where i.cost_cents is null and s.on_hand > 0)::integer as missing
    from public.stock_on_hand s
    join public.catalog_items i on i.id = s.item_id
    where s.project_id = in_project_id
  )
  select d,
         (select c.c from cash c)::bigint,
         (select o.r from owed o)::bigint,
         (select b.p from bills b)::bigint,
         (select h.h from held h)::bigint,
         (select st.v from stock st),
         (select st.missing from stock st) = 0,
         (select st.missing from stock st);
end;
$fn$;

revoke execute on function public.financial_position(uuid, date) from public, anon;
grant execute on function public.financial_position(uuid, date) to authenticated;

comment on function public.financial_position(uuid, date) is
  'Where the business stands on one day, opening figures included -- all five read at once rather than one hand-written coalesce per line, which is how four of them went missing on the first cut. Opening stock is deliberately excluded here because the shelf value is computed from moves and adding both counts the same goods twice. See 20260905580000.';

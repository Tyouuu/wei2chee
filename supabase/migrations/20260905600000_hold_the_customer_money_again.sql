-- 把「客人先付的钱」换回来。20260905590000 故意让它漏掉还没分摊的那一部分，
-- 而那三条红讲的就是这一整支的命：
--
--   FAIL  🔴 而它还是平的 — **3000000 vs 2800000**
--
-- 🔴 差的正好是那两千 —— 客人先付、还没做的那一笔钱。
-- 一份不平的试算表跟一份平的，在画面上长得一模一样。
--
-- 内容跟 20260905570000 那一支一模一样。

create or replace function public.trial_balance(
  in_project_id uuid,
  in_from date default null,
  in_to date default null
)
returns table (
  code text,
  name text,
  kind text,
  debit_cents bigint,
  credit_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d_from date;
  d_to date;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;

  d_from := coalesce(in_from, date '1900-01-01');
  d_to := coalesce(in_to, public.today_myt());

  return query
  with acc as (
    select a.code, a.name, a.kind, a.sort_order
    from public.ledger_accounts a where a.project_id = in_project_id
  ),
  /* 冲正过的、自己是冲正的，两边都不算 —— 一笔冲正的方向跟原本那笔相反，
     所以一支只会 sum 的试算表，会把「那笔钱其实没收到」算成一笔费用。
     lib/portal/allocations.ts 的 countsAsReceived 写的是同一条。 */
  live as (
    select e.*
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.entry_on between d_from and d_to
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
  ),
  moved as (
    select
      coalesce(sum(case when l.direction = 'in' then l.amount_cents else 0 end), 0)::bigint as cash_in,
      coalesce(sum(case when l.direction = 'out' then l.amount_cents else 0 end), 0)::bigint as cash_out,
      /* 分摊出去的那一部分才是收入；剩下的还是客人的钱。 */
      coalesce(sum(case when l.direction = 'in' then least(l.allocated_cents, l.amount_cents) else 0 end), 0)::bigint as earned,
      coalesce(sum(case when l.direction = 'in'
                        then greatest(l.amount_cents - l.allocated_cents, 0) else 0 end), 0)::bigint as held
    from live l
  ),
  /* 开帐只在它那一天落在期间内才算进来。 */
  op as (
    select o.code, o.amount_cents
    from public.opening_balances o
    where o.project_id = in_project_id and o.as_on between d_from and d_to
  ),
  op_total as (
    select
      coalesce(sum(case when o.code in ('cash', 'receivable', 'inventory') then o.amount_cents else 0 end), 0)::bigint as assets,
      coalesce(sum(case when o.code in ('payable', 'deposits') then o.amount_cents else 0 end), 0)::bigint as liabs
    from op o
  ),
  rows as (
    select 'cash'::text as code,
           (select m.cash_in from moved m) + coalesce((select o.amount_cents from op o where o.code = 'cash'), 0) as dr,
           (select m.cash_out from moved m) as cr
    union all
    select 'receivable',
           coalesce((select o.amount_cents from op o where o.code = 'receivable'), 0), 0::bigint
    union all
    select 'inventory',
           coalesce((select o.amount_cents from op o where o.code = 'inventory'), 0), 0::bigint
    union all
    select 'payable',
           0::bigint, coalesce((select o.amount_cents from op o where o.code = 'payable'), 0)
    union all
    select 'deposits',
           0::bigint, (select m.held from moved m)
                      + coalesce((select o.amount_cents from op o where o.code = 'deposits'), 0)
    union all
    /* 开帐权益 = 开帐的资产 − 开帐的负债。**永远是配平的那一边。** */
    select 'opening',
           greatest(-((select t.assets from op_total t) - (select t.liabs from op_total t)), 0)::bigint,
           greatest((select t.assets from op_total t) - (select t.liabs from op_total t), 0)::bigint
    union all
    select 'income', 0::bigint, (select m.earned from moved m)
    union all
    select 'expense', (select m.cash_out from moved m), 0::bigint
  )
  select a.code, a.name, a.kind, r.dr::bigint, r.cr::bigint
  from acc a join rows r on r.code = a.code
  order by a.sort_order;
end;
$fn$;

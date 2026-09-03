-- 把它改回去。
--
-- 20260904140000 故意把 `staff_earnings` 的守卫改成 `works_here` 推上去，
-- `npm run check:staff` 当场红了一条：
--
--   FAIL  师傅算不出别人这个月做了多少 — 拿回 1 行
--
-- 那就是那条守卫**真的在守东西**的证据。两份都留在历史里。
--
-- ⚠️ 底下是从 20260904120000 逐字抄回来的，只有那一行 `sees_money` 是重点。
-- ⚠️ **没有另外去弄坏 `commission_tiers` 那条 RLS policy** ——
-- 跟 20260904070000/080000 那次一样，弄坏的是**绕过 RLS 的那一支**，
-- 因为那才是历史上真的漏过的形状。表上那条 policy 是普通的 RLS，
-- 而 check:staff 里那两行（老板看得到 · 师傅看不到）本来就在量它。

create or replace function public.staff_earnings(
  in_project_id uuid,
  in_month text
)
returns table (
  party_id uuid,
  name text,
  earned_cents bigint,
  commission_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  first_day date;
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  /* 「2026-09」→ 那个月的第一天。马来西亚的月份，不是伺服器的。 */
  first_day := to_date(in_month || '-01', 'YYYY-MM-DD');

  return query
  with earned as (
    select e.done_by as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.done_by is not null
      and e.direction = 'in'
      /* 冲正过的、跟自己是冲正的，都不算 —— 一笔退回去的钱不算她赚的。
         同一条规矩在 lib/portal/allocations.ts 的 countsAsReceived。 */
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
      and e.entry_on >= first_day
      and e.entry_on < (first_day + interval '1 month')
    group by e.done_by
  )
  select d.id,
         d.name,
         earned.total,
         (
           /* 分段算：每一档只吃它自己那一段。 */
           select coalesce(sum(
             greatest(
               least(earned.total, coalesce(nxt.from_cents, earned.total)) - t.from_cents,
               0
             ) * t.percent / 100
           ), 0)::bigint
           from public.commission_tiers t
           left join lateral (
             select min(t2.from_cents) as from_cents
             from public.commission_tiers t2
             where t2.party_id = t.party_id and t2.from_cents > t.from_cents
           ) nxt on true
           where t.party_id = d.id
         ) as commission_cents
  from earned
  join public.directory_entries d on d.id = earned.who
  order by earned.total desc;
end;
$$;

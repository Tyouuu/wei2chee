-- 🔴 故意把佣金那道守卫改坏，看它红。
--
-- 这一份跟 20260904070000 是同一件事，同一个理由：
-- **没有人看过它红的守卫，等於没有守卫。**
--
-- `staff_earnings` 是 security definer，所以它绕过 RLS —— 它的守卫就是
-- 函式第一行那句 `sees_money`。这里把它改成 `works_here`（也就是
-- 「只要在这里工作就看得到」），跑一次 `npm run check:staff`，
-- 看那两条真的变红，然后 20260904150000 把它改回去。
--
-- ⚠️ 这两份都留在历史里，因为它们**就是那个证据**。

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
  /* ⚠️ 故意写坏的那一行。 */
  if not public.works_here(in_project_id) then
    return;
  end if;

  first_day := to_date(in_month || '-01', 'YYYY-MM-DD');

  return query
  with earned as (
    select e.done_by as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.done_by is not null
      and e.direction = 'in'
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

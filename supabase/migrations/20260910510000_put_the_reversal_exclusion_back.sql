-- 放回去——原样从 20260910490000 抽出来，不是重打。看过 20260910500000 红过。

create or replace function public.party_value(in_project_id uuid)
returns table (
  party_id uuid,
  name text,
  times_paid bigint,
  total_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  return query
  select
    d.id,
    d.name,
    count(e.id)::bigint,
    sum(e.amount_cents)::bigint
  from public.directory_entries d
  join public.ledger_entries e
    on e.party_id = d.id
   and e.direction = 'in'
   /* 🔴 冲正过的不算——跟 party_debts 同一条纪律。 */
   and e.adjusts_id is null
   and not exists (
     select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id
   )
  where d.project_id = in_project_id
    and d.module_key = 'customers'
    and d.archived_at is null
  group by d.id
  order by sum(e.amount_cents) desc, d.name;
end;
$$;

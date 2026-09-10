-- 🔴 故意弄坏：拿掉「冲正过的不算」那一段，看 check:party-value 红不红。
-- 单独推这一支，看过红了再用 20260910510000 原样放回去（不是重打）。

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
  where d.project_id = in_project_id
    and d.module_key = 'customers'
    and d.archived_at is null
  group by d.id
  order by sum(e.amount_cents) desc, d.name;
end;
$$;

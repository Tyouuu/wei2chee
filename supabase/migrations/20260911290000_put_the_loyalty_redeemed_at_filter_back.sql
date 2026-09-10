-- 放回去——20260911280000 拿掉的那两条，原样抄回来。看过它红之后确认是真的：
-- 拿掉换奖时间的下限，换过奖的客人集点数不会归零，一直往上涨。

create or replace function public.loyalty_status_of(
  in_project_id uuid,
  in_party_id uuid default null
)
returns table (
  party_id uuid,
  name text,
  stamps integer,
  stamps_needed integer,
  earned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  needed integer;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;

  select r.stamps_needed into needed
    from public.loyalty_rules r where r.project_id = in_project_id;

  return query
  with entries as (
    select d.id, d.name, d.loyalty_redeemed_at
      from public.directory_entries d
     where d.project_id = in_project_id
       and d.archived_at is null
       and (in_party_id is null or d.id = in_party_id)
  ),
  hits as (
    select r.party_id
      from public.pipeline_records r
      join entries e on e.id = r.party_id
     where r.project_id = in_project_id
       and r.party_id is not null
       and r.issued_on is not null
       and (e.loyalty_redeemed_at is null or r.issued_on::timestamptz >= e.loyalty_redeemed_at)
    union all
    select a.party_id
      from public.appointments a
      join entries e on e.id = a.party_id
     where a.project_id = in_project_id
       and a.party_id is not null
       and coalesce(a.status, '') not in ('cancelled', 'no_show')
       and a.starts_at < now()
       and (e.loyalty_redeemed_at is null or a.starts_at >= e.loyalty_redeemed_at)
  ),
  counted as (
    select e.id, e.name, coalesce(count(h.party_id), 0)::integer as stamps
      from entries e
      left join hits h on h.party_id = e.id
     group by e.id, e.name
  )
  select c.id, c.name, c.stamps, needed,
         needed is not null and c.stamps >= needed
    from counted c
   order by c.stamps desc;
end;
$fn$;

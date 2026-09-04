-- 🔴 故意让车牌分大小写跟空格，**看那条守卫红**。
--
-- [重点 24]：一条没有人看过它红的守卫，等於没有守卫。
-- 而这一条守的是这一整件事的用处：他在柜台打「wa 1234 a」，
-- 而库里存的是「WA 1234 A」。分得开，那台车的历史就永远查不到。
--
-- 下一支（20260905310000）改回去。两支都留在历史里。
create or replace function public.find_vehicle(
  in_project_id uuid,
  in_plate text
)
returns table (
  vehicle_id uuid, plate text, descr text, made_year integer,
  party_id uuid, owner_name text, owner_whatsapp text,
  last_seen date, last_odometer_km integer, visits integer,
  service_every_km integer, due_at_km integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  washed text;
begin
  if not public.works_here(in_project_id) then return; end if;
  /* 🔴 这一行就是那个洞：拿他打的原字去比，不洗。 */
  washed := btrim(coalesce(in_plate, ''));
  if washed = '' then return; end if;

  return query
  select v.id, v.plate, v.descr, v.made_year, v.party_id,
         coalesce(d.name, ''), coalesce(d.whatsapp, ''),
         h.last_seen, h.last_km, h.visits, v.service_every_km,
         case when v.service_every_km is not null and h.last_km is not null
              then h.last_km + v.service_every_km end
  from public.vehicles v
  left join public.directory_entries d on d.id = v.party_id
  cross join lateral (
    select max(r.issued_on) as last_seen,
           (array_agg(r.odometer_km order by r.odometer_km desc nulls last))[1] as last_km,
           count(*)::integer as visits
    from public.pipeline_records r
    where r.vehicle_id = v.id and r.archived_at is null
  ) h
  where v.project_id = in_project_id
    and v.archived_at is null
    and (v.plate = washed or v.plate like washed || '%')
  order by (v.plate = washed) desc, v.plate
  limit 10;
end;
$$;

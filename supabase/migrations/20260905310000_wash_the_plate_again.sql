-- 把车牌洗回去。20260905300000 故意分大小写跟空格，而中间那 12 条红
-- 是这条守卫唯一的证据（[重点 24]）—— 一个洞，十二个画面同时坏。
--
-- 内容跟 20260905290000 那一版一模一样。
create or replace function public.find_vehicle(
  in_project_id uuid,
  in_plate text
)
returns table (
  vehicle_id uuid,
  plate text,
  descr text,
  made_year integer,
  party_id uuid,
  owner_name text,
  owner_whatsapp text,
  last_seen date,
  last_odometer_km integer,
  visits integer,
  service_every_km integer,
  due_at_km integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  washed text;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  washed := upper(regexp_replace(coalesce(in_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  if washed = '' then
    return;
  end if;

  return query
  select v.id, v.plate, v.descr, v.made_year, v.party_id,
         coalesce(d.name, ''), coalesce(d.whatsapp, ''),
         h.last_seen, h.last_km, h.visits,
         v.service_every_km,
         /* 该在几公里再来。**空的时候留空** ——
            我们没有替他决定过保养间隔，就不该印一个数字出来。 */
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
    /* 打前几个字就找得到 —— 客人念车牌的时候他一边打。 */
    and (v.plate_key = washed or v.plate_key like washed || '%')
  order by (v.plate_key = washed) desc, v.plate
  limit 10;
end;
$$;

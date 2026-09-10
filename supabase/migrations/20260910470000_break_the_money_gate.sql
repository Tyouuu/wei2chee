-- 🔴 故意弄坏：拿掉 sees_money 那一段，看 check:service-performance 红不红。
-- 单独推这一支，看过红了再用 20260910480000 原样放回去（不是重打）。

create or replace function public.service_performance(
  in_project_id uuid,
  in_days int default 30
)
returns table (
  service text,
  times_done bigint,
  total_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    l.service,
    count(*)::bigint,
    coalesce(sum(l.price_cents), 0)::bigint
  from public.appointment_lines l
  join public.appointments a on a.id = l.appointment_id
  where l.project_id = in_project_id
    and a.archived_at is null
    and a.status = 'done'
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
        > public.today_myt() - greatest(1, coalesce(in_days, 30))
  group by l.service
  order by count(*) desc, l.service;
end;
$$;

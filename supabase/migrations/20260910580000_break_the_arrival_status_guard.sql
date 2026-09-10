-- 🔴 故意弄坏：拿掉「只有还没发生的预约才给标到了」那一段，看 check:arrival 红不红。
-- 单独推这一支，看过红了再用 20260910590000 原样放回去（不是重打）。

create or replace function public.mark_appointment_arrived(in_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.appointments;
begin
  select * into row from public.appointments
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'not your appointment';
  end if;
  update public.appointments
     set arrived_at = coalesce(arrived_at, now())
   where id = in_id
  returning * into row;

  return row;
end;
$$;

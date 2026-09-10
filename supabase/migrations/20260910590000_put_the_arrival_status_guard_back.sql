-- 放回去——原样从 20260910570000 抽出来，不是重打。看过 20260910580000 红过。

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
  if row.status not in ('booked') then
    raise exception 'that booking is not waiting to happen';
  end if;

  update public.appointments
     set arrived_at = coalesce(arrived_at, now())
   where id = in_id
  returning * into row;

  return row;
end;
$$;

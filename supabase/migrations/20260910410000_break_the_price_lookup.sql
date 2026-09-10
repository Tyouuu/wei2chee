-- 🔴 故意弄坏：拿掉「没讲价钱就去清单找一次」那一段，看 check:visit-lines 红不红。
-- 单独推这一支，看过红了再用 20260910420000 原样放回去（不是重打）。

create or replace function public.add_visit_line(
  in_appointment_id uuid,
  in_service text,
  in_staff_id uuid default null,
  in_price_cents bigint default null
)
returns public.appointment_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments;
  seat integer;
  made public.appointment_lines;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if appt.id is null or not public.works_here(appt.project_id) then
    raise exception 'no such visit in your business';
  end if;
  if coalesce(btrim(in_service), '') = '' then
    raise exception 'say what was done';
  end if;
  if in_price_cents is not null and in_price_cents < 0 then
    raise exception 'a price cannot be less than nothing';
  end if;

  if in_staff_id is not null then
    perform 1 from public.directory_entries
     where id = in_staff_id and project_id = appt.project_id;
    if not found then
      raise exception 'that person does not work here';
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into seat
    from public.appointment_lines where appointment_id = in_appointment_id;

  insert into public.appointment_lines
    (project_id, appointment_id, service, staff_id, price_cents, sort_order, created_by)
  values (appt.project_id, in_appointment_id, left(btrim(in_service), 120),
          in_staff_id, in_price_cents, seat, auth.uid())
  returning * into made;
  return made;
end;
$$;

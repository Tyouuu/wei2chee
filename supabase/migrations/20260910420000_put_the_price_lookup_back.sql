-- 放回去——原样从 20260910400000 抽出来，不是重打。看过 20260910410000 红过。

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
  found_item uuid;
  looked_up record;
  final_price bigint;
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

  final_price := in_price_cents;

  /* 🔴 没有讲价钱——不是留白，是先去她自己的清单找一次。
     只认得一模一样的名字，配不到就照旧留 null（还没讲），
     跟纸本一样：讲得出名字的，价钱本来就写在她自己那张表上。 */
  if final_price is null then
    select id into found_item from public.catalog_items
     where project_id = appt.project_id
       and archived_at is null
       and lower(btrim(name)) = lower(btrim(in_service))
     limit 1;

    if found_item is not null then
      select * into looked_up from public.price_for(found_item, in_staff_id);
      final_price := looked_up.price_cents;
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into seat
    from public.appointment_lines where appointment_id = in_appointment_id;

  insert into public.appointment_lines
    (project_id, appointment_id, service, staff_id, price_cents, sort_order, created_by)
  values (appt.project_id, in_appointment_id, left(btrim(in_service), 120),
          in_staff_id, final_price, seat, auth.uid())
  returning * into made;
  return made;
end;
$$;

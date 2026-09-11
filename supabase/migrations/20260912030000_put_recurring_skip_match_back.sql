-- 改回来：20260912020000 弄坏的那一段撤销掉，恢复 20260912010000 的版本。
create or replace function public.add_recurring_appointments(
  in_project_id uuid,
  in_module_key text,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_weeks integer,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_room_id uuid default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns table (week_number integer, appointment_id uuid, skipped boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  the_start timestamptz;
  the_end timestamptz;
  the_duration interval;
  new_id uuid;
  week_key uuid;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;
  if in_starts_at is null or in_ends_at is null then
    raise exception 'an appointment needs a time';
  end if;
  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;
  if coalesce(in_weeks, 0) < 1 or in_weeks > 52 then
    raise exception 'say how many weeks, from 1 to 52';
  end if;
  the_duration := in_ends_at - in_starts_at;

  for i in 0..(in_weeks - 1) loop
    the_start := in_starts_at + (i || ' weeks')::interval;
    the_end := the_start + the_duration;
    week_key := case when in_idempotency_key is not null
      then md5(in_idempotency_key::text || ':' || i::text)::uuid
      else null
    end;

    begin
      new_id := public.add_appointment(
        in_project_id := in_project_id,
        in_module_key := in_module_key,
        in_starts_at := the_start,
        in_ends_at := the_end,
        in_party := in_party,
        in_party_id := in_party_id,
        in_staff_id := in_staff_id,
        in_service := in_service,
        in_source := 'staff',
        in_note := in_note,
        in_room_id := in_room_id,
        in_idempotency_key := week_key
      );
      week_number := i + 1;
      appointment_id := new_id;
      skipped := false;
      reason := null;
      return next;
    exception
      when others then
        if sqlstate = '23514' and (
             sqlerrm = 'that time is already taken'
             or sqlerrm = 'that room is already taken then'
           ) then
          week_number := i + 1;
          appointment_id := null;
          skipped := true;
          reason := sqlerrm;
          return next;
        else
          raise;
        end if;
    end;
  end loop;
  return;
end;
$$;

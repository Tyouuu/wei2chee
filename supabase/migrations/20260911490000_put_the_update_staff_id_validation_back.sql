-- 放回去——20260911480000 拿掉的那一段，原样抄回来。看过它红之后确认是真的：
-- 拿掉它，别人家真的员工照样重新指派得进这一间店的预约。

create or replace function public.update_appointment(
  in_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_clear_party boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select project_id into proj from public.appointments where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your appointment';
  end if;

  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;

  if in_staff_id is not null then
    if not exists (
      select 1 from public.directory_entries
       where id = in_staff_id and project_id = proj
    ) then
      raise exception 'that person does not work here';
    end if;
  end if;

  update public.appointments
  set starts_at = in_starts_at,
      ends_at = in_ends_at,
      party = left(btrim(coalesce(in_party, '')), 120),
      party_id = case when in_clear_party then null else in_party_id end,
      staff_id = in_staff_id,
      service = left(btrim(coalesce(in_service, '')), 120),
      note = btrim(coalesce(in_note, '')),
      extra = coalesce(in_extra, '{}'::jsonb),
      updated_at = now()
  where id = in_id;

exception
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

comment on function public.update_appointment(
  uuid, timestamptz, timestamptz, text, uuid, uuid, text, text, jsonb, boolean
) is
  'Reschedules or reassigns a booking. Validates staff_id belongs to this project, same as add_appointment. See 20260902030000, staff_id validation added 20260911470000.';

-- 故意弄坏：拿掉 update_appointment 那段验证——看过它红。
-- 单独推、单独看红，见 20260911470000 档头。

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

  -- 🔴 故意拿掉那一段验证

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

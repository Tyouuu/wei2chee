-- 放回去——20260911510000 拿掉的那一段，原样抄回来。看过它红之后确认是真的：
-- 拿掉它，别人家真的员工照样记得进这一家的保养记录。

create or replace function public.service_visits_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.service_contracts where id = new.contract_id;
  if owner_project is null then
    raise exception 'no such contract';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.record_id is not null and not exists (
    select 1 from public.pipeline_records r
    where r.id = new.record_id and r.project_id = owner_project
  ) then
    raise exception 'that document belongs to another business';
  end if;

  if new.staff_id is not null and not exists (
    select 1 from public.directory_entries d
    where d.id = new.staff_id and d.project_id = owner_project
  ) then
    raise exception 'that person is not a staff member in this project';
  end if;

  if new.status = 'done' and new.done_on is null then
    new.done_on := public.today_myt();
  end if;
  return new;
end;
$$;

-- 故意弄坏：拿掉「那一位要真的是这家的人」那一段——看过它红。
-- 单独推、单独看红，见 20260911500000 档头。

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

  -- 🔴 故意拿掉验证 staff_id 那一段

  if new.status = 'done' and new.done_on is null then
    new.done_on := public.today_myt();
  end if;
  return new;
end;
$$;

-- 故意弄坏：拿掉「已经在上班就还给她原本那一笔」那段——看过它红。
-- 单独推、单独看红，见 20260911240000 档头。

create or replace function public.clock_in(in_staff_id uuid)
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  staff public.directory_entries;
  made public.staff_shifts;
begin
  select * into staff from public.directory_entries
   where id = in_staff_id and public.works_here(project_id);
  if staff.id is null then
    raise exception 'that person does not work here';
  end if;

  -- 🔴 故意拿掉查现有开着的班那一段，每次都硬插一笔新的

  insert into public.staff_shifts (project_id, staff_id)
  values (staff.project_id, in_staff_id)
  returning * into made;

  return made;
end;
$fn$;

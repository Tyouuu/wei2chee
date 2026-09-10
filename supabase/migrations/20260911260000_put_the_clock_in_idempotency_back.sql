-- 放回去——20260911250000 拿掉的那一段，原样抄回来。看过它红之后确认：
-- 拿掉这一段，第二次打卡上班会直接去撞栏位自己的部分唯一索引，
-- 整支半路失败，不是优雅地还给她原本那一笔。两层都要在。

create or replace function public.clock_in(in_staff_id uuid)
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  staff public.directory_entries;
  existing public.staff_shifts;
  made public.staff_shifts;
begin
  select * into staff from public.directory_entries
   where id = in_staff_id and public.works_here(project_id);
  if staff.id is null then
    raise exception 'that person does not work here';
  end if;

  select * into existing from public.staff_shifts
   where staff_id = in_staff_id and clock_out_at is null;
  if existing.id is not null then
    return existing;
  end if;

  insert into public.staff_shifts (project_id, staff_id)
  values (staff.project_id, in_staff_id)
  returning * into made;

  return made;
end;
$fn$;

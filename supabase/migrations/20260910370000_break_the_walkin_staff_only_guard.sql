-- 🔴 故意弄坏：拿掉「只有职员名册上的人」那一段，看 check:walkin 红不红。
-- 单独推这一支，看过红了再用 20260910380000 原样放回去（不是重打）。

create or replace function public.take_walkin_turn(in_staff_id uuid)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.directory_entries;
begin
  select * into row from public.directory_entries
   where id = in_staff_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'that person is not in your directory';
  end if;

  update public.directory_entries
     set last_walkin_at = now()
   where id = in_staff_id
  returning * into row;

  return row;
end;
$fn$;

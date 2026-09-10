-- 放回去——原样从 20260910360000 抽出来，不是重打。看过 20260910370000 红过。

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
  if row.module_key <> 'staff' then
    raise exception 'that is not on your staff list';
  end if;

  update public.directory_entries
     set last_walkin_at = now()
   where id = in_staff_id
  returning * into row;

  return row;
end;
$fn$;

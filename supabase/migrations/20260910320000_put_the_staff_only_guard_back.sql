-- 放回去——原样从 20260910300000 抽出来，不是重打。看过 20260910310000 红过。

create or replace function public.set_staff_credential(
  in_staff_id uuid,
  in_credential text,
  in_expires_on date default null
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
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
     set credential = left(btrim(coalesce(in_credential, '')), 80),
         credential_expires_on = in_expires_on
   where id = in_staff_id
  returning * into row;

  return row;
end;
$$;

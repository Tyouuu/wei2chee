-- 🔴 故意弄坏：拿掉「只有职员名册上的人」那一段，看 check:nudges 红不红。
-- 单独推这一支，看过红了再用 20260910320000 原样放回去（不是重打）。

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

  update public.directory_entries
     set credential = left(btrim(coalesce(in_credential, '')), 80),
         credential_expires_on = in_expires_on
   where id = in_staff_id
  returning * into row;

  return row;
end;
$$;

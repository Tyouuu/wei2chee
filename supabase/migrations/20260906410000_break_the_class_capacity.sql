-- 🔴 故意弄坏：拿掉「满了就挡」那一段，看尺子红。
-- **单独推一次** —— 弄坏跟改回去在同一次推送里，
-- 红的那一刻没有人看得到（重点 31 第三条）。
-- 下一支 20260906420000 把它原样搬回去。

create or replace function public.enrol_in_class(
  in_group_id uuid,
  in_party_id uuid
)
returns public.class_members
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.class_members;
  grp public.class_groups;
  seated integer;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if not found then
    raise exception 'no such class';
  end if;
  if not public.works_here(grp.project_id) then
    raise exception 'that project is not yours';
  end if;
  if grp.archived_at is not null then
    raise exception 'that class is closed';
  end if;
  if not exists (
       select 1 from public.directory_entries d
       where d.id = in_party_id and d.project_id = grp.project_id
     ) then
    raise exception 'that person is not in this book';
  end if;

  /* 已经在里面（包括离开过又回来）—— 把原本那一行还回来，不开第二个位子。 */
  select * into row from public.class_members
  where group_id = in_group_id and party_id = in_party_id;
  if found then
    if row.left_on is not null then
      update public.class_members set left_on = null, joined_on = public.today_myt()
       where id = row.id
      returning * into row;
    end if;
    return row;
  end if;

  insert into public.class_members (project_id, group_id, party_id, added_by)
  values (grp.project_id, in_group_id, in_party_id, auth.uid())
  returning * into row;
  return row;
end;
$$;

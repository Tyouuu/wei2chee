-- 把「满了就挡」那一段原样搬回去。
--
-- 20260906410000 拿掉它之后，`check:classes` 红四条，
-- 而红出来的读数正好是它坏掉时的样子：
--     一张写着上限 3 的班，名册上坐了 4 个人，
--     而画面上没有任何东西会讲。
--
-- ⚠️ 从 20260906400000 原样抽出来，不是照记忆重打
-- （重点 31 第一条 —— 被咬过三次）。

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

  /* 🔴 满了就讲出来，而且讲得出上限是多少 ——
     「这个班满了」是家长打电话来问的那一句，
     而一个静静收下第十一个人的系统会让他排一张坐不下的课表。 */
  if grp.capacity is not null then
    select count(*) into seated
    from public.class_members m
    where m.group_id = in_group_id and m.left_on is null;
    if seated >= grp.capacity then
      raise exception 'that class is full - it takes %', grp.capacity;
    end if;
  end if;

  insert into public.class_members (project_id, group_id, party_id, added_by)
  values (grp.project_id, in_group_id, in_party_id, auth.uid())
  returning * into row;
  return row;
end;
$$;

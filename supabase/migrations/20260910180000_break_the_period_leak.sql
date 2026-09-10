-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 拿掉的是「哪一期」那一句比对 —— 只要确认过**任何一期**，就当成这一期确认过。
--
-- 坏起来的样子：一个学生 2026 年第一学期确认过续班，
-- 而**第三学期他早就转走了**，名单上却讲他已经确认 —— 老板不会去催他，
-- 而那笔学费永远不会来。⚠️ 画面上完全正常：名单变短了，看起来像做对了事。
-- 20260910190000 把它原样搬回去。

create or replace function public.not_confirmed_for(
  in_group_id uuid,
  in_period text
)
returns table (
  party_id uuid,
  student text,
  joined_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  if coalesce(btrim(in_period), '') = '' then
    raise exception 'say which period to check';
  end if;

  return query
  select m.party_id, d.name, m.joined_on
    from public.class_members m
    join public.directory_entries d on d.id = m.party_id
   where m.group_id = in_group_id
     and m.left_on is null
     and not exists (
       select 1 from public.class_confirmations c
        where c.group_id = in_group_id
          and c.party_id = m.party_id
          and true /* 弄坏的就是这一行：不再比对哪一期 */
     )
   order by d.name;
end;
$$;


revoke execute on function public.not_confirmed_for(uuid, text) from public, anon;
grant execute on function public.not_confirmed_for(uuid, text) to authenticated;

-- 把 20260910180000 拿掉的那一句比对搬回去。
--
-- ⚠️ **原样从 20260910170000 抽出来**（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的（`check:term`）：
--   FAIL  🔴 换一期，三个都要重新确认（上一期确认过不算数）

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
          and c.period = btrim(in_period)
     )
   order by d.name;
end;
$$;


revoke execute on function public.not_confirmed_for(uuid, text) from public, anon;
grant execute on function public.not_confirmed_for(uuid, text) to authenticated;

-- 🔴 `transfers_of` 有两个错，而且第二个比第一个严重。
--
--  1. `max(uuid)` **不存在** —— Postgres 没有那个聚合，所以那一支
--     从写出来到现在**一次都没有跑成功过**（`db push` 照旧回报成功：
--     [重点 26](./founder-points.md)，到执行才解析）。
--
--  2. 🔴 **两间店的名字会一模一样。**
--     我把 `bf` 跟 `bt` 都接在同一栏 `m.branch_id` 上 ——
--     於是「从哪一间搬到哪一间」两边会印出同一个名字，
--     而那正好是这一整支要答的那一句。
--     ⚠️ 第一个错让它整支炸掉，所以第二个错**永远不会被看见** ——
--     一支跑不起来的函式，跟一支跑起来会说谎的函式，
--     在报告里长得一模一样。
--
-- 修法：先把一次搬运折成一行（两半各自取自己那一边的店），
-- 再去接名字 —— 而不是在同一个 group by 里同时问两个 uuid。

create or replace function public.transfers_of(
  in_project_id uuid,
  in_from date default null,
  in_to date default null
)
returns table (
  transfer_id uuid,
  item_id uuid,
  item_name text,
  qty numeric,
  from_branch uuid,
  from_name text,
  to_branch uuid,
  to_name text,
  moved_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;

  return query
  with folded as (
    select
      m.transfer_id as tid,
      /* 🔴 uuid 没有 max，而这两半本来就是同一件货 ——
         取阵列第一个就是它。 */
      (array_agg(m.item_id))[1] as item_id,
      max(abs(m.qty)) as qty,
      (array_agg(m.branch_id) filter (where m.direction = 'out'))[1] as from_branch,
      (array_agg(m.branch_id) filter (where m.direction = 'in'))[1] as to_branch,
      max(m.moved_on) as moved_on,
      max(m.created_at) as created_at
    from public.stock_moves m
    where m.project_id = in_project_id
      and m.transfer_id is not null
      and (in_from is null or m.moved_on >= in_from)
      and (in_to is null or m.moved_on <= in_to)
    group by m.transfer_id
  )
  select
    f.tid, f.item_id, coalesce(c.name, ''), f.qty,
    f.from_branch, coalesce(bf.name, ''),
    f.to_branch, coalesce(bt.name, ''),
    f.moved_on
  from folded f
  join public.catalog_items c on c.id = f.item_id
  /* 🔴 两个接法接在**各自那一边**，不是都接在同一栏上。 */
  left join public.branches bf on bf.id = f.from_branch
  left join public.branches bt on bt.id = f.to_branch
  order by f.moved_on desc, f.created_at desc;
end;
$$;

revoke execute on function public.transfers_of(uuid, date, date) from public, anon;
grant execute on function public.transfers_of(uuid, date, date) to authenticated;

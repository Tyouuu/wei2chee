-- 走单客人轮到谁 —— 不是每天吵一次，是算出来的。
--
-- ── 为什么（三个行业深度研究，沙龙一之六）───────────────────────────────
--
-- Aoikumo（马来西亚那一家）明写：「Set employee availability roster and
-- set turns for customer servicing」。怡保街边理发店大半是走单——
-- 没有它，讲不出「大概等 25 分钟」，而且**轮到谁变成每天吵一次**：
-- 站在门口的那个拿到客人，也拿到抽成。
--
-- ⚠️ Vagaro 没有这一件——所以这是市场上一条真的分界线，不是人人都有。
--
-- ── 🔴 照 [重点 34] 那把尺：纸本怎么做，软件就怎么做 ──────────────────
--
-- 真的理发店的做法不是一张排班表，是一支笔记的名单：谁等最久谁先来，
-- 接了客人就排到最后面去。**排在最后**不用真的搬动一份清单去实现——
-- 「谁等最久」本身就是「谁最后一次接客人隔了最久」，一个日期就够了，
-- 不用一张位置表、不用位移的逻辑（[重点 29] 第 1 种：算出来，不用存）。
--
-- 所以只加两栏在师傅自己那一行上：
--   `last_walkin_at` —— 上一次接了走单客人是几时。null = 还没接过，
--                        排在所有人前面（一个新来的师傅不该排在队尾）
--   `walkin_available` —— 她现在在不在轮子里（去吃饭 · 在忙排定的预约）。
--                        跟排班表（沙龙三）是两件事：那是「今天上不上班」，
--                        这是「这一刻要不要算她」，柜台随时按得到
--
-- ── 只加，不碰任何排班或抽成 ─────────────────────────────────────────────
--
-- 跟今晚 `credential` / `credential_expires_on` 同一个形状：两栏挂在
-- `directory_entries` 自己身上，对 customers / suppliers 那两种行没有意义，
-- 空着就是空着。谁真的接了客人、抽成怎么算，走的是既有的 `appointment_lines`
-- （20260910010000）——这一支只回答「接下来该轮到谁」，不碰钱。

alter table public.directory_entries
  add column if not exists last_walkin_at timestamptz,
  add column if not exists walkin_available boolean not null default true;

comment on column public.directory_entries.last_walkin_at is
  'When this staff member last took a walk-in. Null = never, so a brand-new stylist is not stuck at the back of a queue that started before she did. Feeds next_for_walkin -- computed order, not a stored position. See 20260910360000.';

comment on column public.directory_entries.walkin_available is
  'Is she in the walk-in rotation right now -- not the same as her shift roster (salon gap 三), this is a front-desk toggle for "counts this minute" (stepped out, mid a scheduled booking). Only means anything when module_key = ''staff''.';

-- ── 谁在轮子里，排好队的整份名单 ─────────────────────────────────────────

create or replace function public.walkin_queue_of(in_project_id uuid)
returns table (
  id uuid,
  name text,
  last_walkin_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.last_walkin_at
    from public.directory_entries d
   where d.project_id = in_project_id
     and public.works_here(in_project_id)
     and d.module_key = 'staff'
     and d.archived_at is null
     and d.walkin_available
   order by d.last_walkin_at nulls first, d.name;
$$;

revoke execute on function public.walkin_queue_of(uuid) from public, anon;
grant execute on function public.walkin_queue_of(uuid) to authenticated;

comment on function public.walkin_queue_of(uuid) is
  'The whole line-up, in order -- the front-desk whiteboard, computed. Whoever waited longest (or has never taken one) is first. See 20260910360000.';

-- ── 接下来该轮到谁（同一个答案，只拿第一个） ──────────────────────────────

create or replace function public.next_for_walkin(in_project_id uuid)
returns public.directory_entries
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  row public.directory_entries;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that is not your business';
  end if;

  select d.* into row
    from public.directory_entries d
   where d.project_id = in_project_id
     and d.module_key = 'staff'
     and d.archived_at is null
     and d.walkin_available
   order by d.last_walkin_at nulls first, d.name
   limit 1;

  return row;
end;
$fn$;

revoke execute on function public.next_for_walkin(uuid) from public, anon;
grant execute on function public.next_for_walkin(uuid) to authenticated;

-- ── 接了 —— 排到队尾去 ───────────────────────────────────────────────────

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

revoke execute on function public.take_walkin_turn(uuid) from public, anon;
grant execute on function public.take_walkin_turn(uuid) to authenticated;

-- ── 她去吃饭了 / 回来了 —— 柜台随时按得到 ─────────────────────────────────

create or replace function public.set_walkin_available(
  in_staff_id uuid,
  in_available boolean
)
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
     set walkin_available = in_available
   where id = in_staff_id
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.set_walkin_available(uuid, boolean) from public, anon;
grant execute on function public.set_walkin_available(uuid, boolean) to authenticated;

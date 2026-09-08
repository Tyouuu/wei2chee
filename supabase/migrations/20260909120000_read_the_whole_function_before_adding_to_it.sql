-- 一次疗程也是一次来 —— 而这一条是看图看出来的，不是读数。
--
-- ── 一页上两句话互相打架 ────────────────────────────────────────────────
--
-- 2026-09-09 把疗程记录接到客户那一页上，拍出来是这样：
--
--     How often they come    Nothing yet          ← 这两句在上面
--     Their jobs             No jobs yet
--     What she has had done  Botox · 2026-09-09   ← 这一段在底下
--                            Hydrafacial · 2026-07-30
--
-- **同一屏，她来过两次，而这一页写着「还没有来过」。**
-- [任务 80](../docs/founder-tasks.md)：对的数字配错的标签比空白更糟 ——
-- 而两段互相打架，比两者都糟。
--
-- 🔴 尺子抓不到它：`check:treatments` 41 条全绿、`shoot:treatments` 11 条全绿。
-- **是图上看出来的**（[重点 7l](../docs/founder-points.md)）。
--
-- ── ⚠️ 而我第一版是照记忆重打的，付了一次学费 ──────────────────────────
--
-- 20260909110000 我读了那一支的前半段，**尾巴没读就自己重写了一遍**，
-- 於是掉了两条守卫，而 `check:regulars` 当场红两条：
--
--   `只来过两天就不给「平常」` —— 那一条 `case when visit_days >= 3` 不见了
--   `从来没来过的不在清单上`   —— 那个 inner join 变成了 left join
--
-- 🔴 [重点 31](../docs/founder-points.md) 第一条一字不差：
-- **不准整支重写，要在原来那一支上加。**「原来那一支」是最后一次定义它的
-- 那个档案，而这一版是**从 20260907010000 原样抽出来**、只插了一段 union。
create or replace function public.party_visits(
  in_project_id uuid,
  /* 不给就是整家 —— 讯号那一支要的是全部。给了就一个人。 */
  in_party_id uuid default null
)
returns table (
  party_id uuid,
  name text,
  whatsapp text,
  module_key text,
  visits integer,
  visit_days integer,
  first_on date,
  last_on date,
  days_since integer,
  usual_gap_days integer,
  longest_gap_days integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;

  return query
  with entries as (
    select d.id, d.name, coalesce(d.whatsapp, '') as whatsapp, d.module_key
    from public.directory_entries d
    where d.project_id = in_project_id
      and d.archived_at is null
      and (in_party_id is null or d.id = in_party_id)
  ),
  /* 一次来 = 一张单，或者一个真的来过的预约。 */
  hits as (
    select r.party_id, r.issued_on as on_day
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.party_id is not null
      and r.issued_on is not null
      /* ③ 含收起来的 —— 做完收档的工作还是来过一次。 */
    union all
    select a.party_id,
           (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
    from public.appointments a
    where a.project_id = in_project_id
      and a.party_id is not null
      /* ② 取消的 · 没来的 · 还没到的，三种都不是来过。 */
      and coalesce(a.status, '') not in ('cancelled', 'no_show')
      and a.starts_at < now()
    union all
    /* 🔴 一次疗程（20260909040000）—— 一间 medi spa 的客人只有这个：
       她走进来做，没有开单，也可能没有预约。少了这一段，
       她的每一个客人在系统眼里都从来没有来过，而「久没来」那个讯号
       （第十三个）对她整个不成立。

       ⚠️ **只数没有挂在预约上的那几笔**：挂着的那一笔跟那一次预约是
       同一次来，数两次会把「她平常隔多久」腰斩，而那正是那个讯号的依据。
       ⚠️ 收起来的照数 —— 一次真的做过的疗程是历史。 */
    select n.party_id,
           n.done_on
    from public.treatment_notes n
    where n.project_id = in_project_id
      and n.appointment_id is null
  ),
  counted as (
    select h.party_id,
           count(*)::integer as visits,
           count(distinct h.on_day)::integer as visit_days,
           min(h.on_day) as first_on,
           max(h.on_day) as last_on
    from hits h
    group by h.party_id
  ),
  /* 相异的日子之间的间隔 —— 同一天两张单不产生一个零。 */
  gaps as (
    select g.party_id, g.on_day - lag(g.on_day) over (
             partition by g.party_id order by g.on_day
           ) as gap
    from (select distinct h.party_id, h.on_day from hits h) g
  ),
  shape as (
    select gaps.party_id,
           /* 中位数，取他真的有过的那一个间隔（不是内插出来的）。 */
           percentile_disc(0.5) within group (order by gaps.gap)::integer as usual_gap,
           max(gaps.gap)::integer as longest_gap
    from gaps
    where gaps.gap is not null
    group by gaps.party_id
  )
  select e.id, e.name, e.whatsapp, e.module_key,
         c.visits, c.visit_days, c.first_on, c.last_on,
         (public.today_myt() - c.last_on)::integer,
         /* 🔴 少於三天就没有「平常」—— 两天只有一个间隔，一个间隔不是习惯。 */
         case when c.visit_days >= 3 then s.usual_gap end,
         case when c.visit_days >= 3 then s.longest_gap end
  from entries e
  join counted c on c.party_id = e.id
  left join shape s on s.party_id = e.id
  /* 从来没来过的不算 —— 那是一个刚建好的名册行，不是一个跑掉的客人
     （`vehicles_overdue` 20260905290000 同一条判断）。 */
  order by c.last_on desc nulls last;
end;
$fn$;

revoke all on function public.party_visits(uuid, uuid) from public;
grant execute on function public.party_visits(uuid, uuid) to authenticated;

comment on function public.party_visits(uuid, uuid) is
  '他来过几次 · 上一次是几时 · 他平常隔多久来一次。一份，不是两份 —— 任务 220。';

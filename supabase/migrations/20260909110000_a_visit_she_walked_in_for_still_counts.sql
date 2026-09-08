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
-- [任务 80](../docs/founder-tasks.md) 那一条在这里换了一个形状：
-- 对的数字配错的标签比空白更糟 —— 而两段互相打架，比两者都糟。
--
-- 🔴 而尺子抓不到它：`check:treatments` 41 条全绿，
-- `shoot:treatments` 11 条全绿。**是图上看出来的**（[重点 7l]）。
--
-- ── 🔴 而它同时是一个真的洞，不只是画面 ────────────────────────────────
--
-- `party_visits` 是「久没来」那个讯号（第十三个，20260907020000）的原料。
-- 一间 medi spa 的客人**只有疗程记录**（她走进来做，没有开单）——
-- 所以在这之前，**她的每一个客人在系统眼里都从来没有来过**，
-- 而那个讯号对她整个不成立。
--
-- ── 🔴 但不可以算两次，而分界线是查得到的 ──────────────────────────────
--
-- 一笔挂着 `appointment_id` 的疗程记录，跟那一笔预约是**同一次来**
-- （她约了三点，来了，做了）。再数一次，`visits` 就变两次，
-- 而「她平常隔多久来一次」会被腰斩 —— 那正好是那个讯号判断的依据。
--
-- 所以：**只数没有挂在预约上的那几笔**（走进来做的那一次）。
-- ⚠️ 这一条不是靠 `visit_days` 去重就好：那一栏数的是相异的日子，
-- 而 `visits` 数的是次数，两栏 [任务 259] 特地分开过。

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
  /* 一次来 = 一张单，或者一个真的来过的预约，或者一次走进来做的疗程。 */
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
    /* 🔴 一次疗程（20260909040000）。
       ⚠️ **只数没有挂在预约上的那几笔** —— 挂着的那一笔跟那一次预约是
       同一次来，数两次会把「她平常隔多久」腰斩，而那正是那个讯号的依据。
       ⚠️ 收起来的照数：一次真的做过的疗程是历史（跟单据那一条同一句）。 */
    select n.party_id, n.done_on
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
  gaps as (
    select g.party_id,
           (g.on_day - lag(g.on_day) over (partition by g.party_id order by g.on_day))::integer as gap
    from (select distinct h.party_id, h.on_day from hits h) g
  ),
  shaped as (
    select gp.party_id,
           (percentile_disc(0.5) within group (order by gp.gap))::integer as usual_gap_days,
           max(gp.gap)::integer as longest_gap_days
    from gaps gp
    where gp.gap is not null
    group by gp.party_id
  )
  select e.id, e.name, e.whatsapp, e.module_key,
         coalesce(c.visits, 0),
         coalesce(c.visit_days, 0),
         c.first_on,
         c.last_on,
         case when c.last_on is null then null
              else (public.today_myt() - c.last_on)::integer end,
         s.usual_gap_days,
         s.longest_gap_days
  from entries e
  left join counted c on c.party_id = e.id
  left join shaped s on s.party_id = e.id;
end;
$fn$;

revoke all on function public.party_visits(uuid, uuid) from public;
grant execute on function public.party_visits(uuid, uuid) to authenticated;

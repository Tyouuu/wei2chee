/* 「他来过几次 · 上一次是几时 · 他平常隔多久来一次」—— 一份，不是两份。
 *
 * ── 为什么这一支要存在 ────────────────────────────────────────────────
 *
 * 今天这三句话**只活在客户详情那一页的 TypeScript 里**
 * （`app/[locale]/portal/[pageKey]/[recordId]/page.tsx`，四个查询）。
 * 而[任务 220](../../docs/founder-tasks.md#220) 当时故意没做「客人久没来」
 * 那个讯号，理由白纸黑字：
 *
 *   > 「上一次来是几时」今天**只有画面那一边有一份** —— 在这里再算一次
 *   > 就是同一个问题两个答案，而那正是[任务 216](#216) 登记过的那个陷阱。
 *   > **顺序是：先把「上一次来 · 来过几次」做成一份，再拿它做这个讯号。**
 *
 * 这一支就是那一份。讯号在下一支（`20260907020000`）。
 *
 * ── 三个判断，每一个都带代价 ──────────────────────────────────────────
 *
 * ① 🔴 **两个数字，两个名字，不合成一个。**
 *    `visits` 是**几次**（几张单／几个预约）—— 跟画面今天印的那个数字同一个意思，
 *    所以那一页换过来的时候，他看到的数字不会静静地变。
 *    `visit_days` 是**几天**（相异的日子）—— 间隔只能拿它算：
 *    同一天两张单中间的「间隔」是零，而一堆零会把中位数拉到零，
 *    然后每一个客人都变成「久没来」。
 *    合成一个就要在两种意思之间挑一个，而两种意思在不同的行业各自是对的。
 *
 * ② 🔴 **预约只算「真的来过的」。**
 *    取消的不是来过 · 没来的**照定义**不是来过 · 还没到的那一天更不是
 *    （算进去 `last_on` 会跑到未来，`days_since` 变负的）。
 *    ⚠️ 而 `booked` 而且**已经过去**的照算 —— 那颗「她来了」的按钮
 *    2026-09-06 才做出来（[任务 202](#202)），一间沙龙很可能从来没按过它。
 *    「她那天没有来」跟「他忘了按」在资料库里长得一样，
 *    而**把忘了按当成没来，会让每一个熟客都变成跑掉的客人**。
 *
 * ③ 🔴 **单据含收起来的。** 抄那一页自己写下的理由，一字不改：
 *    一件做完收档的工作，还是来过一次。
 *
 * ── 而「他平常隔多久」是这一支真正的产出 ──────────────────────────────
 *
 * [任务 220](#220) 立过一条：**不发明天数** —— 三十天六十天都是别人的惯例，
 * 不是他跟客人讲好的话。所以这一栏算的是**他自己的历史**：
 * 相异的日子两两之间的间隔，取**中位数**（不是平均 —— 一次隔了一年半，
 * 平均会被那一次拖走，而「平常」讲的正好不是那一次）。
 *
 * 🔴 **来过少於三天就不给（null）** —— 两天只有一个间隔，而一个间隔不是习惯。
 * 这一条不只是统计上的讲究：它同时是这个讯号**不用写死行业**的原因。
 * 一个三年前做过一次装修的客人没有节奏，所以他永远不会被报成「跑掉了」；
 * 一个来了八次、每六个礼拜一次的沙龙客人有节奏。
 * **节奏是量出来的，不是我照行业列出来的。**
 *
 * ⚠️ 它还不是什么：
 *   · **不管钱** —— `works_here`，前台要知道「这位是熟客」，而这一支
 *     一个金额都没有回。「他一共给了我多少」是另一件事（`sees_money`）
 *   · **不认得「同一个人两张名册」** —— 一个客人建了两次，这里就是两个人
 *   · **不看服务的种类** —— 洗剪吹跟染发都算来过一次
 */

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

-- 学生自己撞堂 —— 用挡老师那一条一模一样的查询,换成学生。
--
-- ── 为什么（[任务 341] 便宜又值钱那一组）───────────────────────────────
--
-- 老师撞堂今天已经挡住了：一堂课的 `appointments` 那一行带着
-- `staff_id`,跟别的预约共用同一条排他约束（20260902030000）。
-- **而学生不是那样存的**——一堂课的那一行只带着 `group_id`,
-- 学生是透过 `class_members` 连过去的（一个学生可以在好几个班里）。
-- 所以「阿明星期三四点在数学班,同时又在英文班」这种撞法,
-- 资料库那条排他约束一个字都管不到,而今天没有任何地方查过这件事。
--
-- ── 讯号，不是墙——跟 [重点 31] 同一条 ──────────────────────────────────
--
-- 不是在报名那一刻拦住她（收紧最危险，而且报名跟排课本来就是两件事——
-- 报名的时候这堂课可能还没排定几点）。这一支只回答一句话：
-- **现在排定的课表里，谁跟谁撞了。** 柜台开学期表的时候查一次就好。
--
-- 只看**还没发生、没有取消**的那几堂——过去撞过的堂已经上完了，
-- 查那个没有用；查的是「接下来这样排会不会出事」。

create or replace function public.class_schedule_clashes(in_project_id uuid)
returns table (
  party_id uuid,
  name text,
  class_a text,
  class_b text,
  session_a timestamptz,
  session_b timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m1.party_id,
    d.name,
    g1.name,
    g2.name,
    a1.starts_at,
    a2.starts_at
  from public.class_members m1
  join public.class_members m2
    on m2.party_id = m1.party_id
   and m2.group_id <> m1.group_id
  join public.class_groups g1 on g1.id = m1.group_id
  join public.class_groups g2 on g2.id = m2.group_id
  join public.appointments a1
    on a1.group_id = m1.group_id
   and a1.archived_at is null
   and a1.status = 'booked'
   and a1.starts_at > now()
  join public.appointments a2
    on a2.group_id = m2.group_id
   and a2.archived_at is null
   and a2.status = 'booked'
   and a2.starts_at > now()
   /* 时间真的重叠——同一堂课自己跟自己不算，两个方向只留一次。 */
   and tstzrange(a2.starts_at, a2.ends_at) && tstzrange(a1.starts_at, a1.ends_at)
  join public.directory_entries d on d.id = m1.party_id
  where g1.project_id = in_project_id
    and g2.project_id = in_project_id
    and m1.left_on is null
    and m2.left_on is null
    and g1.archived_at is null
    and g2.archived_at is null
    /* 只留一个方向（A 的编号排在 B 前面），不然一撞报两条一模一样的。 */
    and m1.group_id < m2.group_id
    and public.works_here(in_project_id)
  order by a1.starts_at;
$$;

revoke execute on function public.class_schedule_clashes(uuid) from public, anon;
grant execute on function public.class_schedule_clashes(uuid) to authenticated;

comment on function public.class_schedule_clashes(uuid) is
  'Which students are enrolled in two classes whose upcoming, still-booked sessions overlap -- the same overlap check the staff exclusion constraint already does, done here for students because they only connect to a session through class_members, not through appointments.staff_id. A signal for whoever builds the timetable, not a write-time block. See 20260910520000.';

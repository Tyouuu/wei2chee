-- 放回去——原样从 20260910520000 抽出来，不是重打。
-- ⚠️ 拿掉这一句实测没有红——底下 class_members / class_groups / appointments /
-- directory_entries 自己的 RLS 已经在挡（跟这支函式同一个身分呼叫底下那几张表，
-- 不像 stock_on_hand 那支视图会绕过去）。放回来是保留同一个仓库的一贯写法——
-- 每一支都自己讲一次 works_here，不靠别人替它挡，看得懂这一支在保护什么，
-- 不是靠这一句才不漏。看过 20260910530000（拿掉之后没有变红）。

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

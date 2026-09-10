-- 🔴 故意弄坏：拿掉 works_here 那一句，看 check:class-clashes 红不红。
-- 单独推这一支，看过红了再用 20260910540000 原样放回去（不是重打）。

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
  order by a1.starts_at;
$$;

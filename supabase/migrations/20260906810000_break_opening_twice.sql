-- 🔴 故意弄坏：开过了照样再开一堂。
-- **单独推一次**（重点 31 第三条）。下一支 20260906820000 原样搬回去。
--
-- 它该红的那两条是 `check:timetable` 的④：
--   · 🔴 按两下还是同一堂
--   · 🔴 表上只有一行
-- —— 而一间补习中心的前台就是会按两下的地方，
-- 而多出来那一堂会分走一半的点名。

create or replace function public.open_lesson(
  in_group_id uuid,
  in_on date,
  in_module_key text default 'bookings'
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  slot public.class_slots;
  existing public.appointments;
  made public.appointments;
  grp public.class_groups;
  made_id uuid;
begin
  select g.* into grp from public.class_groups g where g.id = in_group_id;
  if grp.id is null then
    raise exception 'that class does not exist';
  end if;
  owner_project := grp.project_id;
  if not public.works_here(owner_project) then
    raise exception 'that project is not yours';
  end if;
  if grp.archived_at is not null then
    raise exception 'that class is closed';
  end if;

  /* 🔴 已经开了就还他同一堂 —— 他在柜台按两下，不该长出第二堂。 */
  select a.* into existing
  from public.appointments a
  where a.group_id = in_group_id
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date = in_on
    and a.status <> 'cancelled'
  order by a.starts_at
  limit 1;
  /* 🔴 弄坏：已经开了照样再开一堂。 */

  select s.* into slot
  from public.class_slots s
  where s.group_id = in_group_id
    and s.weekday = extract(dow from in_on)::smallint
    and (s.from_on is null or in_on >= s.from_on)
    and (s.until_on is null or in_on <= s.until_on)
  order by s.starts_at
  limit 1;
  if slot.id is null then
    raise exception 'that class does not run on that day — set its timetable, or add the lesson by hand';
  end if;

  made_id := public.add_appointment(
    in_project_id => owner_project,
    in_module_key => in_module_key,
    in_starts_at => (in_on + slot.starts_at) at time zone 'Asia/Kuala_Lumpur',
    in_ends_at => (in_on + slot.ends_at) at time zone 'Asia/Kuala_Lumpur',
    in_staff_id => grp.staff_id,
    in_service => grp.name,
    in_group_id => in_group_id
  );
  select a.* into made from public.appointments a where a.id = made_id;
  return made;
end;
$$;


grant execute on function public.open_lesson(uuid, date, text) to authenticated;

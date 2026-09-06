-- 把 20260906810000 弄坏的那一句搬回去。
--
-- 🔴 而弄坏那一次教了我一件我本来写错的事：
--   我以为它守的是「按两下」。**不是** ——
--   同一个时间本来就被 20260902030000 那条不准撞的约束挡着
--   （而它对没写老师的班是跟**整间店**比）——
--   按第二下拿到的是一句报错，不是多一堂。
--
-- 🔴 它真正在护的是另一种，而那一种天天发生：
--   **他把这一星期三那一堂从五点挪到七点**，
--   然后某一个人又按了一次「开这一堂」。
--   弄坏那一次红出来就是那一句：**同一天 2 堂** ——
--   而那一天的点名会分成两半。
--
-- ⚠️ 尺子那一边跟着改了：④b 量的不再是「按两下」，
--   是「挪过之后再按一次」。
--
-- ⚠️ 从 20260906800000 原样搬回来。

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
  if existing.id is not null then
    return existing;
  end if;

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

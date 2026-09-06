-- 「每个礼拜三四点」—— 一个班的课表。
--
-- `walk:tuition`（[任务 239](#239)）的收尾写着：
--   🔴 不会自己排下个礼拜那一堂 —— 每一堂课今天要他自己排。
--
-- 一间补习中心一个礼拜十几堂课，一堂一堂排，一个月就是六十次动手
-- （[重点 29](../docs/founder-points.md)：能不要他打的就不要他打）。
--
-- ---------------------------------------------------------------------------
-- 🔴 存的是「每个礼拜三四点」，不是那五十二堂课
-- ---------------------------------------------------------------------------
-- 最省事的做法是按下去生成一整年 —— 一份一年五十二堂的课表。
-- 它有两个毛病，而第二个是真的会咬人的那一个：
--   · 五十二行他从来没看过的东西
--   · 🔴 **他把四点改成五点那一天，那五十二行全部过期**，
--     而画面上没有任何东西会讲。ERPNext 的保养排程就是这个形状
--     （按一颗按钮展开出每一个日子），而 [任务 152](#152) 已经判过一次不抄。
--
-- 所以跟这个 schema 判过十三次的同一条：**算出来的，不是存起来的**
-- （架上几件 · 过期 · 帐龄 · 里程 · 批号剩几件 · 保养到期日 …）。
--
-- ---------------------------------------------------------------------------
-- 🔴 而一堂课要点名，就必须有一行
-- ---------------------------------------------------------------------------
-- 这一件跟上面那几件不一样：`class_attendance` 挂在一行预约上。
-- 所以「开出来」是一个真的动作 —— 而它**幂等**：
-- 同一个班同一天按两次，拿回来的是同一堂。
--
-- 而且它走的是**人按的那一支** `add_appointment`（[重点 23](../docs/founder-points.md)）——
-- 不准撞、班级上限、来源、防重复，四样都住在那里面。
--
-- ⚠️ 三件故意不做：
--   · **假期表** —— 一个要先填完假期才排得了课的功能，
--     违反「一进来就很方便」。那一堂他不开就是了
--   · **自动开** —— 没有排程，也不该有：一个自己往他资料库里
--     写东西的排程，坏掉的那一天没有人知道
--   · **每两个礼拜一次** —— 补习是一个礼拜几堂，不是隔周。
--     真的有人要，那是 `every_weeks` 一栏，不是重做

-- ---------------------------------------------------------------------------
-- 1. 课表
-- ---------------------------------------------------------------------------
create table if not exists public.class_slots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.class_groups(id) on delete cascade,

  -- 0 = 星期日 …… 6 = 星期六，跟 `staff_hours` 同一套数法。
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null check (ends_at > starts_at),

  -- 学期起迄。两个都可以不填 —— 一间补习中心的班常常是长期的，
  -- 而一个逼他填学期的表单，是一个他还没想过的决定。
  from_on date,
  until_on date,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint class_slots_term_reads_forwards
    check (from_on is null or until_on is null or until_on >= from_on)
);

create index if not exists class_slots_group_idx
  on public.class_slots (group_id, weekday);

alter table public.class_slots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'class_slots'
      and policyname = 'class_slots_read'
  ) then
    create policy class_slots_read on public.class_slots
      for select using (public.works_here(project_id));
  end if;
end $$;

/* 那一行不准换一个班（换班就是换了一间公司的可能）。
   ⚠️ 而 UPDATE 那一支**不再问「这一家是不是你的」** ——
   cascade 删一个使用者的时候没有登入身分，那一问会把整句删除挡下来
   （20260906390000 付过一次学费）。 */
create or replace function public.class_slots_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  if tg_op = 'UPDATE' then
    if new.group_id is distinct from old.group_id then
      raise exception 'a lesson slot cannot move to another class';
    end if;
    return new;
  end if;

  select g.project_id into owner_project
  from public.class_groups g where g.id = new.group_id;
  if owner_project is null then
    raise exception 'that class does not exist';
  end if;
  if not public.works_here(owner_project) then
    raise exception 'that project is not yours';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

drop trigger if exists class_slots_guard on public.class_slots;
create trigger class_slots_guard
  before insert or update on public.class_slots
  for each row execute function public.class_slots_guard();

-- ---------------------------------------------------------------------------
-- 2. 写课表 —— 整批换，跟 `set_staff_hours` 同一个形状
-- ---------------------------------------------------------------------------
-- 一个班的课表是**一句完整的话**（「一三五四点到六点」），
-- 而不是一条一条加的东西。整批换是对的。
create or replace function public.set_class_slots(
  in_group_id uuid,
  in_slots jsonb default '[]'::jsonb
)
returns setof public.class_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  s jsonb;
  wd smallint;
  a time;
  b time;
begin
  select g.project_id into owner_project
  from public.class_groups g where g.id = in_group_id;
  if owner_project is null then
    raise exception 'that class does not exist';
  end if;
  if not public.works_here(owner_project) then
    raise exception 'that project is not yours';
  end if;

  delete from public.class_slots where group_id = in_group_id;

  for s in select * from jsonb_array_elements(coalesce(in_slots, '[]'::jsonb))
  loop
    wd := (s ->> 'weekday')::smallint;
    a := (s ->> 'starts_at')::time;
    b := (s ->> 'ends_at')::time;
    if wd is null or a is null or b is null then
      raise exception 'a lesson needs a day, a start and an end';
    end if;
    if b <= a then
      raise exception 'a lesson has to end after it starts';
    end if;
    insert into public.class_slots (
      group_id, weekday, starts_at, ends_at, from_on, until_on, created_by
    )
    values (
      in_group_id, wd, a, b,
      nullif(s ->> 'from_on', '')::date,
      nullif(s ->> 'until_on', '')::date,
      auth.uid()
    );
  end loop;

  return query
  select * from public.class_slots
  where group_id = in_group_id
  order by weekday, starts_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 接下来那几堂 —— 算出来的
-- ---------------------------------------------------------------------------
-- `lesson_id` 不是 null 就表示那一堂**已经开出来了**（点得了名）。
create or replace function public.lessons_due(
  in_project_id uuid,
  in_from date default null,
  in_until date default null
)
returns table (
  group_id uuid,
  class_name text,
  staff_id uuid,
  staff_name text,
  on_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  /* 已经开出来的那一堂。null = 还没开。 */
  lesson_id uuid,
  /* 那一堂点过名没有 —— 开出来了不等於点过。 */
  marked integer,
  seats_taken bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d_from date := coalesce(in_from, public.today_myt());
  d_until date := coalesce(in_until, public.today_myt() + 14);
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  if d_until < d_from then
    raise exception 'the window ends before it starts';
  end if;
  /* 跟 `due_visits` 同一条：窗口开太宽，等於叫资料库算一整年的课
     然后丢掉大半，而那也不是任何人读得完的一份清单。 */
  if d_until - d_from > 120 then
    raise exception 'ask for at most about four months at a time';
  end if;

  return query
  with days as (
    select generate_series(d_from, d_until, interval '1 day')::date as on_date
  ),
  planned as (
    select s.group_id, g.name as class_name, g.staff_id,
           d.on_date, s.starts_at as t_from, s.ends_at as t_to
    from public.class_slots s
    join public.class_groups g on g.id = s.group_id
    join days d
      on extract(dow from d.on_date)::smallint = s.weekday
    where s.project_id = in_project_id
      and g.archived_at is null
      and (s.from_on is null or d.on_date >= s.from_on)
      and (s.until_on is null or d.on_date <= s.until_on)
  )
  select p.group_id, p.class_name, p.staff_id,
         coalesce(d.name, ''),
         p.on_date,
         (p.on_date + p.t_from) at time zone 'Asia/Kuala_Lumpur',
         (p.on_date + p.t_to) at time zone 'Asia/Kuala_Lumpur',
         a.id,
         (select count(*)::integer from public.class_attendance t
           where t.appointment_id = a.id),
         (select count(*) from public.class_members m
           where m.group_id = p.group_id and m.left_on is null)
  from planned p
  left join public.directory_entries d on d.id = p.staff_id
  /* 那一天那个班已经有一堂了吗 —— 时间对不上也算（他手动挪过）。 */
  left join public.appointments a
    on a.group_id = p.group_id
   and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date = p.on_date
   and a.status <> 'cancelled'
  order by p.on_date, p.t_from;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 把那一堂开出来 —— 一次，幂等
-- ---------------------------------------------------------------------------
-- 🔴 走的是**人按的那一支** `add_appointment`：不准撞、来源、防重复
-- 全部住在那里面（[重点 23](../docs/founder-points.md)）。
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

  select a.* into made
  from public.appointments a
  where a.id = public.add_appointment(
    in_project_id => owner_project,
    in_module_key => in_module_key,
    in_starts_at => (in_on + slot.starts_at) at time zone 'Asia/Kuala_Lumpur',
    in_ends_at => (in_on + slot.ends_at) at time zone 'Asia/Kuala_Lumpur',
    in_staff_id => grp.staff_id,
    in_service => grp.name,
    in_group_id => in_group_id
  );
  return made;
end;
$$;

grant execute on function public.set_class_slots(uuid, jsonb) to authenticated;
grant execute on function public.lessons_due(uuid, date, date) to authenticated;
grant execute on function public.open_lesson(uuid, date, text) to authenticated;

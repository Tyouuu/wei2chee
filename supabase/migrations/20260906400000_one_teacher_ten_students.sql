-- 一个老师十个学生 —— 补习那一行今天**用不了**这个产品。
--
-- 🔴 不是少一个功能，是那张表主动挡着他:
--   一堂十个学生的课，照今天的做法要开十行预约，同一个老师同一个钟头 ——
--   而 20260902030000 那条「同一个人同一个时间只准一次」的约束
--   会把第二行到第十行**全部拒绝**。那条约束没有错，错的是把一堂课
--   当成十次预约。
--
-- ── 先去读别人真的表（重点 26）──────────────────────────────────────
-- `frappe/education` 的三份 doctype 原文（不是读首页）:
--
--   Student Group    16 栏，必填 3: academic_year · group_based_on · 名字
--                    另外有 max_strength（人数上限）跟 students 子表
--   Course Schedule  16 栏，必填 6: student_group · instructor · course ·
--                    room · from_time · to_time
--   Student Attendance 12 栏，必填 3: student · date · status
--                    （它指着 course_schedule，一个学生一堂课一行）
--
-- 拿三样:
--   1. **名册是一个会留着的东西**（Student Group）——「中四数学 · 星期三班」
--      每个礼拜是同一批孩子。没有它，他每一堂课要重打八个名字
--      （[重点 29](./founder-points.md)：量他要打几个字）
--   2. **一堂课指着名册 ＋ 老师 ＋ 时间**（Course Schedule）——
--      🔴 **而那正好就是我们的一行预约**。所以这一支**不建第二张课表**，
--      只在预约上多一栏指着那个班
--   3. **点名是一个学生一堂课一行**（Student Attendance）——
--      「谁来了」只有人知道，算不出来，所以它是一张表
--
-- 不拿的，每一条带理由（[重点 7d-2](./founder-points.md)：挑最简单那一版）:
--   · academic_year · academic_term · program · batch · course · naming_series
--     —— 怡保一间补习中心一样都没有，而每一样都是**第一堂课之前要先填完的表**
--   · room（教室）—— 一间店一个房间；哪天有两间再说
--   · group_based_on（按课/按班/按活动分）—— 那是一间学校的结构，不是他的
--   · instructor 那张自己的表 —— 我们的老师本来就在他的师傅名册上，
--     再开一张人名表就是同一批脸两份清单（这个仓库栽过八次）
--
-- ── 🔴 那条不准撞的约束一个字都不动 ────────────────────────────────
-- 一堂课是**一行**预约，一个老师 —— 所以「同一个老师同一个钟头只准一堂」
-- 照旧成立，而且那正是补习中心要的。约束从来没有错。
--
-- ⚠️ 而它答不了一件，写下来不要当成漏掉:
-- **一个学生同时被排进两个班**，这一支不挡。名册是长期的、课是每个礼拜的，
-- 要挡就得把两个班以后每一堂课都比一次 —— 而 ERPNext 自己也不挡。

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  module_key text not null,

  -- 他自己的词：「中四数学 · 星期三 4pm」「瑜伽初级班」。
  name text not null check (btrim(name) <> '' and length(name) <= 120),

  -- 谁教。**指他自己的师傅名册**，不是另开一张人名表。
  staff_id uuid references public.directory_entries(id) on delete restrict,

  -- 🔴 人数上限（ERPNext 的 max_strength）。**可以不填** ——
  -- 一个还没想过上限的班不该被逼着先想一个数字。
  -- 填了之后「这个班满了没有」才是一句答得出来的话，
  -- 而那正是家长打电话来问的那一句。
  capacity integer check (capacity is null or (capacity > 0 and capacity <= 500)),

  note text not null default '',

  -- 从来不删。去年那个班是「这个学生跟我们多久了」的答案。
  archived_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_groups enable row level security;

-- 谁在这个班。
create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.class_groups(id) on delete cascade,

  -- 学生。**指同一本客户名册** —— 一个补习中心的学生就是它的客户。
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  joined_on date not null default public.today_myt(),
  -- 离开了不删，留着 —— 「他上过我们的课」是真的。
  left_on date,

  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint class_members_one_seat unique (group_id, party_id)
);

alter table public.class_members enable row level security;

-- 谁来了。一个学生一堂课一行（ERPNext 的 Student Attendance）。
create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- 哪一堂课 —— **就是那一行预约**。
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  -- 🔴 跟预约那一栏用同一个词（no_show）—— 同一件事在两个地方两个名字，
  -- 是这个仓库最常犯的那个错的另一张脸。
  status text not null default 'came'
    check (status in ('came', 'no_show', 'excused')),

  note text not null default '',
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint class_attendance_one_per_student unique (appointment_id, party_id)
);

alter table public.class_attendance enable row level security;


-- ⚠️ 三支守卫全部用**修好之后**的那个形状（20260906390000）:
-- 修改的时候不问「这一家是不是你的」，问「这一行有没有换过一家」——
-- 不然删一个老师的时候，`created_by` 要被设成空，那一次修改会把
-- **整句删除**挡下来，而画面上只看得到一句「帐号删不掉」。
create or replace function public.class_rows_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'that row cannot move to another project';
    end if;
    new.updated_at := now();
    return new;
  end if;
  if not public.works_here(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

drop trigger if exists class_groups_guard on public.class_groups;
create trigger class_groups_guard
  before insert or update on public.class_groups
  for each row execute function public.class_rows_own_project();

drop trigger if exists class_attendance_guard on public.class_attendance;
create trigger class_attendance_guard
  before insert or update on public.class_attendance
  for each row execute function public.class_rows_own_project();

/* `class_members` 没有 updated_at，所以它用自己那一支。 */
create or replace function public.class_members_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'that row cannot move to another project';
    end if;
    return new;
  end if;
  if not public.works_here(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

drop trigger if exists class_members_guard on public.class_members;
create trigger class_members_guard
  before insert or update on public.class_members
  for each row execute function public.class_members_own_project();

/* 🔴 老师看得到自己的班跟点名 —— 那是他一天的工作，不是钱。
   这三张表上一分钱都没有（学费在收款那一边）。 */
drop policy if exists class_groups_read on public.class_groups;
create policy class_groups_read on public.class_groups
  for select using (public.works_here(project_id));

drop policy if exists class_members_read on public.class_members;
create policy class_members_read on public.class_members
  for select using (public.works_here(project_id));

drop policy if exists class_attendance_read on public.class_attendance;
create policy class_attendance_read on public.class_attendance
  for select using (public.works_here(project_id));

create index if not exists class_groups_live_idx
  on public.class_groups (project_id, archived_at, name);
create index if not exists class_members_group_idx
  on public.class_members (group_id, left_on);
create index if not exists class_attendance_session_idx
  on public.class_attendance (appointment_id);


-- 🔴 一堂课是**一行预约**，指着那个班。
alter table public.appointments
  add column if not exists group_id uuid references public.class_groups(id) on delete set null;

comment on column public.appointments.group_id is
  'A class session points at its roster. One row, one teacher, one slot -- so the no-double-booking constraint still means what it always meant. See 20260906400000.';

create index if not exists appointments_group_idx
  on public.appointments (group_id) where group_id is not null;


-- ── 开一个班 ──────────────────────────────────────────────────────────
create or replace function public.add_class_group(
  in_project_id uuid,
  in_module_key text,
  in_name text,
  in_staff_id uuid default null,
  in_capacity integer default null,
  in_note text default ''
)
returns public.class_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.class_groups;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  if not public.is_calendar_module(in_module_key) then
    raise exception 'a class lives on the bookings page, not on %', in_module_key;
  end if;
  if nullif(btrim(coalesce(in_name, '')), '') is null then
    raise exception 'a class needs a name he can recognise';
  end if;
  if in_staff_id is not null
     and not exists (
       select 1 from public.directory_entries d
       where d.id = in_staff_id and d.project_id = in_project_id
     ) then
    raise exception 'that teacher is not in this book';
  end if;

  insert into public.class_groups (
    project_id, module_key, name, staff_id, capacity, note, created_by
  )
  values (
    in_project_id, in_module_key, left(btrim(in_name), 120), in_staff_id,
    in_capacity, btrim(coalesce(in_note, '')), auth.uid()
  )
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.add_class_group(uuid, text, text, uuid, integer, text)
  from public, anon;
grant execute on function public.add_class_group(uuid, text, text, uuid, integer, text)
  to authenticated;


create or replace function public.update_class_group(
  in_group_id uuid,
  in_name text default null,
  in_staff_id uuid default null,
  in_clear_staff boolean default false,
  in_capacity integer default null,
  in_clear_capacity boolean default false,
  in_note text default null,
  in_archived boolean default null
)
returns public.class_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.class_groups;
  seated integer;
begin
  select * into row from public.class_groups where id = in_group_id;
  if not found then
    raise exception 'no such class';
  end if;
  if not public.works_here(row.project_id) then
    raise exception 'that project is not yours';
  end if;

  /* 🔴 上限不可以调到比已经在里面的人还少 —— 那会让一个班
     **在画面上是超收的**，而没有任何东西讲得出多了几个。 */
  if not in_clear_capacity and in_capacity is not null then
    select count(*) into seated
    from public.class_members m
    where m.group_id = in_group_id and m.left_on is null;
    if seated > in_capacity then
      raise exception 'there are already % in that class', seated;
    end if;
  end if;

  if in_staff_id is not null
     and not exists (
       select 1 from public.directory_entries d
       where d.id = in_staff_id and d.project_id = row.project_id
     ) then
    raise exception 'that teacher is not in this book';
  end if;

  update public.class_groups
     set name = coalesce(nullif(btrim(coalesce(in_name, '')), ''), name),
         staff_id = case when in_clear_staff then null
                         else coalesce(in_staff_id, staff_id) end,
         capacity = case when in_clear_capacity then null
                         else coalesce(in_capacity, capacity) end,
         note = coalesce(in_note, note),
         archived_at = case
           when in_archived is null then archived_at
           when in_archived then coalesce(archived_at, now())
           else null
         end
   where id = in_group_id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.update_class_group(uuid, text, uuid, boolean, integer, boolean, text, boolean)
  from public, anon;
grant execute on function public.update_class_group(uuid, text, uuid, boolean, integer, boolean, text, boolean)
  to authenticated;


-- ── 谁在这个班 ────────────────────────────────────────────────────────
create or replace function public.enrol_in_class(
  in_group_id uuid,
  in_party_id uuid
)
returns public.class_members
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.class_members;
  grp public.class_groups;
  seated integer;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if not found then
    raise exception 'no such class';
  end if;
  if not public.works_here(grp.project_id) then
    raise exception 'that project is not yours';
  end if;
  if grp.archived_at is not null then
    raise exception 'that class is closed';
  end if;
  if not exists (
       select 1 from public.directory_entries d
       where d.id = in_party_id and d.project_id = grp.project_id
     ) then
    raise exception 'that person is not in this book';
  end if;

  /* 已经在里面（包括离开过又回来）—— 把原本那一行还回来，不开第二个位子。 */
  select * into row from public.class_members
  where group_id = in_group_id and party_id = in_party_id;
  if found then
    if row.left_on is not null then
      update public.class_members set left_on = null, joined_on = public.today_myt()
       where id = row.id
      returning * into row;
    end if;
    return row;
  end if;

  /* 🔴 满了就讲出来，而且讲得出上限是多少 ——
     「这个班满了」是家长打电话来问的那一句，
     而一个静静收下第十一个人的系统会让他排一张坐不下的课表。 */
  if grp.capacity is not null then
    select count(*) into seated
    from public.class_members m
    where m.group_id = in_group_id and m.left_on is null;
    if seated >= grp.capacity then
      raise exception 'that class is full - it takes %', grp.capacity;
    end if;
  end if;

  insert into public.class_members (project_id, group_id, party_id, added_by)
  values (grp.project_id, in_group_id, in_party_id, auth.uid())
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.enrol_in_class(uuid, uuid) from public, anon;
grant execute on function public.enrol_in_class(uuid, uuid) to authenticated;


/* 走了。**不删** —— 他上过我们的课是真的，而去年那一班是
   「这个学生跟我们多久了」的答案。 */
create or replace function public.leave_class(
  in_group_id uuid,
  in_party_id uuid
)
returns public.class_members
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.class_members;
begin
  select * into row from public.class_members
  where group_id = in_group_id and party_id = in_party_id;
  if not found then
    raise exception 'that person is not in that class';
  end if;
  if not public.works_here(row.project_id) then
    raise exception 'that project is not yours';
  end if;

  update public.class_members
     set left_on = coalesce(left_on, public.today_myt())
   where id = row.id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.leave_class(uuid, uuid) from public, anon;
grant execute on function public.leave_class(uuid, uuid) to authenticated;


create or replace function public.class_roster(in_group_id uuid)
returns table (
  party_id uuid,
  name text,
  joined_on date,
  left_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if not found or not public.works_here(grp.project_id) then
    return;
  end if;

  return query
  select m.party_id, coalesce(d.name, ''), m.joined_on, m.left_on
  from public.class_members m
  join public.directory_entries d on d.id = m.party_id
  where m.group_id = in_group_id
  order by (m.left_on is not null), d.name;
end;
$$;

revoke execute on function public.class_roster(uuid) from public, anon;
grant execute on function public.class_roster(uuid) to authenticated;


-- ── 点名 ──────────────────────────────────────────────────────────────
/* ⚠️ **不要求他在名册上** —— 一个来试听的学生是真的，
   而拒绝替他点名等於逼老师在上课前先去开一个学籍。
   要求的只有一样：那个人在这一家的名册里。 */
create or replace function public.mark_attendance(
  in_appointment_id uuid,
  in_party_id uuid,
  in_status text default 'came',
  in_note text default ''
)
returns public.class_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.class_attendance;
  appt public.appointments;
  st text;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if not found then
    raise exception 'no such session';
  end if;
  if not public.works_here(appt.project_id) then
    raise exception 'that project is not yours';
  end if;
  if appt.kind <> 'booking' then
    raise exception 'that is blocked-off time, not a class';
  end if;

  st := lower(btrim(coalesce(in_status, 'came')));
  if st not in ('came', 'no_show', 'excused') then
    raise exception 'say whether they came, did not come, or were excused';
  end if;
  if not exists (
       select 1 from public.directory_entries d
       where d.id = in_party_id and d.project_id = appt.project_id
     ) then
    raise exception 'that person is not in this book';
  end if;

  insert into public.class_attendance (
    project_id, appointment_id, party_id, status, note, marked_by
  )
  values (
    appt.project_id, in_appointment_id, in_party_id, st,
    btrim(coalesce(in_note, '')), auth.uid()
  )
  on conflict (appointment_id, party_id) do update
    set status = excluded.status,
        note = excluded.note,
        marked_by = excluded.marked_by
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.mark_attendance(uuid, uuid, text, text) from public, anon;
grant execute on function public.mark_attendance(uuid, uuid, text, text) to authenticated;


/* 这一堂课要点的名单 —— **名册 ＋ 已经点过的**，一次回来。
   🔴 点过的那一栏空着的时候是「**还没点**」，不是「没来」。
   两句话不一样，而画成同一个样子正是这个仓库讲过很多次的那个错。 */
create or replace function public.class_attendance_of(in_appointment_id uuid)
returns table (
  party_id uuid,
  name text,
  on_roster boolean,
  status text,
  note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  appt public.appointments;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if not found or not public.works_here(appt.project_id) then
    return;
  end if;

  return query
  with roster as (
    select m.party_id
    from public.class_members m
    where appt.group_id is not null
      and m.group_id = appt.group_id
      and m.left_on is null
  ),
  marked as (
    select a.party_id, a.status, a.note
    from public.class_attendance a
    where a.appointment_id = in_appointment_id
  ),
  everyone as (
    select r.party_id from roster r
    union
    select k.party_id from marked k
  )
  select e.party_id,
         coalesce(d.name, ''),
         exists (select 1 from roster r where r.party_id = e.party_id),
         k.status,
         coalesce(k.note, '')
  from everyone e
  join public.directory_entries d on d.id = e.party_id
  left join marked k on k.party_id = e.party_id
  order by d.name;
end;
$$;

revoke execute on function public.class_attendance_of(uuid) from public, anon;
grant execute on function public.class_attendance_of(uuid) to authenticated;


create or replace function public.class_groups_of(in_project_id uuid)
returns table (
  id uuid,
  name text,
  staff_id uuid,
  staff_name text,
  capacity integer,
  seats_taken bigint,
  archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;

  return query
  select g.id, g.name, g.staff_id, coalesce(s.name, ''), g.capacity,
         (select count(*) from public.class_members m
           where m.group_id = g.id and m.left_on is null),
         g.archived_at
  from public.class_groups g
  left join public.directory_entries s on s.id = g.staff_id
  where g.project_id = in_project_id
  order by (g.archived_at is not null), g.name;
end;
$$;

revoke execute on function public.class_groups_of(uuid) from public, anon;
grant execute on function public.class_groups_of(uuid) to authenticated;


-- ── 一堂课就是一行预约 ────────────────────────────────────────────────
-- ⚠️ 签名变了（多一个参数）**一定要先 drop** —— 多一个有预设的参数
-- 对呼叫端相容、对资料库不相容，加了不 drop 那支函式整个选不到，
-- 而画面上跟「功能坏了」一模一样（[重点 31](./founder-points.md) 第二条，
-- 2026-09-05 才踩过一次）。
--
-- ⚠️ 而下面这一支是从 20260902030000 —— **最后一次定义它的那个档案** ——
-- 原样抽出来改两处，不是照记忆重打（同一条第一项，被咬过三次）。
drop function if exists public.add_appointment(uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid);

create or replace function public.add_appointment(
  in_project_id uuid,
  in_module_key text,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_kind text default 'booking',
  in_source text default 'staff',
  in_note text default '',
  in_branch_id uuid default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_group_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  grp public.class_groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_calendar_module(in_module_key) then
    raise exception 'not a calendar module: %', in_module_key;
  end if;

  if in_starts_at is null or in_ends_at is null then
    raise exception 'an appointment needs a time';
  end if;

  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;

  /* 🔴 改的第一处：一堂课要指得到一个真的班，而且是这一家的。 */
  if in_group_id is not null then
    select * into grp from public.class_groups where id = in_group_id;
    if not found or grp.project_id <> in_project_id then
      raise exception 'no such class';
    end if;
    if grp.archived_at is not null then
      raise exception 'that class is closed';
    end if;
  end if;

  /* A BOOKING IS FOR SOMEBODY; A BLOCK IS NOT. Lunch has no customer, and
     demanding one would make the owner type a name to close his own shop.

     🔴 改的第二处：**一堂课的「是给谁的」写在名册上。**
     一个补习老师不该为了排一堂十个人的课，先在这一格打一个人的名字 ——
     打了反而是错的:那一行会看起来像是给那一个学生的。 */
  if coalesce(in_kind, 'booking') = 'booking'
     and in_group_id is null
     and btrim(coalesce(in_party, '')) = ''
     and in_party_id is null then
    raise exception 'a booking needs to say who it is for';
  end if;

  insert into public.appointments (
    project_id, module_key, branch_id, kind, starts_at, ends_at,
    party, party_id, staff_id, service, source, note, extra,
    recorded_by, idempotency_key, group_id
  ) values (
    in_project_id, in_module_key, in_branch_id,
    coalesce(nullif(btrim(coalesce(in_kind, '')), ''), 'booking'),
    in_starts_at, in_ends_at,
    left(btrim(coalesce(in_party, '')), 120), in_party_id,
    /* 没讲老师的时候，用那个班自己的老师 —— 他已经讲过一次了
       （[重点 29](./founder-points.md)：能不打就不要他打）。 */
    coalesce(in_staff_id, grp.staff_id), left(btrim(coalesce(in_service, '')), 120),
    coalesce(nullif(btrim(coalesce(in_source, '')), ''), 'staff'),
    btrim(coalesce(in_note, '')),
    coalesce(in_extra, '{}'::jsonb),
    auth.uid(), in_idempotency_key, in_group_id
  )
  returning id into new_id;

  return new_id;

exception
  /* Pressing twice on a slow phone gives back the booking that exists. The
     tail 20260831080000 dropped and 20260831090000 had to put back. */
  when unique_violation then
    select id into new_id
    from public.appointments
    where project_id = in_project_id
      and in_idempotency_key is not null
      and idempotency_key = in_idempotency_key
    limit 1;
    return new_id;

  /* 🔴 THE ONE THIS TABLE EXISTS FOR, and it must not reach a person as
     「conflicting key value violates exclusion constraint」. That sentence
     teaches a salon owner nothing he can act on. */
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.add_appointment(uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid)
  from public, anon;
grant execute on function public.add_appointment(uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid)
  to authenticated;

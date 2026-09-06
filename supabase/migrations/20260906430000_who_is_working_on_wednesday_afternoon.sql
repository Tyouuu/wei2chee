-- 排班 —— 而它要答的只有一句：**「客人要星期三下午，谁有空？」**
--
-- ── 🔴 先讲清楚它跟 20260902030000 那个决定的关系 ────────────────────
-- 那一支明写着**不拿** easyappointments 的整套 availability engine
-- （working plans · breaks · holiday lists · 同步 · 验证信），理由是:
--     「every one of those is a setting somebody has to fill in
--      **before the first booking can exist**」
--
-- **那一条没有被推翻，而这一支不违反它** —— 差别就在那个 before:
--   · 一行都不填 → **今天的行为一个字都不变**（每一个人随时都算有空）
--   · 填了才开始有意义
-- 一个新客户第一天照旧不用碰任何设定（[重点 7h](./founder-points.md)：
-- 上一个来源给的东西不可以被后一个推翻）。
--
-- ── 坐到那个沙龙老板的椅子上（[重点 32](./founder-points.md)）─────────
-- 三张椅子的老板，一天里真的会问的四句:
--   1. 「今天谁上班」      —— 他看得到人，不用系统答
--   2. 「Ah Girl 请假」    —— **已经做得到了**（挡起来的时段，同一张表里）
--   3. 「这个月做了几天」  —— 那是薪资那一边
--   4. 🔴 **「星期三下午谁有空」** —— 今天没有任何地方答得了
-- → **所以这一支只做第 4 句。**
--
-- ── 为什么是「每个礼拜几」，不是「哪一天」───────────────────────────
-- 一张要他每个礼拜重排一次的班表，比他现在的做法更花时间
-- （[重点 29](./founder-points.md)：量他要打几个字）。
-- 一个发型师的班是**一个礼拜的形状**：Ah Girl 二到日 10:00–19:00，星期一休 ——
-- **六行，打一次，永远有效**，而请假那种例外走本来就有的「挡起来的时段」。
--
-- ⚠️ 而它**不挡任何一次预约**。老板真的会替熟客排晚上七点的一单，
-- 而一个挡下去的系统会让他绕过去做（[任务 125](#125) 额度那一条同一句：
-- 讲事实，判断留给他）。猜错只是少一句提醒，不会毁掉资料。

create table if not exists public.staff_hours (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- 谁。**指他自己的师傅名册** —— 不另开一张人名表。
  staff_id uuid not null references public.directory_entries(id) on delete cascade,

  -- 0 是星期日，跟 Postgres 的 `dow` 一样 —— 换一套自己的编号，
  -- 就是每一次比对都要先想一遍。
  weekday smallint not null check (weekday between 0 and 6),

  -- 🔴 **墙上时钟，不是时间戳**。「十点开门」在马来西亚永远是十点，
  -- 而一个时间戳会带着某一天的日期跟着夏令时间漂。
  starts_at time not null,
  ends_at time not null,

  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint staff_hours_ends_after_start check (ends_at > starts_at)
);

alter table public.staff_hours enable row level security;

create or replace function public.staff_hours_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* UPDATE 的时候不问「这一家是不是你的」，问「有没有换过一家」——
     删一个人的时候 `created_by` 要被设成空，那是一次修改，
     而一句权限检查会把**整句删除**挡下来（20260906390000 学的）。 */
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'that shift cannot move to another project';
    end if;
    return new;
  end if;
  if not public.works_here(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_hours_guard on public.staff_hours;
create trigger staff_hours_guard
  before insert or update on public.staff_hours
  for each row execute function public.staff_hours_own_project();

/* 🔴 `works_here` —— 一个发型师要看得到自己排哪几天，那是她的工作，不是钱。 */
drop policy if exists staff_hours_read on public.staff_hours;
create policy staff_hours_read on public.staff_hours
  for select using (public.works_here(project_id));

create index if not exists staff_hours_person_idx
  on public.staff_hours (project_id, staff_id, weekday);


/* 一个人的一个礼拜，**整批换掉**。
   一个礼拜是一句完整的话 —— 半套的编辑（改了星期三、星期四还是旧的）
   是一个没有人同意过的班表。跟明细 · 分期 · 分摊三支同一个形状。

   ⚠️ 而这张表**没有任何东西指着它**（不像 record_lines 有收货锚在上面），
   所以整批换在这里不会咬到任何人。 */
create or replace function public.set_staff_hours(
  in_staff_id uuid,
  in_hours jsonb default '[]'::jsonb
)
returns setof public.staff_hours
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  h jsonb;
  wd smallint;
  s time;
  e time;
begin
  select project_id into owner_project
  from public.directory_entries where id = in_staff_id;
  if owner_project is null then
    raise exception 'that person is not in this book';
  end if;
  if not public.works_here(owner_project) then
    raise exception 'that project is not yours';
  end if;

  delete from public.staff_hours where staff_id = in_staff_id;

  for h in select * from jsonb_array_elements(coalesce(in_hours, '[]'::jsonb))
  loop
    wd := (h ->> 'weekday')::smallint;
    s := (h ->> 'starts_at')::time;
    e := (h ->> 'ends_at')::time;
    if wd is null or s is null or e is null then
      raise exception 'a shift needs a day, a start and an end';
    end if;
    if e <= s then
      raise exception 'a shift has to end after it starts';
    end if;
    insert into public.staff_hours (
      project_id, staff_id, weekday, starts_at, ends_at, note, created_by
    )
    values (
      owner_project, in_staff_id, wd, s, e,
      btrim(coalesce(h ->> 'note', '')), auth.uid()
    );
  end loop;

  return query
  select * from public.staff_hours
  where staff_id = in_staff_id
  order by weekday, starts_at;
end;
$$;

revoke execute on function public.set_staff_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_staff_hours(uuid, jsonb) to authenticated;


create or replace function public.staff_hours_of(in_project_id uuid)
returns table (
  staff_id uuid,
  name text,
  weekday smallint,
  starts_at time,
  ends_at time,
  note text
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
  select h.staff_id, coalesce(d.name, ''), h.weekday, h.starts_at, h.ends_at, h.note
  from public.staff_hours h
  join public.directory_entries d on d.id = h.staff_id
  where h.project_id = in_project_id
  order by d.name, h.weekday, h.starts_at;
end;
$$;

revoke execute on function public.staff_hours_of(uuid) from public, anon;
grant execute on function public.staff_hours_of(uuid) to authenticated;


/* 🔴 这一支就是整件事: **「星期三下午谁有空」**。
   一个人有空 = 那个时段他**排了班** ＋ 那个时段他**没有别的事**。

   两件事分开回，不合成一个 boolean —— 「他今天不上班」跟
   「他上班但那个钟头有人」是两句话，而老板下一句要讲的话不一样
   （一句是「找别人」，一句是「五点可以吗」）。 */
create or replace function public.who_is_free(
  in_project_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz
)
returns table (
  staff_id uuid,
  name text,
  on_duty boolean,
  busy boolean,
  busy_with text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wd smallint;
  local_start time;
  local_end time;
  anyone_rostered boolean;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  if in_starts_at is null or in_ends_at is null or in_ends_at <= in_starts_at then
    raise exception 'say a time that ends after it starts';
  end if;

  /* 墙上时钟。一个跨过午夜的时段答不了（星期几会变），
     而一间沙龙没有跨午夜的班 —— 真的有的时候这里要重想。 */
  wd := extract(dow from (in_starts_at at time zone 'Asia/Kuala_Lumpur'))::smallint;
  local_start := (in_starts_at at time zone 'Asia/Kuala_Lumpur')::time;
  local_end := (in_ends_at at time zone 'Asia/Kuala_Lumpur')::time;

  /* 🔴 一行班都没排 → **每一个人都算有空**，也就是今天的行为。
     那正是「不填也用得了」那一句写在代码里的样子。 */
  select exists (select 1 from public.staff_hours where project_id = in_project_id)
    into anyone_rostered;

  return query
  select d.id,
         coalesce(d.name, ''),
         (not anyone_rostered)
           or exists (
             select 1 from public.staff_hours h
             where h.staff_id = d.id
               and h.weekday = wd
               and h.starts_at <= local_start
               and h.ends_at >= local_end
           ),
         exists (
           select 1 from public.appointments a
           where a.project_id = in_project_id
             and a.staff_id = d.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
         ),
         coalesce((
           select case when a.kind = 'block' then coalesce(nullif(a.note, ''), '挡起来了')
                       else coalesce(nullif(a.party, ''), coalesce(nullif(a.service, ''), '有人')) end
           from public.appointments a
           where a.project_id = in_project_id
             and a.staff_id = d.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
           order by a.starts_at
           limit 1
         ), '')
  from public.directory_entries d
  where d.project_id = in_project_id
    and d.module_key = 'staff'
    and d.archived_at is null
  order by d.name;
end;
$$;

revoke execute on function public.who_is_free(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.who_is_free(uuid, timestamptz, timestamptz) to authenticated;

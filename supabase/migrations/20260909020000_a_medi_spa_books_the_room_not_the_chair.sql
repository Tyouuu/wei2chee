-- 一间 medi spa 订的不是椅子，是房间。
--
-- ── 为什么这一支要存在（2026-09-09）────────────────────────────────────────
--
-- 老板下个礼拜要主推沙龙跟 medi spa。而 2026-09-08 那一轮量出来的规律是：
--
--   **平面图（跟「哪一个位置」这件事）只在那个位置本身会撞的时候买得到东西。**
--
--   餐馆桌子会撞 → Lightspeed · Toast 把桌台图当主画面
--   沙龙椅子不会 → Fresha · Booksy（两家最大的）都不给椅子图，
--                  给的是「一天 × 一个师傅一栏」，因为稀缺的是**师傅**
--   🔴 medi spa 反过来 → 一间做脸的房 60–90 分钟只能一个人，
--      而激光机只有一台。**会撞的是房间跟机器。**
--      Zenoti（做那一档的）自己的讲法：「每一张椅子、**每一间房**，
--      都是一个订得到的位置」。
--
-- 而今天这个 schema 只认得一种会撞的东西：`coalesce(staff_id, project_id)`
-- （20260902030000）。所以一间三个房、五个美疗师的店，**同一间房排两个人
-- 是排得进去的** —— 而画面上完全正常，到那一天两个客人一起站在门口才知道。
--
-- ── 它是「加」，不是「收紧」（[重点 31](../../docs/founder-points.md)）──────
--
-- 那一条新的排他约束是**部分**的：`where room_id is not null`。
-- 一间不用房间的沙龙、一张补习课表、一间车厂 —— `room_id` 全部是 null，
-- **今天在跑的每一笔预约一个字都不会变**。
--
-- ⚠️ 而 `add_appointment` 多一个参数 = 签名变了 = **对呼叫端相容、对资料库
-- 不相容**，所以先 drop 再建（[重点 31](../../docs/founder-points.md) 第二条，
-- 9-05 才踩过一次）。那一支的本体是从 20260906400000 —— 最后一次定义它的
-- 那个档案 —— 原样抽出来改那几行的，不是照记忆重打。
--
-- ── 为什么是一张表，不是一格自由文字 ──────────────────────────────────────
--
-- 「房间」也可以是 `appointments` 上一格文字，排他约束照样挡得住。不这样做
-- 有一个决定性的理由：**「三点还有哪一间房空着」答不出来** —— 一份不存在的
-- 清单列不出来。而那正好是前台接电话时问的那一句
-- （`who_is_free` 对人已经答得了，这一支对房间答同一句）。
-- 顺带第二个：有清单他就用挑的，没清单他每一次都要打
-- （[重点 29](../../docs/founder-points.md)）。
--
-- ── 谁当那一栏，这一支不决定 ──────────────────────────────────────────────
--
-- 🔴 一天摊开的时候那几栏**照旧是师傅**，房间画在那一块上当一个小标。
-- 「一间三个房、五个美疗师的店，该拿房间当栏还是拿人当栏」是一个**我们
-- 没有量过**的判断 —— 而把它做成一个设定，就是多一件他第一天要先决定的事。
-- 等真的有一间 medi spa 在用，再看她怎么读那一页。
-- （改起来是投影那一行的事，不是这一支的事。）

-- ── 一个订得到的位置 ──────────────────────────────────────────────────────
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 他自己的话：「1 号房」「激光室」「洗头床 A」「烤灯」。
     跟 `stage` · `unit` · `category` 同一条 —— 永远不是一份我们写死的清单。 */
  name text not null,

  /* 关掉的房留着，不删 —— 去年在那一间房做过的每一笔预约还挂在它身上。
     跟 `branches` · `dining_tables` 同一条判断。 */
  active boolean not null default true,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rooms_name_not_blank check (btrim(name) <> ''),
  /* 两间同名的房不是两间房，是一次打错。 */
  constraint rooms_name_unique unique (project_id, name)
);

comment on table public.rooms is
  'A bookable place -- a treatment room, a machine, a bed, a bay. It exists so that "which room is free at three" has an answer at all: a list that does not exist cannot be listed. See the header of 20260909020000.';

create index if not exists rooms_project_idx
  on public.rooms (project_id, sort_order) where active;

alter table public.rooms enable row level security;

/* `works_here`：前台接电话要知道有哪几间房。 */
drop policy if exists "rooms_members" on public.rooms;
create policy "rooms_members" on public.rooms
  for select using (public.works_here(project_id));

/* 而开／关一间房是**店的设定** —— 跟 branches 跟 dining_tables 同一条。 */
drop policy if exists "rooms_owner_writes" on public.rooms;
create policy "rooms_owner_writes" on public.rooms
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

-- ── 那一笔预约在哪一间房 ──────────────────────────────────────────────────
alter table public.appointments
  add column if not exists room_id uuid references public.rooms(id) on delete restrict;

comment on column public.appointments.room_id is
  'Which bookable place this takes. Null everywhere except a business that uses rooms -- the second exclusion constraint below is partial for that reason.';

create index if not exists appointments_room_idx
  on public.appointments (room_id, starts_at)
  where archived_at is null;

/* ── 同一间房不准排两个人 ──────────────────────────────────────────────────
   跟 20260902030000 那一条同一个形状，而且**部分** —— `room_id` 是 null 的
   那几笔（也就是今天全部）完全不受它管。

   取消掉的那一笔放开它的房；其余每一种都占着，挡起来的时段也占着 ——
   那正是「挡起来」跟「预约」住在同一张表里的用处。 */
alter table public.appointments
  drop constraint if exists appointments_no_double_room;
alter table public.appointments
  add constraint appointments_no_double_room
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (room_id is not null and archived_at is null and status <> 'cancelled');

-- ── 开一间房 ──────────────────────────────────────────────────────────────
create or replace function public.add_room(
  in_project_id uuid,
  in_name text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.rooms;
  next_order integer;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'only the owner opens a room';
  end if;

  if coalesce(btrim(in_name), '') = '' then
    raise exception 'a room needs a name';
  end if;

  /* 五十间房是一间医院，而那是另一个产品。 */
  if (select count(*) from public.rooms where project_id = in_project_id) >= 50 then
    raise exception 'that is more rooms than this is built for';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.rooms where project_id = in_project_id;

  insert into public.rooms (project_id, name, sort_order)
  values (in_project_id, left(btrim(in_name), 80), next_order)
  returning * into row;

  return row;

exception
  /* 他打了两次同一个名字 —— 拿回原本那一间，不是报一个错。 */
  when unique_violation then
    select * into row from public.rooms
    where project_id = in_project_id and name = left(btrim(in_name), 80);
    if found then
      return row;
    end if;
    raise;
end;
$$;

create or replace function public.set_room_active(
  in_id uuid,
  in_active boolean
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.rooms;
begin
  select * into row from public.rooms where id = in_id;
  if not found then
    raise exception 'no such room';
  end if;
  if not public.sees_money(row.project_id) then
    raise exception 'not your project';
  end if;

  update public.rooms
  set active = coalesce(in_active, active), updated_at = now()
  where id = in_id
  returning * into row;

  return row;
end;
$$;

create or replace function public.rooms_of(in_project_id uuid)
returns table (
  id uuid,
  name text,
  active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.name, r.active
  from public.rooms r
  where r.project_id = in_project_id
    and public.works_here(in_project_id)
  order by r.sort_order, r.name;
$$;

/* ── 三点还有哪一间房空着 ──────────────────────────────────────────────────
   `who_is_free` 对**人**答这一句，这一支对**房间**答同一句。

   ⚠️ 两支函式，两个问题 —— 不是同一个问题两个答案。一间 medi spa 的前台
   接一通电话要问两次：美疗师有没有空、房间有没有空，而两个都要「有」。

   ⚠️ 故意**没有**上班时间那一半：一间房不请假。关掉的房不回。 */
create or replace function public.rooms_free(
  in_project_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz
)
returns table (
  room_id uuid,
  name text,
  busy boolean,
  busy_with text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         coalesce(r.name, ''),
         exists (
           select 1 from public.appointments a
           where a.room_id = r.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
         ),
         coalesce((
           select nullif(btrim(coalesce(nullif(a.party, ''), a.service, a.note)), '')
           from public.appointments a
           where a.room_id = r.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
           order by a.starts_at
           limit 1
         ), '')
  from public.rooms r
  where r.project_id = in_project_id
    and r.active
    and public.works_here(in_project_id)
    and in_starts_at is not null
    and in_ends_at is not null
    and in_ends_at > in_starts_at
  order by r.sort_order, r.name;
$$;

-- ── 排一笔预约，可以讲哪一间房 ────────────────────────────────────────────
-- ⚠️ 签名变了（多一个参数）→ 先 drop。多一个有预设的参数**对呼叫端相容、
--    对资料库不相容**：不 drop，那一支整个选不到，而画面上跟功能坏了一模一样。
drop function if exists public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid
);

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
  in_group_id uuid default null,
  in_room_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  grp public.class_groups;
  rm public.rooms;
  hit text;
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

  /* 一堂课要指得到一个真的班，而且是这一家的。 */
  if in_group_id is not null then
    select * into grp from public.class_groups where id = in_group_id;
    if not found or grp.project_id <> in_project_id then
      raise exception 'no such class';
    end if;
    if grp.archived_at is not null then
      raise exception 'that class is closed';
    end if;
  end if;

  /* 🔴 新的一段，跟班级那一段同一个形状：一间房要指得到一间真的房，
     而且是这一家的。少了后面那半句，一间店排得进另一家的房 —— 而那一笔
     会去占别人的时段，画面上两边都完全正常。 */
  if in_room_id is not null then
    select * into rm from public.rooms where id = in_room_id;
    if not found or rm.project_id <> in_project_id then
      raise exception 'no such room';
    end if;
    if not rm.active then
      raise exception 'that room is closed';
    end if;
  end if;

  /* A BOOKING IS FOR SOMEBODY; A BLOCK IS NOT. Lunch has no customer, and
     demanding one would make the owner type a name to close his own shop.

     **一堂课的「是给谁的」写在名册上。** 一个补习老师不该为了排一堂十个人
     的课，先在这一格打一个人的名字 —— 打了反而是错的:那一行会看起来像是
     给那一个学生的。 */
  if coalesce(in_kind, 'booking') = 'booking'
     and in_group_id is null
     and btrim(coalesce(in_party, '')) = ''
     and in_party_id is null then
    raise exception 'a booking needs to say who it is for';
  end if;

  insert into public.appointments (
    project_id, module_key, branch_id, kind, starts_at, ends_at,
    party, party_id, staff_id, service, source, note, extra,
    recorded_by, idempotency_key, group_id, room_id
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
    auth.uid(), in_idempotency_key, in_group_id, in_room_id
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
     teaches a salon owner nothing he can act on.

     🔴 而从今天起有**两条**排他约束，所以那一句话要讲清楚是哪一件 ——
     「Amy 那个时间有人了」跟「那间房那个时间有人了」，她下一步做的事
     完全不一样（换一个人 · 换一间房）。一句笼统的「那个时间被占了」
     会让她两件都试一次。 */
  when exclusion_violation then
    get stacked diagnostics hit = constraint_name;
    if hit = 'appointments_no_double_room' then
      raise exception 'that room is already taken then'
        using errcode = 'check_violation';
    end if;
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

grant execute on function public.add_room(uuid, text) to authenticated;
grant execute on function public.set_room_active(uuid, boolean) to authenticated;
grant execute on function public.rooms_of(uuid) to authenticated;
grant execute on function public.rooms_free(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid, uuid
) to authenticated;

-- 缺一堂 → 欠他一堂 → 补回来就划掉。**就这三下。**
--
-- ── 为什么这一件排补习第一（2026-09-10 深度研究）────────────────────────────
--
-- 马来西亚每一家竞品都把它放在首页。AOne：家长可以 `request replacement
-- classes`，而且 `if the replaced class is credit-based, **student credit
-- balance is consumed for the replacement class instead**`。
-- Jackrabbit 有一整个子系统（`Makeup Settings … whether or not there is a
-- time limit on when makeups are offered`）。
--
-- **而这是一间马来西亚补习中心最常收到的那一则 WhatsApp**：
-- 「他星期二没去，几时可以补？」今天它活在老板脑袋跟一本簿子里。
-- 一个月十堂没记的补课 ≈ 一个学生一整个月的学费。
--
-- ── 🔴 而我们只做纸上那三下，不做 Jackrabbit 那一套 ──────────────────────
--
-- [重点 34](../docs/founder-points.md)：**手写簿上有没有这一格。**
-- 老师在名字旁边写「欠一堂」，来补了划掉。三个动作，一张表。
--
-- **不做的，每一个都写出理由**：
--   · **不自动欠** —— 缺席算不算欠一堂，是那家中心的规矩
--     （Pike13 有一个 `cancellation cut-off time`，提前讲的才算）。
--     我们不知道他的规矩，而发明一条 = 有些中心白送课，有些中心得罪家长。
--     所以是**老师按一下**：她点了名，再按「欠他一堂」。两下都是她的。
--   · **不发明有效期** —— Duet 让人设一到十二个月。`expires_on` 可以空，
--     **空就是不过期**。等他讲了那个数字再讲过期
--   · **不做「家长自己在网上约补课」** —— 那是家长端要能写东西（[任务 341](../docs/founder-tasks.md#341)
--     另外一行），这一格先把事实记下来
--
-- ── 🔴 用掉那一下要指定「补在哪一堂」 ────────────────────────────────────
--
-- 只写一个「用掉了」，三个月后没有人答得出他补在哪。
-- 而那正好是家长会问的那一句。所以 `used_lesson_id` 是必填 ——
-- **一笔说不出补在哪一堂的补课，跟没有记是一样的。**

create table if not exists public.lesson_credits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 欠谁。restrict：还欠着课的学生删不掉。 */
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  /* 哪一个班欠的。 */
  group_id uuid not null references public.class_groups(id) on delete cascade,

  /* 🔴 从哪一堂来的。可以空 —— 老师也可能是为别的理由送一堂
     （停电 · 她自己请假），而那时候没有一堂课可以指。 */
  from_lesson_id uuid references public.appointments(id) on delete set null,

  /* 他自己的话：「星期二请假」「老师有事停课」。 */
  reason text not null default '',

  owed_on date not null default public.today_myt(),
  /* 空 = 不过期。**不发明一个月数**，见档头。 */
  expires_on date,

  /* 补回来那一下。两个一起填，或者两个都空。 */
  used_on date,
  used_lesson_id uuid references public.appointments(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  /* 🔴 用掉了就一定讲得出补在哪一堂。见档头。 */
  constraint lesson_credits_used_says_where
    check ((used_on is null) = (used_lesson_id is null)),
  constraint lesson_credits_expiry_after
    check (expires_on is null or expires_on >= owed_on)
);

create index if not exists lesson_credits_open
  on public.lesson_credits (project_id, party_id)
  where used_on is null;

alter table public.lesson_credits enable row level security;

drop policy if exists "lesson_credits_members" on public.lesson_credits;
create policy "lesson_credits_members" on public.lesson_credits
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.lesson_credits is
  'A lesson the centre owes a student. Granted by hand because whether an absence earns one is the centre''s own rule, and inventing that rule gives away lessons in one shop and offends parents in another. Using one must name the lesson it was taken in -- a make-up nobody can point at is the same as no record. See 20260910100000.';

-- ── 欠他一堂 ──────────────────────────────────────────────────────────────

create or replace function public.owe_lesson(
  in_group_id uuid,
  in_party_id uuid,
  in_reason text default '',
  in_from_lesson_id uuid default null,
  in_expires_on date default null
)
returns public.lesson_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
  made public.lesson_credits;
begin
  select * into grp from public.class_groups where id = in_group_id;
  /* 🔴 `works_here` —— **欠一堂课的是老师**，那是她点完名当场按的一下。
     这一整张表上一个金额都没有。 */
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  perform 1 from public.class_members
   where group_id = in_group_id and party_id = in_party_id;
  if not found then
    raise exception 'that student is not in this class';
  end if;

  insert into public.lesson_credits
    (project_id, party_id, group_id, from_lesson_id, reason, expires_on, created_by)
  values (grp.project_id, in_party_id, in_group_id, in_from_lesson_id,
          left(btrim(coalesce(in_reason, '')), 200), in_expires_on, auth.uid())
  returning * into made;
  return made;
end;
$$;

revoke execute on function public.owe_lesson(uuid, uuid, text, uuid, date) from public, anon;
grant execute on function public.owe_lesson(uuid, uuid, text, uuid, date) to authenticated;

-- ── 补回来了 ──────────────────────────────────────────────────────────────

create or replace function public.use_lesson_credit(
  in_id uuid,
  /* 🔴 补在哪一堂。必填 —— 见档头。 */
  in_lesson_id uuid
)
returns public.lesson_credits
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.lesson_credits;
  lesson public.appointments;
begin
  select * into row from public.lesson_credits c
   where c.id = in_id and public.works_here(c.project_id);
  if row.id is null then
    raise exception 'no such owed lesson in your business';
  end if;
  if row.used_on is not null then
    raise exception 'that one was already made up';
  end if;

  select * into lesson from public.appointments where id = in_lesson_id;
  if lesson.id is null or lesson.project_id <> row.project_id then
    raise exception 'no such lesson in your business';
  end if;

  /* ⚠️ **过期的不给用，而讲得出它几时过的** —— 一句「用不了」
     配一个日子，跟一句光秃秃的「用不了」，家长的反应差很远。 */
  if row.expires_on is not null and row.expires_on < public.today_myt() then
    raise exception 'that one expired on %', row.expires_on;
  end if;

  update public.lesson_credits
     set used_on = public.today_myt(), used_lesson_id = in_lesson_id
   where id = in_id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.use_lesson_credit(uuid, uuid) from public, anon;
grant execute on function public.use_lesson_credit(uuid, uuid) to authenticated;

-- ── 🔴 谁还欠着课 ─────────────────────────────────────────────────────────

create or replace function public.lessons_owed(
  in_project_id uuid,
  /* 某一个班，或者不给 = 整间中心。 */
  in_group_id uuid default null
)
returns table (
  id uuid,
  party_id uuid,
  student text,
  class_name text,
  reason text,
  owed_on date,
  expires_on date,
  /* 🔴 还剩几天过期。null = 不过期。**负数是已经过了** ——
     画面上那一句要分得出「快过期」跟「已经过期」。 */
  days_left integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, d.id, d.name, g.name, c.reason, c.owed_on, c.expires_on,
    case when c.expires_on is null then null
         else (c.expires_on - public.today_myt())::integer end
  from public.lesson_credits c
  join public.directory_entries d on d.id = c.party_id
  join public.class_groups g on g.id = c.group_id
  where c.project_id = in_project_id
    and c.used_on is null
    and (in_group_id is null or c.group_id = in_group_id)
    and public.works_here(in_project_id)
  order by c.expires_on nulls last, c.owed_on, d.name;
$$;

revoke execute on function public.lessons_owed(uuid, uuid) from public, anon;
grant execute on function public.lessons_owed(uuid, uuid) to authenticated;

comment on function public.lessons_owed(uuid, uuid) is
  'Who is still owed a lesson. Days left is NULL when it does not expire and NEGATIVE when it already has, because the screen has to tell "expiring soon" apart from "gone". See 20260910100000.';

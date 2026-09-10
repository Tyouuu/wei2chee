-- 学期 —— 而量出来，两件里一件已经有了。
--
-- ── 研究把「学期」讲成两件事（2026-09-10 深度研究，[任务 341](../docs/founder-tasks.md#341)）
--
--   (a) 续班：没有学期边界，就没有「这四十个还没为下学期报名」的名单 ——
--       补习中心一年最大的一笔钱
--   (b) 升级：一月份每个中四班变成中五班，没有学期就要手动重打整个名册
--
-- 🔴 **(b) 量出来已经有了。** `update_class_group` 早就收 `in_name` ——
-- 一月份把「Form 4 数学」改名成「Form 5 数学」，一秒，学生跟老师一个都不用动。
-- **升级不是学期问题，是改一个名字**，而那支函式今天就在。
--
-- 🔴 **(a) 是真的洞，而它是一份名单，不是一个「学期」的概念。**
-- 补习费那一按（\`bill_class\`）用的是 \`in_period\` —— **任何他自己的一串字**，
-- \`2026-T1\` 跟 \`2026-09\` 一样管用（20260909170000 那一支从一开始就这样设计）。
-- 所以缴费那一半从来不用学期这个字。**续班要答的是另一件事**：
-- 这个学生这一期还要不要继续，跟他这个月有没有交钱是两个问题
-- ——一个可能没交钱是忘了，一个没确认续班是真的要走了。
--
-- ── 🔴 只加一张「谁确认过」的表，不发明「当前学期」这个概念 ────────────────
--
-- [重点 34](../docs/founder-points.md)：手写簿上有没有这一格？
-- 有 —— 花名册边上一栏「已报读下学期？」，每一期开学前打勾，
-- 学期结束前重新问一次。**那是一个事实清单，不是一台状态机**。
--
-- 所以没有 \`class_groups.current_term\` 这种栏位 —— **不发明「学期在转」这件事**。
-- 每一次呼叫都明写是哪一期（跟 \`bill_class\` 的 \`in_period\` 同一个写法），
-- 老师问「下学期谁还没确认」，自己讲清楚问的是哪一期就好。
--
-- ⚠️ **确认续班，不等于交了钱** —— 两张表分开，理由是它们答不同的问题：
-- 一个家长可能口头答应了续班、钱还没到；一个学生可能这个月学费迟交、
-- 但早就讲好续到年底。混成一张表，其中一句就会变成猜的。

create table if not exists public.class_confirmations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null references public.class_groups(id) on delete cascade,
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  /* 哪一期。他自己的一串字，跟 `bill_class` 的 `in_period` 同一个写法。 */
  period text not null check (btrim(period) <> ''),

  confirmed_on date not null default public.today_myt(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  /* 一个学生一期只确认一次 —— 按第二下不会多一行，也不会覆盖第一次是谁按的。 */
  constraint class_confirmations_one_each unique (group_id, party_id, period)
);

create index if not exists class_confirmations_by_period
  on public.class_confirmations (group_id, period);

alter table public.class_confirmations enable row level security;

drop policy if exists "class_confirmations_members" on public.class_confirmations;
create policy "class_confirmations_members" on public.class_confirmations
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.class_confirmations is
  'A student has told the centre he is continuing for one named period. No stored "current term" -- the period is named on every call, the same convention bill_class uses. Confirming is not the same fact as paying: a parent can confirm before the fee is due, or pay late while already confirmed for the rest of the year. See 20260910170000.';

-- ── 确认一位学生续读某一期 ────────────────────────────────────────────────

create or replace function public.confirm_for_period(
  in_group_id uuid,
  in_party_id uuid,
  in_period text
)
returns public.class_confirmations
language plpgsql
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
  made public.class_confirmations;
begin
  select * into grp from public.class_groups where id = in_group_id;
  /* 🔴 works_here —— **柜台接到家长那通电话就按的一下**，不是钱那一层。 */
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  if coalesce(btrim(in_period), '') = '' then
    raise exception 'say which period this confirms';
  end if;
  perform 1 from public.class_members
   where group_id = in_group_id and party_id = in_party_id and left_on is null;
  if not found then
    raise exception 'that student is not currently in this class';
  end if;

  insert into public.class_confirmations
    (project_id, group_id, party_id, period, created_by)
  values (grp.project_id, in_group_id, in_party_id, btrim(in_period), auth.uid())
  on conflict (group_id, party_id, period) do nothing
  returning * into made;

  if made.id is null then
    /* 🔴 按第二下 —— 把第一次那一笔还回去，不当成没做过、也不覆盖它。 */
    select * into made from public.class_confirmations
     where group_id = in_group_id and party_id = in_party_id and period = btrim(in_period);
  end if;
  return made;
end;
$$;

revoke execute on function public.confirm_for_period(uuid, uuid, text) from public, anon;
grant execute on function public.confirm_for_period(uuid, uuid, text) to authenticated;

-- ── 🔴 这一班，这一期，谁还没确认 ─────────────────────────────────────────

create or replace function public.not_confirmed_for(
  in_group_id uuid,
  in_period text
)
returns table (
  party_id uuid,
  student text,
  joined_on date
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
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  if coalesce(btrim(in_period), '') = '' then
    raise exception 'say which period to check';
  end if;

  return query
  select m.party_id, d.name, m.joined_on
    from public.class_members m
    join public.directory_entries d on d.id = m.party_id
   where m.group_id = in_group_id
     and m.left_on is null
     and not exists (
       select 1 from public.class_confirmations c
        where c.group_id = in_group_id
          and c.party_id = m.party_id
          and c.period = btrim(in_period)
     )
   order by d.name;
end;
$$;

revoke execute on function public.not_confirmed_for(uuid, text) from public, anon;
grant execute on function public.not_confirmed_for(uuid, text) to authenticated;

comment on function public.not_confirmed_for(uuid, text) is
  'Who is still enrolled but has not confirmed for the named period -- the list a centre works down before the term ends. Roster minus confirmations, not a countdown. See 20260910170000.';

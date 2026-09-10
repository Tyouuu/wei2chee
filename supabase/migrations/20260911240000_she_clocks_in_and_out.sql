-- 上下班打卡——沙龙其余那一组下一件，手写簿上早就有这一张签到表。
--
-- ── 为什么（[任务 341] 沙龙其余那一组）───────────────────────────────────
--
-- 一间沙龙墙上常挂着一张纸：谁几点来、几点走。这个系统今天答不了
-- 「阿珍现在在不在店里」，也答不了「她这个月上了几个小时」。
--
-- ── 一张单，不是两笔事件（[重点 34]：手写簿写不写得下这一格）─────────────
--
-- 手写签到表是一行一次上班：来的时间、走的时间，两栏。不是两张分开的
-- 「进」跟「出」纸条要事后配对。所以这里也是一行一次班：`clock_in_at`
-- 一定有，`clock_out_at` 还在上班的时候是空的——跟 `arrived_at`
-- （20260910570000）同一个「一栏还没填，不是第五个状态」的做法。
--
-- ── 按两下不会开两张班，两层防线 ─────────────────────────────────────────
--
-- 部分唯一索引（`where clock_out_at is null`）是资料库自己的最后防线——
-- 一个人不可能同时有两笔「还没打卡下班」的班。函式自己先查一次，
-- 查到了就把那一笔原样还给他，不去撞那个索引，跟 `add_visit_photo`
-- 「按两下拿回同一张」同一个做法。
--
-- ── 只数真的做完的班，跟 visit_earnings 同一条纪律 ────────────────────────
--
-- `hours_worked_of` 只加总 `clock_out_at` 已经填了的班——还在上班的
-- 那一节还没结束，猜一个「到现在为止」的时数没有意义，也容易跟真的
-- 下班时数混在一起看不出差别。

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  staff_id uuid not null references public.directory_entries(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),

  constraint staff_shifts_out_after_in check (clock_out_at is null or clock_out_at >= clock_in_at)
);

comment on table public.staff_shifts is
  'One row per shift -- clock_in_at is always set, clock_out_at is null while she is still in. Same shape as the wall sign-in sheet: two columns, not two separate event slips. See 20260911240000.';

create unique index if not exists staff_shifts_one_open_per_staff
  on public.staff_shifts (staff_id) where clock_out_at is null;

create index if not exists staff_shifts_recent_idx
  on public.staff_shifts (project_id, staff_id, clock_in_at desc);

alter table public.staff_shifts enable row level security;

drop policy if exists "staff_shifts_members" on public.staff_shifts;
create policy "staff_shifts_members" on public.staff_shifts
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

-- ── 打卡上班 ──────────────────────────────────────────────────────────────

create or replace function public.clock_in(in_staff_id uuid)
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  staff public.directory_entries;
  existing public.staff_shifts;
  made public.staff_shifts;
begin
  select * into staff from public.directory_entries
   where id = in_staff_id and public.works_here(project_id);
  if staff.id is null then
    raise exception 'that person does not work here';
  end if;

  select * into existing from public.staff_shifts
   where staff_id = in_staff_id and clock_out_at is null;
  if existing.id is not null then
    return existing;
  end if;

  insert into public.staff_shifts (project_id, staff_id)
  values (staff.project_id, in_staff_id)
  returning * into made;

  return made;
end;
$fn$;

revoke execute on function public.clock_in(uuid) from public, anon;
grant execute on function public.clock_in(uuid) to authenticated;

comment on function public.clock_in(uuid) is
  'She clocks in. Pressing it twice while already in returns the same open shift, does not open a second one. See 20260911240000.';

-- ── 打卡下班 ──────────────────────────────────────────────────────────────

create or replace function public.clock_out(in_staff_id uuid)
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.staff_shifts;
begin
  select s.* into row from public.staff_shifts s
    join public.directory_entries d on d.id = s.staff_id
   where s.staff_id = in_staff_id
     and s.clock_out_at is null
     and public.works_here(d.project_id)
   order by s.clock_in_at desc
   limit 1;
  if row.id is null then
    raise exception 'she has not clocked in';
  end if;

  update public.staff_shifts
     set clock_out_at = now()
   where id = row.id
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.clock_out(uuid) from public, anon;
grant execute on function public.clock_out(uuid) to authenticated;

comment on function public.clock_out(uuid) is
  'She clocks out of her current open shift. Refuses with a plain word if she never clocked in. See 20260911240000.';

-- ── 现在谁在店里 ──────────────────────────────────────────────────────────

create or replace function public.who_is_clocked_in(in_project_id uuid)
returns table (
  staff_id uuid,
  staff_name text,
  clock_in_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select s.staff_id, d.name, s.clock_in_at
    from public.staff_shifts s
    join public.directory_entries d on d.id = s.staff_id
   where d.project_id = in_project_id
     and s.clock_out_at is null
     and public.works_here(in_project_id)
   order by s.clock_in_at;
$fn$;

revoke execute on function public.who_is_clocked_in(uuid) from public, anon;
grant execute on function public.who_is_clocked_in(uuid) to authenticated;

comment on function public.who_is_clocked_in(uuid) is
  'Who has an open shift right now, earliest arrival first. See 20260911240000.';

-- ── 这个月她上了几个小时 ────────────────────────────────────────────────

create or replace function public.hours_worked_of(
  in_project_id uuid,
  in_days integer default 30
)
returns table (
  staff_id uuid,
  staff_name text,
  hours numeric,
  shifts_worked integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  select s.staff_id, d.name,
         round(sum(extract(epoch from (s.clock_out_at - s.clock_in_at))) / 3600.0, 1),
         count(*)::integer
    from public.staff_shifts s
    join public.directory_entries d on d.id = s.staff_id
   where d.project_id = in_project_id
     and public.works_here(in_project_id)
     and s.clock_out_at is not null
     and s.clock_in_at >= now() - (in_days || ' days')::interval
   group by s.staff_id, d.name
   order by sum(extract(epoch from (s.clock_out_at - s.clock_in_at))) desc;
$fn$;

revoke execute on function public.hours_worked_of(uuid, integer) from public, anon;
grant execute on function public.hours_worked_of(uuid, integer) to authenticated;

comment on function public.hours_worked_of(uuid, integer) is
  'Hours worked per staff over the window -- only shifts that are actually closed, an open one has no end to count yet. See 20260911240000.';

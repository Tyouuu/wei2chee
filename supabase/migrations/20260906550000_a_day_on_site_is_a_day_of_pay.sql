-- 按天算的工人，薪资单上一行都没有。
--
-- ── 🔴 这个洞是那张表自己的注解讲出来的 ──────────────────────────────
-- `staff_pay_terms` 声明了三种算法，而它的注解写着为什么要三种:
--     「⚠️ 三种都要，而不是只做月薪：他最大的三个市场
--       （装修 · 冷气 · 车厂）的工人**有一半是按天算的**，
--       而一套只会月薪的薪资对他们等於没有。」
--
-- 而 `open_pay_run` 里只有一句:
--     `if t.basis = 'monthly' and t.rate_cents > 0 then ... 'Basic pay' ...`
--
-- 🔴 **所以一个按天算的师傅，开一次薪拿到的是一张空的薪资单** ——
-- 而它不会报错、不会讲，公积金社险照样按 0 算，
-- 老板要嘛自己手填，要嘛真的付了零。
--
-- ── 缺的是那个数字：他这个月做了几天 ────────────────────────────────
-- 那份「十三条链」的报告第⑤条链写的「**打卡没有**」就是这一件。
--
-- ⚠️ 而**不做打卡钟**（[重点 7d-2](./founder-points.md)：读完之后挑最简单那一版）。
-- 一个装修老板不按打卡钟 —— 他收工的时候在本子上写几个名字。
-- 所以一天是**一行**：做了 · 做半天 · 没来（按钟点的另外记时数），
-- 而不是上下班两个时间戳。
--
-- ⚠️ 一件要老实讲的：**写这一行的是 `works_here`，不是只有老板。**
-- 工头在工地上替他那一班记，才是这一件的用处；而代价是一个师傅
-- 理论上记得了自己的出勤。今天没有「工头」这个角色
-- （[任务 84](#84) 判过一次：一个人都还没有两个员工的时候做权限表格，
-- 是照想像做的），而发薪那一关本来就要老板自己按。
-- **记下来，等真的有第二个角色的时候收紧。**

create table if not exists public.work_days (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  staff_id uuid not null references public.directory_entries(id) on delete cascade,

  on_date date not null,

  -- 做了 · 做半天 · 没来。**三个答案**，不是一段自由文字 ——
  -- 它要拿去乘日薪，而一段自由文字乘不了。
  kind text not null default 'full' check (kind in ('full', 'half', 'absent')),

  -- 按钟点算的才填。**做了几个钟头**，不是几点到几点 ——
  -- 两个时间戳要他记两次，而他要的答案只有一个数字。
  hours numeric(6, 2) check (hours is null or (hours >= 0 and hours <= 24)),

  note text not null default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 一个人一天一行。同一天记两次是改，不是加。
  constraint work_days_one_a_day unique (staff_id, on_date)
);

alter table public.work_days enable row level security;

create or replace function public.work_days_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* UPDATE 不问「这一家是不是你的」，问「有没有换过一家」——
     删一个人的时候 `recorded_by` 要被设成空，那是一次修改，
     而一句权限检查会把整句删除挡下来（20260906390000 学的）。 */
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception 'that day cannot move to another project';
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

drop trigger if exists work_days_guard on public.work_days;
create trigger work_days_guard
  before insert or update on public.work_days
  for each row execute function public.work_days_own_project();

drop policy if exists work_days_read on public.work_days;
create policy work_days_read on public.work_days
  for select using (public.works_here(project_id));

create index if not exists work_days_person_idx
  on public.work_days (project_id, staff_id, on_date);


create or replace function public.log_work_day(
  in_staff_id uuid,
  in_on_date date default null,
  in_kind text default 'full',
  in_hours numeric default null,
  in_note text default ''
)
returns public.work_days
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.work_days;
  owner_project uuid;
  k text;
  day date;
begin
  select project_id into owner_project
  from public.directory_entries where id = in_staff_id;
  if owner_project is null then
    raise exception 'that person is not in this book';
  end if;
  if not public.works_here(owner_project) then
    raise exception 'that project is not yours';
  end if;

  k := lower(btrim(coalesce(in_kind, 'full')));
  if k not in ('full', 'half', 'absent') then
    raise exception 'say whether it was a full day, a half day, or a day off';
  end if;

  /* 马来西亚的今天 —— 伺服器跑的是另一个时区，而半夜到早上八点
     记昨天的工正好是他会做的事（20260831030000 同一条）。 */
  day := coalesce(in_on_date, public.today_myt());
  if day > public.today_myt() then
    raise exception 'that day has not happened yet';
  end if;

  insert into public.work_days (
    project_id, staff_id, on_date, kind, hours, note, recorded_by
  )
  values (
    owner_project, in_staff_id, day, k,
    case when k = 'absent' then null else in_hours end,
    btrim(coalesce(in_note, '')), auth.uid()
  )
  on conflict (staff_id, on_date) do update
    set kind = excluded.kind,
        hours = excluded.hours,
        note = excluded.note,
        recorded_by = excluded.recorded_by
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.log_work_day(uuid, date, text, numeric, text) from public, anon;
grant execute on function public.log_work_day(uuid, date, text, numeric, text) to authenticated;


/* 这一段他做了几天 —— 半天算半天。
   🔴 **算出来的，不存起来** —— 这个 schema 判过十二次同一件事。 */
create or replace function public.days_worked(
  in_staff_id uuid,
  in_from date,
  in_to date
)
returns table (days numeric, hours numeric, logged integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.directory_entries where id = in_staff_id;
  if owner_project is null or not public.works_here(owner_project) then
    return;
  end if;

  return query
  select
    coalesce(sum(case w.kind when 'full' then 1 when 'half' then 0.5 else 0 end), 0)::numeric,
    coalesce(sum(coalesce(w.hours, 0)), 0)::numeric,
    count(*)::integer
  from public.work_days w
  where w.staff_id = in_staff_id
    and w.on_date between in_from and in_to;
end;
$$;

revoke execute on function public.days_worked(uuid, date, date) from public, anon;
grant execute on function public.days_worked(uuid, date, date) to authenticated;


create or replace function public.work_days_of(
  in_project_id uuid,
  in_from date,
  in_to date
)
returns table (
  staff_id uuid,
  name text,
  on_date date,
  kind text,
  hours numeric,
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
  select w.staff_id, coalesce(d.name, ''), w.on_date, w.kind, w.hours, w.note
  from public.work_days w
  join public.directory_entries d on d.id = w.staff_id
  where w.project_id = in_project_id
    and w.on_date between in_from and in_to
  order by w.on_date desc, d.name;
end;
$$;

revoke execute on function public.work_days_of(uuid, date, date) from public, anon;
grant execute on function public.work_days_of(uuid, date, date) to authenticated;


-- ── 开一次薪的时候，按天跟按钟点的也算得出来 ────────────────────────
-- ⚠️ 从 20260904230000 —— **最后一次定义它的那个档案** —— 原样抽出来
-- 改那一段，不是照记忆重打（[重点 31](./founder-points.md) 第一条，被咬过三次）。
-- 签名一个字都没变，所以不用 drop。
create or replace function public.open_pay_run(
  in_project_id uuid,
  in_period_from date,
  in_period_to date,
  in_note text default '',
  in_branch_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.pay_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  run public.pay_runs;
  t public.staff_pay_terms;
  slip public.payslips;
  worked record;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;
  if in_period_to < in_period_from then
    raise exception 'the period ends before it starts';
  end if;

  if in_idempotency_key is not null then
    select * into run from public.pay_runs
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return run;
    end if;
  end if;

  insert into public.pay_runs (
    project_id, period_from, period_to, note, branch_id, idempotency_key
  ) values (
    in_project_id, in_period_from, in_period_to,
    left(coalesce(in_note, ''), 500), in_branch_id, in_idempotency_key
  )
  returning * into run;

  for t in
    select * from public.staff_pay_terms where project_id = in_project_id
  loop
    insert into public.payslips (run_id, project_id, staff_id)
    values (run.id, in_project_id, t.staff_id)
    returning * into slip;

    if t.basis = 'monthly' and t.rate_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
      values (slip.id, 'earning', 'Basic pay', t.rate_cents, 0);

    /* 🔴 按天 · 按钟点的那两种，本来一行都没有。
       ⚠️ 而这一行**没有记录的时候照样画出来，写着 0** ——
       一张没有那一行的薪资单，跟一张写着「0 天」的薪资单，
       在他眼前差很远：前者看起来像还没做完，后者是一句他看得懂、
       而且马上知道要去补什么的话。 */
    elsif t.basis in ('daily', 'hourly') then
      select * into worked
      from public.days_worked(t.staff_id, in_period_from, in_period_to);

      if t.basis = 'daily' then
        insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
        values (
          slip.id, 'earning',
          'Days worked: ' || trim(to_char(coalesce(worked.days, 0), 'FM999999990.09')),
          floor(coalesce(worked.days, 0) * t.rate_cents)::bigint,
          0
        );
      else
        insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
        values (
          slip.id, 'earning',
          'Hours worked: ' || trim(to_char(coalesce(worked.hours, 0), 'FM999999990.09')),
          floor(coalesce(worked.hours, 0) * t.rate_cents)::bigint,
          0
        );
      end if;
    end if;

    perform public.recompute_payslip_statutory(slip.id);
  end loop;

  return run;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into run from public.pay_runs
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return run;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.open_pay_run(uuid, date, date, text, uuid, uuid) from public, anon;
grant execute on function public.open_pay_run(uuid, date, date, text, uuid, uuid) to authenticated;

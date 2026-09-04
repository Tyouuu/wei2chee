-- 薪资的地基 —— 法定那张表是**资料**，不是代码。
--
-- ── 先读别人真的表（重点 26）───────────────────────────────────────────────
--
-- frappe/hrms 的三份 doctype，2026-09-04 逐栏读的：
--   `Salary Slip`       约 60 栏，其中大半是印度的税务机器（tax_exemption_
--                       declaration · standard_tax_exemption_amount ·
--                       annual_taxable_amount · ctc）跟八栏多币别的 base_*
--   `Salary Structure`  earnings / deductions / **employer_contributions** 三张子表
--   `Salary Component`  type: Earning | Deduction | **Employer Contribution**
--
-- 拿一样，而它是这份 schema 的骨架：**三种，不是两种。**
-- 老板缴的那一份公积金**不从工人身上扣**、**不进实收**，但它**是这门生意的
-- 一笔成本** —— 一个只有「收入」跟「扣除」的薪资表算不出老板真正付了多少。
--
-- 不拿的，逐条带理由：
--   * 🔴 **`amount_based_on_formula` + `formula`（Code）** —— 他们让人写一段
--     公式字串然后求值。两个理由不抄：在一个多租户资料库里求值别人写的代码
--     是一个洞；而且**公式表达不了 EPF 那张查找表**（见下面）。
--   * 那八栏 `base_*` 多币别 —— 多币别是另一件事，排在后面
--   * `ctc` · `income_from_other_sources` · 整套印度税务栏位
--
-- ── 🔴 这一整支真正的发现：法定的钱**不是百分比** ──────────────────────────
--
-- 2026-09-04 查到的三件，每一件都会让一个「11% × 薪水」的实作变成错的：
--
--   1. **EPF 的第三附表（Third Schedule）是一张查找表，不是百分比。**
--      KWSP 自己的说法：`not allowed to calculate the employer's and
--      employee's share based on exact percentage`（≤ RM20,000）。
--      RM5,000 以下每 RM20 一格，RM5,001–20,000 每 RM100 一格。
--      实际抓到的表：Part A 397 格 · Part C 372 格 · Part E 379 格。
--   2. **SOCSO 也是一张表**，不是 1.75% / 0.5%。
--   3. 🔴 **而且它们会变，中间还会脱节** —— 2026 年六月到七月 PERKESO 改了
--      费率，而**连 PERKESO 自己的 e-Payroll 都还没跟上**。
--
-- 第三件决定了这份 schema 的形状：**把法定数字写进代码，就是让这套薪资在
-- 某一年的某一天开始静静地算错**，而没有任何东西会讲。SQL Account 跟
-- AutoCount 的做法是每年卖一次更新档；我们的做法是：**它本来就是资料。**
--
-- ── 所以这里立了三条，而这三条就是「比他们好」的全部内容 ──────────────────
--
--   ① **一份表 = 一行资料 + 它的出处**（哪个机构 · 哪一份文件的网址 ·
--      哪一条法令 · 从哪一天生效）。换一年的费率是插几行，不是发一次版。
--   ② **每一张薪资单记住它用的是哪一份表**（`payslip_lines.schedule_id`）。
--      明年费率改了，**去年那几张薪资单不会跟着变** —— 而那正是一张
--      发出去过的单据该有的性质。
--   ③ 🔴 **没有人确认过的表，算得出来，但发不出去。**
--      `confirmed_at` 是空的时候，薪资单照样算（他看得到数字），
--      而 `pay_pay_run` 会拒绝把钱记进帐上。
--      **钱不准踩着没有人核对过的数字离开。**
--
-- ⚠️ 而这一支**一行费率都没有种进去**，那是刻意的：
-- 我今天读得到的最完整的一份（MIT，一个星）是 **2025-10-01** 生效的快照，
-- 而上面第 3 件说 2026 年年中改过。种一份过期的法定表进去，比空着糟得多 ——
-- 空着会讲「我没有这一段时间的表，去这里拿」，而过期的会安静地算错。
--
-- 官方出处（那支 MIT 套件的 scraper 指向的，也是它自己的免责声明列的）：
--   EPF   https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution
--   SOCSO https://www.perkeso.gov.my/en/rate-of-contribution.html
--   EIS   同上（Act 800）
--   PCB   https://www.hasil.gov.my
--
-- ⚠️ **PCB（月度税扣）这一支不做。** 它是一整套年度税表加个人减免申报，
-- 而少了它这套薪资**不完整** —— 所以是排在后面，不是不做（重点 18）。
-- 写在这里，不要等他发现。

-- ──────────────────────────────────────────────────────────────────────────
-- 一、法律。全局的，不属於任何一家生意。
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.statutory_schedules (
  id uuid primary key default gen_random_uuid(),

  /* 'epf' | 'socso' | 'eis'. 'pcb' 故意不在里面 —— 见档头。 */
  scheme text not null check (scheme in ('epf', 'socso', 'eis')),

  /* 同一个计划底下的**类别**，因为费率按人分。
     EPF 的第三附表自己就分 Part A / C / E（马来西亚人 60 岁以下 ·
     60 岁以上 · 1998 年 8 月后入会的非马来西亚人）。
     SOCSO 分第一类（受伤 + 残疾）跟第二类（只有受伤，60 岁以上）。
     一个 schedule 就是「一个计划的一个类别的一个版本」。 */
  part text not null,

  effective_from date not null,
  /* null = 还在生效。新的一份进来的时候，旧的那一份要被封口 ——
     `close_statutory_schedule` 做这件事，而不是让两份重叠。 */
  effective_to date,

  /* ── 出处。每一张薪资单都要讲得出它的数字打哪来 ────────────────────── */
  source_name text not null,
  /* 官方那份文件的网址。⚠️ 不是某个部落格，也不是某个套件的 ——
     一个承包商被稽查的时候，要拿得出这一份。 */
  source_url text not null,
  /* 'EPF Act 1991 - Section 43(1), Third Schedule' */
  act text not null default '',
  /* 这份资料实际上是**经过谁**拿到的。空的 = 直接从官方文件读的。
     ⚠️ 跟 source_url 分开，因为那两件事不一样：出处是法律，
     而「我从哪里抄来的」是一条要审的线索。 */
  via text not null default '',

  /* 表尾那一段的算法。⚠️ 用**千分比整数**，不是浮点数百分比：
     钱不准用浮点数算。11% = 110。 */
  rounding text not null default 'cent' check (rounding in ('cent', 'ringgit_up')),

  /* ── 🔴 有没有人真的核对过 ──────────────────────────────────────────
     null = **没有**。那时候薪资单照样算得出来（他看得到数字），
     而钱发不出去（`pay_pay_run` 会拒绝）。 */
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_note text not null default '',

  created_at timestamptz not null default now(),

  constraint statutory_schedules_one_version
    unique (scheme, part, effective_from),
  constraint statutory_schedules_span
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.statutory_schedules is
  '一份法定费率表的一个版本，带出处。全局的 —— 法律对每一家生意都一样。换一年的费率是插几行，不是发一次版。';
comment on column public.statutory_schedules.confirmed_at is
  'null = 没有人核对过。那时候薪资单算得出来但发不出去 —— 钱不准踩着没有人核对过的数字离开。';

create table if not exists public.statutory_brackets (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null
    references public.statutory_schedules(id) on delete cascade,

  /* 这一格涵盖的工资，含两端。 */
  wage_from_cents bigint not null check (wage_from_cents >= 0),
  /* null = 没有上限（表尾那一格）。 */
  wage_to_cents bigint,

  /* ── 固定金额，**或者**千分比。刚好一种。 ──────────────────────────
     ≤ RM20,000 那一段是固定金额（法律规定不准用百分比算）；
     再上去才切回比例。跟 `record_terms` 的「比例或金额，只能有一个」
     同一个形状，同一个理由：**两个都存就是两个真相**。 */
  employee_cents bigint check (employee_cents >= 0),
  employer_cents bigint check (employer_cents >= 0),
  employee_permille integer check (employee_permille >= 0),
  employer_permille integer check (employer_permille >= 0),

  constraint statutory_brackets_span
    check (wage_to_cents is null or wage_to_cents >= wage_from_cents),
  constraint statutory_brackets_one_kind check (
    (employee_cents is not null and employer_cents is not null
      and employee_permille is null and employer_permille is null)
    or
    (employee_permille is not null and employer_permille is not null
      and employee_cents is null and employer_cents is null)
  )
);

create index if not exists statutory_brackets_lookup
  on public.statutory_brackets (schedule_id, wage_from_cents);

alter table public.statutory_schedules enable row level security;
alter table public.statutory_brackets enable row level security;

/* 法律是公开的，每一个登入的人都读得到 —— 一个读不到自己那张表的老板，
   没办法核对我们替他算的数字。 */
drop policy if exists statutory_schedules_read on public.statutory_schedules;
create policy statutory_schedules_read on public.statutory_schedules
  for select to authenticated using (true);

drop policy if exists statutory_brackets_read on public.statutory_brackets;
create policy statutory_brackets_read on public.statutory_brackets
  for select to authenticated using (true);

/* 🔴 写只有我们。一家生意改得了自己的法定费率表，那不是弹性，那是一个洞。 */
drop policy if exists statutory_schedules_write on public.statutory_schedules;
create policy statutory_schedules_write on public.statutory_schedules
  for all to authenticated using (public.is_founder()) with check (public.is_founder());

drop policy if exists statutory_brackets_write on public.statutory_brackets;
create policy statutory_brackets_write on public.statutory_brackets
  for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- ──────────────────────────────────────────────────────────────────────────
-- 二、查一格。
-- ──────────────────────────────────────────────────────────────────────────

/**
 * 这个人、这个月、这份工资，法律说要扣多少、老板要缴多少。
 *
 * 🔴 **查不到就抛错，绝不回 0。** 一个回 0 的查询在薪资单上长得跟
 * 「这个人不用缴」一模一样 —— 而那是一笔漏缴，老板要负责。
 * 错误讯息里带着**该去哪里拿那份表**。
 */
create or replace function public.statutory_lookup(
  in_scheme text,
  in_part text,
  in_on date,
  in_wage_cents bigint
)
returns table (schedule_id uuid, employee_cents bigint, employer_cents bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sched public.statutory_schedules;
  row public.statutory_brackets;
begin
  select * into sched
  from public.statutory_schedules s
  where s.scheme = in_scheme
    and s.part = in_part
    and s.effective_from <= in_on
    and (s.effective_to is null or s.effective_to >= in_on)
  order by s.effective_from desc
  limit 1;

  if not found then
    raise exception
      'no % (%) table covers % -- load the official schedule before running payroll',
      in_scheme, in_part, in_on;
  end if;

  select * into row
  from public.statutory_brackets b
  where b.schedule_id = sched.id
    and b.wage_from_cents <= in_wage_cents
    and (b.wage_to_cents is null or in_wage_cents <= b.wage_to_cents)
  order by b.wage_from_cents desc
  limit 1;

  if not found then
    /* 表有洞。**不要外推** —— 一张缺了一格的表，猜出来的那一格
       跟真的那一格在画面上长得一样。 */
    raise exception
      'the % (%) table has no row for wages of %.% -- the loaded table is incomplete',
      in_scheme, in_part, in_wage_cents / 100, lpad((in_wage_cents % 100)::text, 2, '0');
  end if;

  if row.employee_cents is not null then
    schedule_id := sched.id;
    employee_cents := row.employee_cents;
    employer_cents := row.employer_cents;
  else
    schedule_id := sched.id;
    /* 千分比。整数运算，四舍五入到分 —— 钱不碰浮点数。 */
    employee_cents := (in_wage_cents * row.employee_permille + 500) / 1000;
    employer_cents := (in_wage_cents * row.employer_permille + 500) / 1000;
    if sched.rounding = 'ringgit_up' then
      employee_cents := ((employee_cents + 99) / 100) * 100;
      employer_cents := ((employer_cents + 99) / 100) * 100;
    end if;
  end if;
  return next;
end;
$$;

revoke execute on function public.statutory_lookup(text, text, date, bigint) from public, anon;
grant execute on function public.statutory_lookup(text, text, date, bigint) to authenticated;

/**
 * 装一份表进去。只有我们。
 *
 * 同一个 (计划 · 类别 · 生效日) 再装一次 = **换掉那一份**，
 * 而不是多一份重叠的 —— 两份重叠的表，查出来的是哪一份取决於排序，
 * 而那是一个没有人看得出来的错。
 */
create or replace function public.upsert_statutory_schedule(
  in_scheme text,
  in_part text,
  in_effective_from date,
  in_source_name text,
  in_source_url text,
  in_act text default '',
  in_via text default '',
  in_rounding text default 'cent',
  in_brackets jsonb default '[]'::jsonb
)
returns public.statutory_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  sched public.statutory_schedules;
  b jsonb;
begin
  if not public.is_founder() then
    raise exception 'only the founder loads statutory tables';
  end if;

  insert into public.statutory_schedules (
    scheme, part, effective_from, source_name, source_url, act, via, rounding
  ) values (
    in_scheme, in_part, in_effective_from,
    left(in_source_name, 120), left(in_source_url, 500),
    left(coalesce(in_act, ''), 200), left(coalesce(in_via, ''), 300),
    coalesce(in_rounding, 'cent')
  )
  on conflict (scheme, part, effective_from) do update set
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    act = excluded.act,
    via = excluded.via,
    rounding = excluded.rounding,
    /* 🔴 换了资料就**收回确认**。一份被改过的表，上一次的核对不算数了。 */
    confirmed_at = null,
    confirmed_by = null,
    confirmed_note = ''
  returning * into sched;

  delete from public.statutory_brackets where schedule_id = sched.id;

  for b in select * from jsonb_array_elements(coalesce(in_brackets, '[]'::jsonb)) loop
    insert into public.statutory_brackets (
      schedule_id, wage_from_cents, wage_to_cents,
      employee_cents, employer_cents, employee_permille, employer_permille
    ) values (
      sched.id,
      (b ->> 'wage_from_cents')::bigint,
      nullif(b ->> 'wage_to_cents', '')::bigint,
      nullif(b ->> 'employee_cents', '')::bigint,
      nullif(b ->> 'employer_cents', '')::bigint,
      nullif(b ->> 'employee_permille', '')::integer,
      nullif(b ->> 'employer_permille', '')::integer
    );
  end loop;

  return sched;
end;
$$;

revoke execute on function public.upsert_statutory_schedule(
  text, text, date, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.upsert_statutory_schedule(
  text, text, date, text, text, text, text, text, jsonb
) to authenticated;

/**
 * 我核对过了。
 *
 * ⚠️ 一个**人**的动作，不是一支脚本的 —— 所以它单独一支函式，
 * 而不是 upsert 的一个参数。一份自己宣称自己被核对过的表，
 * 就是没有被核对过。
 */
create or replace function public.confirm_statutory_schedule(
  in_id uuid,
  in_note text default ''
)
returns public.statutory_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  sched public.statutory_schedules;
begin
  if not public.is_founder() then
    raise exception 'only the founder confirms a statutory table';
  end if;
  update public.statutory_schedules set
    confirmed_at = now(),
    confirmed_by = auth.uid(),
    confirmed_note = left(coalesce(in_note, ''), 500)
  where id = in_id
  returning * into sched;
  if not found then
    raise exception 'no such statutory schedule';
  end if;
  return sched;
end;
$$;

revoke execute on function public.confirm_statutory_schedule(uuid, text) from public, anon;
grant execute on function public.confirm_statutory_schedule(uuid, text) to authenticated;

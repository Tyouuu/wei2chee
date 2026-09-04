-- 发薪 —— 他说他付多少，法律说要扣多少，然后它落进帐上。
--
-- 20260904210000 建了法定那张表跟它的出处。这一支是用它的那一半 ——
-- 单独建那一半而没有人读它，正是这个仓库犯过最多次的那个错。
--
-- ── 三种，不是两种（从 frappe/hrms 的 Salary Component 拿的）──────────────
--
--   earning    他付的           → 进实收
--   deduction  从工人身上扣的    → 出实收（公积金的员工份、社险的员工份）
--   employer   **老板另外缴的**  → **不进实收，但它是这门生意的一笔成本**
--
-- 少了第三种，一套薪资算得出「工人拿到多少」，算不出「老板付了多少」——
-- 而后者才是他打开「这个月赚多少」要看到的那个数字。
--
-- ── 🔴 发薪那天，实际离开的是「实收」，不是「总额」──────────────────────
--
-- 我们的损益表是**收付实现制**（20260904200000 的档头讲过，含它的代价）。
-- 所以 `pay_pay_run` 只记**实收**那一笔 —— 因为那天真的只有那笔钱离开。
-- 公积金跟社险是次月十五号之前缴的，那天他再记一笔。
--
-- ⚠️ **代价要讲出来，不要藏**：在他真的去缴之前，那个月的人工成本
-- 在损益表上是**偏低的**。做「应付」要一整套权责发生制，而那要借贷分录 ——
-- 代价写在 20260904200000 的档头。这是同一个取舍的下游，不是一个疏忽。
--
-- ── 🔴 没有人确认过的表，算得出来，发不出去 ────────────────────────────
--
-- `pay_pay_run` 会逐行检查它用过的每一份法定表。只要有一份 `confirmed_at`
-- 是空的，它拒绝，而且讲得出是哪一份、去哪里核对。
-- **钱不准踩着没有人核对过的数字离开。**
--
-- 而薪资单**照样算得出来** —— 他看得到数字、看得到出处、看得到那一份还没
-- 有人核对。挡的是钱，不是资讯。

-- ──────────────────────────────────────────────────────────────────────────
-- 一、这个人怎么算钱
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.staff_pay_terms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  /* 名册里的师傅。一个人一份。 */
  staff_id uuid not null unique
    references public.directory_entries(id) on delete cascade,

  /* 月薪 · 日薪 · 时薪。
     ⚠️ 三种都要，而不是只做月薪：他最大的三个市场（装修 · 冷气 · 车厂）
     的工人有一半是按天算的，而一套只会月薪的薪资对他们等於没有。 */
  basis text not null default 'monthly' check (basis in ('monthly', 'daily', 'hourly')),
  rate_cents bigint not null default 0 check (rate_cents >= 0),

  /* ── 法定的部分。null = **不适用**，而那是一个真的答案，不是漏填 ──────
     他的工地上有一半是分包出去的师傅 —— 那些人自己缴，老板不缴。
     一套逼每个人都要有公积金类别的薪资，会让他把真的分包也填成员工。 */
  epf_part text,
  socso_part text,
  eis_part text,

  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.staff_pay_terms.epf_part is
  'EPF 第三附表的哪一部分（Part A / C / E）。null = 不适用 —— 分包的师傅自己缴，那是一个真的答案不是漏填。';

/* 🔴 只能是这一家自己的**师傅**。一份挂在客户身上的薪资条件在画面上
   完全正常，而它会让月底那张表把一个客户算成员工。
   （跟 20260904120000 的佣金阶梯同一条，同一个理由。） */
create or replace function public.pay_terms_are_for_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.directory_entries d
  where d.id = new.staff_id
    and d.project_id = new.project_id
    and d.module_key = 'staff';
  if not found then
    raise exception 'that person is not a staff member in this project';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_pay_terms_are_for_staff on public.staff_pay_terms;
create trigger staff_pay_terms_are_for_staff
  before insert or update on public.staff_pay_terms
  for each row execute function public.pay_terms_are_for_staff();

-- ──────────────────────────────────────────────────────────────────────────
-- 二、一次发薪
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.pay_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  period_from date not null,
  period_to date not null,

  /* 发出去了没有。发出去之后整张锁住 —— 跟收过货的进货单同一条：
     钱已经到工人手上了，改那张纸不会把它变回来。 */
  paid_at timestamptz,
  note text not null default '',
  branch_id uuid,

  idempotency_key uuid,
  created_at timestamptz not null default now(),

  constraint pay_runs_period check (period_to >= period_from),
  constraint pay_runs_one_per_period unique (project_id, period_from, period_to)
);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pay_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  staff_id uuid not null references public.directory_entries(id) on delete restrict,

  /* ── 全部是从 lines 加起来的，由触发器写 ────────────────────────────
     ⚠️ 存起来是对的，而这跟「架上有几个」不一样：一张发出去的薪资单
     是一份**当时的单据**，它不该因为明年费率改了就变。
     那也正是 `payslip_lines.schedule_id` 存在的理由。 */
  gross_cents bigint not null default 0,
  deduction_cents bigint not null default 0,
  employer_cents bigint not null default 0,
  net_cents bigint not null default 0,

  /* 这笔实收记进帐上之后，是哪一笔。null = 还没发。 */
  entry_id uuid references public.ledger_entries(id) on delete set null,

  created_at timestamptz not null default now(),
  constraint payslips_one_per_person unique (run_id, staff_id)
);

create table if not exists public.payslip_lines (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references public.payslips(id) on delete cascade,

  kind text not null check (kind in ('earning', 'deduction', 'employer')),
  label text not null default '',
  amount_cents bigint not null default 0 check (amount_cents >= 0),

  /* 🔴 这一行的数字是哪一份法定表算出来的。
     null = 他自己写的（底薪 · 加班 · 津贴）。
     **明年费率改了，去年那张单还讲得出它用的是哪一份表。** */
  schedule_id uuid references public.statutory_schedules(id) on delete restrict,

  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists payslips_run_idx on public.payslips (run_id);
create index if not exists payslip_lines_slip_idx on public.payslip_lines (payslip_id, sort_order);
create index if not exists pay_runs_project_idx on public.pay_runs (project_id, period_from desc);

-- ── RLS：薪资是钱，只有看得到钱的人 ──────────────────────────────────────

alter table public.staff_pay_terms enable row level security;
alter table public.pay_runs enable row level security;
alter table public.payslips enable row level security;
alter table public.payslip_lines enable row level security;

drop policy if exists staff_pay_terms_own on public.staff_pay_terms;
create policy staff_pay_terms_own on public.staff_pay_terms
  for select to authenticated using (public.sees_money(project_id));

drop policy if exists pay_runs_own on public.pay_runs;
create policy pay_runs_own on public.pay_runs
  for select to authenticated using (public.sees_money(project_id));

drop policy if exists payslips_own on public.payslips;
create policy payslips_own on public.payslips
  for select to authenticated using (public.sees_money(project_id));

drop policy if exists payslip_lines_own on public.payslip_lines;
create policy payslip_lines_own on public.payslip_lines
  for select to authenticated using (
    exists (
      select 1 from public.payslips p
      where p.id = payslip_id and public.sees_money(p.project_id)
    )
  );

/* ⚠️ 写只有底下那几支函式（security definer）。没有 insert/update/delete
   的 policy，所以一个拿到登入的人**改不了自己的薪资单** ——
   跟 `record_changes` 那本帐同一条。 */

-- ── 总数由行加起来 ────────────────────────────────────────────────────────

create or replace function public.sync_payslip_totals(in_payslip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g bigint;
  d bigint;
  e bigint;
begin
  select
    coalesce(sum(amount_cents) filter (where kind = 'earning'), 0),
    coalesce(sum(amount_cents) filter (where kind = 'deduction'), 0),
    coalesce(sum(amount_cents) filter (where kind = 'employer'), 0)
    into g, d, e
  from public.payslip_lines where payslip_id = in_payslip_id;

  update public.payslips set
    gross_cents = g,
    deduction_cents = d,
    employer_cents = e,
    /* 🔴 老板缴的那一份**不从实收里扣** —— 那是这三种分开的全部意义。 */
    net_cents = g - d
  where id = in_payslip_id;
end;
$$;

create or replace function public.payslip_lines_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_payslip_totals(coalesce(new.payslip_id, old.payslip_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists payslip_lines_sync on public.payslip_lines;
create trigger payslip_lines_sync
  after insert or update or delete on public.payslip_lines
  for each row execute function public.payslip_lines_changed();

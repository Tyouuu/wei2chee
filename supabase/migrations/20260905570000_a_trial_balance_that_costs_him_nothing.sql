-- 试算表 · 这一天的位置
--
-- ## 🔴 先讲清楚这一支是什么、不是什么，因为这一件最容易做出一份假的东西
--
-- [任务 133] 做的是**收付实现制**的「这个月赚多少」，而它当时白纸黑字写着
-- 做不出什么：**没有资产负债表、没有试算表、没有应计**，
-- 理由是「借贷双分录的代价是每一笔都要平，也就是他没办法在不指定对方科目
-- 的情况下记一笔收款 —— 而那正是老板放弃会计软件的那一刻」。
--
-- 那句话到今天还是对的。**所以这一支不去要他指定科目 —— 它把对方那一边
-- 从已经记下来的事实里推出来。**
--
-- ### 每一笔钱本来就带着两边，只是从来没有人把第二边写出来
--
-- | 已经记下来的事实 | 借 | 贷 |
-- |---|---|---|
-- | 收进来、而且分摊到某张单 | 现金 | 收入 |
-- | 收进来、还没分摊（＝订金） | 现金 | **预收款（这是一笔负债）** |
-- | 付出去 | 费用 | 现金 |
-- | 他打的开帐数字 | 那一格 | 开帐权益 |
--
-- 加起来一定平：借方是 Σ进 ＋ Σ出，贷方是 Σ进（分摊的）＋ Σ进（没分摊的）
-- ＋ Σ出 —— **两边都是 Σ进 ＋ Σ出**。它不会因为他少打一个字就不平。
--
-- ### 🔴 而它是**收付实现制**的试算表，这一句一定要讲出来
--
-- 权责发生制要回答一个我们**故意不替他决定**的问题：
-- **一张单什么时候算收入？** 开出去那天？客人同意那天？做完那天？
-- 那叫收入认列，而它是一个会计政策，不是一条公式 ——
-- 替他选一个，等於在他的帐上按下一个他从来没有同意过的决定。
--
-- 所以做法是：**试算表照收付实现制出（它平），
-- 然后把应收跟应付单独列成两个「备忘」** —— 那正是他的会计拿去
-- 转成权责发生制要用的两个数字，而且分开列才不会被误当成试算表的一部分。
--
-- ## 他要打的字：**一个科目一个数字，一次**
--
-- 而且**对方那一边永远是「开帐」**（[重点 29]）——
-- 他打「银行有两万」，另一边自己去权益，不用他想。
-- 每一套小生意的开帐都是这样做的，而它永远配得平。

-- ── 科目：八个，而且名字是他自己的话 ─────────────────────────────────────
--
-- 不是一棵可以长到两百个科目的树（ERPNext 的 Account 有 parent_account ·
-- lft · rgt · 40 种 account_type，[任务 133] 读过原文）——
-- 那是给有会计部门的公司做的。**他有八个。**
--
-- 名字可以改，跟 `stage` · `category` · `unit` 同一条：他自己的话。
-- 代号不能改 —— 代号是程式用的，名字是人看的。

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 程式用的。八个之一，永远不变。 */
  code text not null check (code in (
    'cash', 'receivable', 'inventory',
    'payable', 'deposits',
    'opening', 'income', 'expense'
  )),

  /* 人看的。他改得了。 */
  name text not null,

  /* 摆在哪一边。这一栏是**算出来的意思**，不是他的选择 —— 一个科目
     属於资产还是负债不是一个偏好。 */
  kind text not null check (kind in ('asset', 'liability', 'equity', 'income', 'expense')),

  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ledger_accounts_one_per_code unique (project_id, code)
);

alter table public.ledger_accounts enable row level security;

drop policy if exists "ledger_accounts_money" on public.ledger_accounts;
/* 🔴 `sees_money` —— 这是他的帐。师傅不该从科目表上学到这家公司有多少现金。 */
create policy "ledger_accounts_money" on public.ledger_accounts
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

comment on table public.ledger_accounts is
  'Eight buckets, not a chart of accounts tree. The code is fixed (programs read it), the name is his own words (people read it), the kind is derived meaning rather than a preference. See 20260905570000.';

-- ── 开帐：他打的唯一那几个数字 ────────────────────────────────────────────

create table if not exists public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 只有这五个开得了帐。收入 · 费用 · 开帐权益不开帐 ——
     收入费用是一段期间发生的事，权益是另外四个算出来的结果。 */
  code text not null check (code in ('cash', 'receivable', 'inventory', 'payable', 'deposits')),

  /* 正数。方向由 code 决定 —— 一个负数的「银行有多少」是一个打错的字，
     而不是一个透支（透支要另一个科目，而他还没有）。 */
  amount_cents bigint not null check (amount_cents >= 0),

  /* 哪一天开的帐。这一天之前的事情我们不知道，也不该假装知道。 */
  as_on date not null,

  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opening_balances_one_per_code unique (project_id, code)
);

alter table public.opening_balances enable row level security;

drop policy if exists "opening_balances_money" on public.opening_balances;
create policy "opening_balances_money" on public.opening_balances
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

comment on table public.opening_balances is
  'What he had on the day he started using this. One number per bucket; the other side is always 「開帳」 equity, so it can never fail to balance and he never has to think about a contra account. See 20260905570000.';

-- ── 建那八个 ──────────────────────────────────────────────────────────────

create or replace function public.ensure_ledger_accounts(in_project_id uuid)
returns setof public.ledger_accounts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  is_en boolean;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;

  select p.system_language = 'en' into is_en
    from public.projects p where p.id = in_project_id;

  insert into public.ledger_accounts (project_id, code, name, kind, sort_order)
  values
    (in_project_id, 'cash',       case when is_en then 'Cash and bank'      else '现金 · 银行'   end, 'asset',     10),
    (in_project_id, 'receivable', case when is_en then 'Owed to me'         else '客人还欠我'    end, 'asset',     20),
    (in_project_id, 'inventory',  case when is_en then 'Stock on hand'      else '架上的货'      end, 'asset',     30),
    (in_project_id, 'payable',    case when is_en then 'I still owe'        else '我还欠人家'    end, 'liability', 40),
    (in_project_id, 'deposits',   case when is_en then 'Held for customers' else '客人先付的钱'  end, 'liability', 50),
    (in_project_id, 'opening',    case when is_en then 'Opening'            else '开帐'          end, 'equity',    60),
    (in_project_id, 'income',     case when is_en then 'Money in'           else '收到的钱'      end, 'income',    70),
    (in_project_id, 'expense',    case when is_en then 'Money out'          else '花掉的钱'      end, 'expense',   80)
  on conflict (project_id, code) do nothing;

  return query
    select * from public.ledger_accounts
     where project_id = in_project_id order by sort_order;
end;
$fn$;

revoke execute on function public.ensure_ledger_accounts(uuid) from public, anon;
grant execute on function public.ensure_ledger_accounts(uuid) to authenticated;

comment on function public.ensure_ledger_accounts(uuid) is
  'Seeds the eight buckets in the system''s own language. Idempotent, and it never renames what he has already renamed. See 20260905570000.';

create or replace function public.set_ledger_account_name(
  in_project_id uuid,
  in_code text,
  in_name text
)
returns public.ledger_accounts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.ledger_accounts;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  if coalesce(btrim(in_name), '') = '' then
    raise exception 'a bucket needs a name';
  end if;

  perform public.ensure_ledger_accounts(in_project_id);

  update public.ledger_accounts
     set name = left(btrim(in_name), 80), updated_at = now()
   where project_id = in_project_id and code = in_code
  returning * into row;

  if row.id is null then
    raise exception 'no such bucket';
  end if;
  return row;
end;
$fn$;

revoke execute on function public.set_ledger_account_name(uuid, text, text) from public, anon;
grant execute on function public.set_ledger_account_name(uuid, text, text) to authenticated;

create or replace function public.set_opening_balance(
  in_project_id uuid,
  in_code text,
  in_amount_cents bigint,
  in_as_on date,
  in_note text default ''
)
returns public.opening_balances
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.opening_balances;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  if in_as_on is null then
    raise exception 'say which day you started';
  end if;
  if in_as_on > public.today_myt() then
    raise exception 'you cannot have started in the future';
  end if;
  if coalesce(in_amount_cents, 0) < 0 then
    raise exception 'an opening figure is not negative';
  end if;

  perform public.ensure_ledger_accounts(in_project_id);

  insert into public.opening_balances (project_id, code, amount_cents, as_on, note, created_by)
  values (in_project_id, in_code, coalesce(in_amount_cents, 0), in_as_on,
          left(coalesce(in_note, ''), 500), auth.uid())
  on conflict (project_id, code) do update
    set amount_cents = excluded.amount_cents,
        as_on = excluded.as_on,
        note = excluded.note,
        updated_at = now()
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.set_opening_balance(uuid, text, bigint, date, text)
  from public, anon;
grant execute on function public.set_opening_balance(uuid, text, bigint, date, text)
  to authenticated;

comment on function public.set_opening_balance(uuid, text, bigint, date, text) is
  'One figure per bucket. The contra is always 「開帳」 equity, so it cannot fail to balance and he is never asked to pick a second account. See 20260905570000.';

-- ── 试算表 ────────────────────────────────────────────────────────────────
--
-- 🔴 **它一定平**，而且不是靠一句检查 —— 是靠每一行都从**同一个事实**
-- 的两边推出来的。一笔钱进来，借方现金跟贷方（收入或预收）是同一个数字。

create or replace function public.trial_balance(
  in_project_id uuid,
  in_from date default null,
  in_to date default null
)
returns table (
  code text,
  name text,
  kind text,
  debit_cents bigint,
  credit_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d_from date;
  d_to date;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;

  d_from := coalesce(in_from, date '1900-01-01');
  d_to := coalesce(in_to, public.today_myt());

  return query
  with acc as (
    select a.code, a.name, a.kind, a.sort_order
    from public.ledger_accounts a where a.project_id = in_project_id
  ),
  /* 冲正过的、自己是冲正的，两边都不算 —— 一笔冲正的方向跟原本那笔相反，
     所以一支只会 sum 的试算表，会把「那笔钱其实没收到」算成一笔费用。
     lib/portal/allocations.ts 的 countsAsReceived 写的是同一条。 */
  live as (
    select e.*
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.entry_on between d_from and d_to
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
  ),
  moved as (
    select
      coalesce(sum(case when l.direction = 'in' then l.amount_cents else 0 end), 0)::bigint as cash_in,
      coalesce(sum(case when l.direction = 'out' then l.amount_cents else 0 end), 0)::bigint as cash_out,
      /* 分摊出去的那一部分才是收入；剩下的还是客人的钱。 */
      coalesce(sum(case when l.direction = 'in' then least(l.allocated_cents, l.amount_cents) else 0 end), 0)::bigint as earned,
      coalesce(sum(case when l.direction = 'in'
                        then greatest(l.amount_cents - l.allocated_cents, 0) else 0 end), 0)::bigint as held
    from live l
  ),
  /* 开帐只在它那一天落在期间内才算进来。 */
  op as (
    select o.code, o.amount_cents
    from public.opening_balances o
    where o.project_id = in_project_id and o.as_on between d_from and d_to
  ),
  op_total as (
    select
      coalesce(sum(case when o.code in ('cash', 'receivable', 'inventory') then o.amount_cents else 0 end), 0)::bigint as assets,
      coalesce(sum(case when o.code in ('payable', 'deposits') then o.amount_cents else 0 end), 0)::bigint as liabs
    from op o
  ),
  rows as (
    select 'cash'::text as code,
           (select m.cash_in from moved m) + coalesce((select o.amount_cents from op o where o.code = 'cash'), 0) as dr,
           (select m.cash_out from moved m) as cr
    union all
    select 'receivable',
           coalesce((select o.amount_cents from op o where o.code = 'receivable'), 0), 0::bigint
    union all
    select 'inventory',
           coalesce((select o.amount_cents from op o where o.code = 'inventory'), 0), 0::bigint
    union all
    select 'payable',
           0::bigint, coalesce((select o.amount_cents from op o where o.code = 'payable'), 0)
    union all
    select 'deposits',
           0::bigint, (select m.held from moved m)
                      + coalesce((select o.amount_cents from op o where o.code = 'deposits'), 0)
    union all
    /* 开帐权益 = 开帐的资产 − 开帐的负债。**永远是配平的那一边。** */
    select 'opening',
           greatest(-((select t.assets from op_total t) - (select t.liabs from op_total t)), 0)::bigint,
           greatest((select t.assets from op_total t) - (select t.liabs from op_total t), 0)::bigint
    union all
    select 'income', 0::bigint, (select m.earned from moved m)
    union all
    select 'expense', (select m.cash_out from moved m), 0::bigint
  )
  select a.code, a.name, a.kind, r.dr::bigint, r.cr::bigint
  from acc a join rows r on r.code = a.code
  order by a.sort_order;
end;
$fn$;

revoke execute on function public.trial_balance(uuid, date, date) from public, anon;
grant execute on function public.trial_balance(uuid, date, date) to authenticated;

comment on function public.trial_balance(uuid, date, date) is
  'A CASH-BASIS trial balance. It balances by construction -- both sides of every line come from the same fact -- and it deliberately does not recognise revenue on an unpaid document, because when a document becomes revenue is an accounting policy, not a formula. See 20260905570000.';

-- ── 这一天的位置 ──────────────────────────────────────────────────────────
--
-- 试算表是照收付实现制出的（它平）；**应收跟应付是备忘**，
-- 分开列 —— 那正是他的会计拿去转成权责发生制要用的两个数字，
-- 而混进试算表里就会变成一份看起来像、其实不是的东西。

create or replace function public.financial_position(
  in_project_id uuid,
  in_as_of date default null
)
returns table (
  as_of date,
  cash_cents bigint,
  receivable_cents bigint,
  payable_cents bigint,
  deposits_cents bigint,
  inventory_cents bigint,
  inventory_known boolean,
  items_without_cost integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  d date;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  d := coalesce(in_as_of, public.today_myt());

  return query
  with live as (
    select e.*
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.entry_on <= d
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
  ),
  cash as (
    select coalesce((select o.amount_cents from public.opening_balances o
                      where o.project_id = in_project_id and o.code = 'cash' and o.as_on <= d), 0)
           + coalesce(sum(case when l.direction = 'in' then l.amount_cents else -l.amount_cents end), 0)
           as c
    from live l
  ),
  held as (
    select coalesce(sum(greatest(l.amount_cents - l.allocated_cents, 0)), 0) as h
    from live l where l.direction = 'in'
  ),
  owed as (
    select coalesce(sum(pd.owed_cents), 0) as r
    from public.party_debts(in_project_id) pd
  ),
  /* 我还欠人家：进货单的总额，减掉已经分摊到它身上的付款。 */
  bills as (
    select coalesce(sum(greatest(
             coalesce(p.amount_cents, 0) - coalesce((
               select sum(a.amount_cents) from public.ledger_allocations a
               join public.ledger_entries e2 on e2.id = a.entry_id
               where a.record_id = p.id and e2.direction = 'out'
                 and e2.adjusts_id is null
                 and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e2.id)
             ), 0), 0)), 0) as p
    from public.pipeline_records p
    where p.project_id = in_project_id
      and p.module_key = 'purchases'
      and p.archived_at is null
      and coalesce(p.issued_on, p.created_at::date) <= d
  ),
  /* 🔴 存货只有在**每一件有货的东西都有成本**的时候才算得出来。
     少一件就整个讲「算不出来」，而不是把那一件当成 0 ——
     一个偷偷少算的存货，就是一份看起来没问题的资产负债表。 */
  stock as (
    select
      coalesce(sum(case when i.cost_cents is not null
                        then s.on_hand * i.cost_cents else 0 end), 0)::bigint as v,
      count(*) filter (where i.cost_cents is null and s.on_hand > 0)::integer as missing
    from public.stock_on_hand s
    join public.catalog_items i on i.id = s.item_id
    where s.project_id = in_project_id
  )
  select d,
         (select c.c from cash c)::bigint,
         (select o.r from owed o)::bigint,
         (select b.p from bills b)::bigint,
         (select h.h from held h)::bigint,
         (select st.v from stock st),
         (select st.missing from stock st) = 0,
         (select st.missing from stock st);
end;
$fn$;

revoke execute on function public.financial_position(uuid, date) from public, anon;
grant execute on function public.financial_position(uuid, date) to authenticated;

comment on function public.financial_position(uuid, date) is
  'Where the business stands on one day. Stock is valued only when every item holding stock has a cost -- one missing cost reports inventory_known = false rather than quietly counting it as zero, because a silently short balance sheet is the kind that looks fine. See 20260905570000.';

-- ── 🔴 它还不是什么（自己讲，不要等他发现）────────────────────────────────
--
--   · **不是权责发生制** —— 一张开出去还没收钱的单，不算收入。
--     应收 · 应付另外列成备忘，而那两个正是他的会计拿去转的东西
--   · **没有折旧 · 没有应计 · 没有多币别 · 不给手打分录**
--   · **存货用的是成本单价，不是先进先出／加权平均** ——
--     那要一整套成本流，而它只在做真的存货会计的时候才值得
--   · **画面上没有那一页** —— 这是底下那一层
--   · ⚠️ **不要把这一份叫「资产负债表」拿给银行** ——
--     它是给他自己看、给他的会计当底稿的

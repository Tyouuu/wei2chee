-- 月结对帐单 —— 一个客户，一段时间，开了哪几张单、给了哪几笔、还欠多少。
--
-- ── 为什么这一件是八个行业都要的 ──────────────────────────────────────────
--
-- 装修的进度款、五金店的月结客、批发的赊帐、补习班的学费、沙龙的套票 ——
-- **每一门生意每个月都要跟某一个人对一次帐**，而今天他是把 WhatsApp
-- 往上滚，一张一张单自己加。
--
-- [任务 113] 逐格对照 ERPNext · SQL Account · Aoikumo 的时候，
-- 这一格写着「数字算得出来了，**差一张发得出去的纸**」。
-- 这一支是那张纸底下的算术；纸本身是画面那一层。
--
-- ── 🔴 一个问题只能有一个答案 ────────────────────────────────────────────
--
-- 「他还欠我多少」`party_debts`（20260904060000）已经在答，而它算的是
-- **单据减掉分摊**。这一支如果把「还没分摊的订金」也混进同一个数字里，
-- 同一个问题就有两个答案，而两个答案迟早会不一样 ——
-- 这个仓库最贵的那一类缺陷。
--
-- 所以分成**两个具名的数字**，不是一个混出来的：
--
--   closing_cents     单据上还欠多少   ← 跟 party_debts 一模一样的算法
--   deposit_cents     他先给了、还没扣掉的钱
--
-- 一张对帐单上把这两个分开写，是这一行本来就在做的事：
-- 「你还欠 RM 45,500，另外你那边有 RM 3,000 的订金还没扣」。
--
-- ── ⚠️ 分摊没有自己的日期 ────────────────────────────────────────────────
--
-- `ledger_allocations` 只有金额，日期在那笔钱身上（`entry_on`）。
-- 那是对的：钱是哪一天进来的，分摊只是把它切开。所以这里一律用 `entry_on`。

-- ── 一个人的一段帐 ────────────────────────────────────────────────────────
create or replace function public.party_statement(
  p_project_id uuid,
  p_party_id uuid,
  p_from date,
  p_to date
)
returns table (
  kind text,
  on_date date,
  doc_no text,
  title text,
  charge_cents bigint,
  credit_cents bigint,
  running_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  opening bigint;
begin
  /* 🔴 钱那一层。一张对帐单上写着他欠多少 ——
     跟收款那一页是同一件事，所以问同一句。 */
  if not public.sees_money(p_project_id) then
    raise exception 'not your project';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'that period runs backwards';
  end if;

  /* 期初：这一天之前，单据减掉已经分摊的。 */
  select
    coalesce((
      select sum(r.amount_cents) from public.pipeline_records r
      where r.project_id = p_project_id and r.party_id = p_party_id
        and r.archived_at is null and r.module_key <> 'purchases'
        and coalesce(r.amount_cents, 0) > 0
        and coalesce(r.due_on, r.issued_on) < p_from
    ), 0)
    -
    coalesce((
      select sum(a.amount_cents)
      from public.ledger_allocations a
      join public.ledger_entries e on e.id = a.entry_id
      join public.pipeline_records r on r.id = a.record_id
      where e.project_id = p_project_id and r.party_id = p_party_id
        and e.entry_on < p_from
        and e.adjusts_id is null
        and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    ), 0)
  into opening;

  return query
  with lines as (
    /* 开出去的单。**买的那一边不算** —— 进货单是我欠人家。 */
    select
      'charge'::text as kind,
      coalesce(r.due_on, r.issued_on) as on_date,
      coalesce(r.doc_no, '') as doc_no,
      coalesce(nullif(btrim(r.title), ''), coalesce(r.party, '')) as title,
      coalesce(r.amount_cents, 0)::bigint as charge_cents,
      0::bigint as credit_cents,
      /* 同一天的时候，先算他欠的再算他给的 —— 一张纸上
         「开单 → 收款」读得下去，「收款 → 开单」读起来像先付后买。 */
      0 as ord
    from public.pipeline_records r
    where r.project_id = p_project_id and r.party_id = p_party_id
      and r.archived_at is null and r.module_key <> 'purchases'
      and coalesce(r.amount_cents, 0) > 0
      and coalesce(r.due_on, r.issued_on) between p_from and p_to

    union all

    /* 收到的钱，按它扣在哪一张单上。冲正过的、跟自己是冲正的都不算 ——
       跟 party_debts 跟 lib/portal/allocations.ts 同一条规矩。 */
    select
      'payment'::text,
      e.entry_on,
      coalesce(e.doc_no, ''),
      coalesce(nullif(btrim(r.title), ''), coalesce(r.doc_no, '')),
      0::bigint,
      a.amount_cents::bigint,
      1
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    join public.pipeline_records r on r.id = a.record_id
    where e.project_id = p_project_id and r.party_id = p_party_id
      and e.entry_on between p_from and p_to
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
  ),
  ordered as (
    select l.*,
           opening + sum(l.charge_cents - l.credit_cents)
             over (order by l.on_date, l.ord, l.doc_no
                   rows between unbounded preceding and current row) as running
    from lines l
  )
  select 'opening'::text, p_from, ''::text, ''::text, 0::bigint, 0::bigint, opening
  union all
  select o.kind, o.on_date, o.doc_no, o.title, o.charge_cents, o.credit_cents, o.running::bigint
  from ordered o
  order by 2, 5 desc, 3;
end;
$$;

revoke execute on function public.party_statement(uuid, uuid, date, date) from public, anon;
grant execute on function public.party_statement(uuid, uuid, date, date) to authenticated;

comment on function public.party_statement(uuid, uuid, date, date) is
  'One party''s account over one period: opening balance, every charge and every payment, with a running balance. Deposits not yet allocated are NOT folded in -- see party_deposit, and the header of 20260905140000 for why one question may only have one answer.';

-- ── 他先给了、还没扣掉的钱 ────────────────────────────────────────────────
--
-- 那是 `amount_cents - allocated_cents` 加起来 —— 同一个减法在
-- [任务 61](#61) · [67](#67) · [44](#44) 各被要过一次，
-- 而它现在有一个具名的出口。
create or replace function public.party_deposit(
  p_project_id uuid,
  p_party_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(e.amount_cents - e.allocated_cents), 0)::bigint
  from public.ledger_entries e
  where e.project_id = p_project_id
    and e.party_id = p_party_id
    and e.direction = 'in'
    and e.adjusts_id is null
    and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    and public.sees_money(p_project_id);
$$;

revoke execute on function public.party_deposit(uuid, uuid) from public, anon;
grant execute on function public.party_deposit(uuid, uuid) to authenticated;

-- ── 账龄：欠了多久，分段 ──────────────────────────────────────────────────
--
-- SQL Account 的 `Customer` 那一栏，它自己列的卖点第一个就是**账龄**
-- （[任务 67]）。[任务 125] 做了「最老的那一笔几天」，而一个批发商真正在读的
-- 是**分段**：这个月的 · 一个月 · 两个月 · 三个月以上。
--
-- ⚠️ **一样不存**。同一笔钱今天 59 天、明天 61 天，而没有人会在半夜去改那一栏
-- —— 跟 20260904060000 的判断一字不差。
create or replace function public.party_aging(p_project_id uuid)
returns table (
  party_id uuid,
  current_cents bigint,
  d30_cents bigint,
  d60_cents bigint,
  d90_cents bigint,
  older_cents bigint,
  total_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select r.id, r.party_id, r.amount_cents,
           public.today_myt() - coalesce(r.due_on, r.issued_on) as age
    from public.pipeline_records r
    where r.project_id = p_project_id
      and r.party_id is not null
      and r.archived_at is null
      and coalesce(r.amount_cents, 0) > 0
      and r.module_key <> 'purchases'
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = p_project_id
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),
  owing as (
    select l.party_id,
           greatest(l.amount_cents - coalesce(p.taken, 0), 0) as still,
           coalesce(l.age, 0) as age
    from live l left join paid p on p.record_id = l.id
  )
  select o.party_id,
         sum(case when o.age <= 0  then o.still else 0 end)::bigint,
         sum(case when o.age between 1 and 30  then o.still else 0 end)::bigint,
         sum(case when o.age between 31 and 60 then o.still else 0 end)::bigint,
         sum(case when o.age between 61 and 90 then o.still else 0 end)::bigint,
         sum(case when o.age > 90 then o.still else 0 end)::bigint,
         sum(o.still)::bigint
  from owing o
  where public.sees_money(p_project_id)
  group by o.party_id
  having sum(o.still) > 0;
$$;

revoke execute on function public.party_aging(uuid) from public, anon;
grant execute on function public.party_aging(uuid) to authenticated;

comment on function public.party_aging(uuid) is
  'Aged receivables per party, in the buckets a wholesaler reads: current, 1-30, 31-60, 61-90, over 90. Computed, never stored -- the same debt is 59 days old today and 61 tomorrow. See 20260905140000.';

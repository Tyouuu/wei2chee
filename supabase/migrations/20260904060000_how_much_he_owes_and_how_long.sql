-- 他欠多少，欠多久了，还能不能再出货。
--
-- ── 为什么这一格是批发的刚需 ──────────────────────────────────────────────
--
-- [任务 67] 实查 SQL Account 的时候，`Customer` 那一栏它自己列的卖点是
-- **「账龄 · 信用额度 · CTOS」** —— 三样里两样是这一件。
--
-- 一个批发商每天在做的判断是：**「这家还欠我三万，六十天了，今天这一车
-- 还要不要出？」** 而我们今天答得出「还欠三万」（今天早上做的客户页），
-- 答不出「多久了」，也没有地方写「他最多欠我两万」。
--
-- ── 抄一栏，其余全部算出来 ────────────────────────────────────────────────
--
--   ✅ **`credit_limit_cents`** —— 唯一要存的一栏
--   ❌ **帐龄不存。** 它是一个**读的时候**的问题：同一笔钱，今天 59 天、
--      明天 61 天，而没有人会在半夜去改那一栏。存起来的帐龄，
--      是一个每天早上都变旧的数字。
--      （跟库存总数是流水加起来的、过期是读的时候算的，同一条判断。）
--   ❌ **CTOS 不抄** —— 那是一家征信公司的 API，要钱、要合约，
--      而且他现在一个客户都还没有
--
-- ── 🔴 额度是一句话，不是一道门 ──────────────────────────────────────────
--
-- 超过额度**不挡他开单**。理由不是偷懒：
--   · 那个额度是他自己随手写的一个数字，不是银行核的
--   · 而真实情况是「这家老客户超一点没关系，那家新的不行」——
--     一道挡死的门，会让他把额度删掉，然后这一栏就永远是空的
--
-- 所以它做成**开单那一刻的一句提醒**，在他按下去之前讲。
-- 那跟「不准画一颗按不动的按钮」是同一条：**我们讲事实，判断留给他。**

alter table public.directory_entries
  add column if not exists credit_limit_cents bigint
  check (credit_limit_cents is null or credit_limit_cents >= 0);

comment on column public.directory_entries.credit_limit_cents is
  'What he is willing to let this customer owe. NULL is normal and means no limit -- it is a sentence shown when writing a new job, never a gate. Ageing is NOT stored: it is a read-time question. See 20260904060000.';

-- ── 他欠多少、欠多久 ──────────────────────────────────────────────────────
--
-- 一支函式，回一个 project 里每一个对象的「未收」跟「最老的那一笔多久了」。
--
-- 🔴 为什么在资料库里算而不是在页面上算：客户那一页要一次列出所有客户
-- 的欠款，而那是「每一个客户 × 他的每一张单 × 每一笔分摊」——
-- 在浏览器里做就是把整本帐送到他手机上。
--
-- ⚠️ 而「算不算收到」那条规矩**跟 lib/portal/allocations.ts 是同一条**：
-- 冲正过的、跟自己是冲正的，都不算。两个地方各写一次是这个仓库最贵的
-- 那一类缺陷 —— 所以那一段在这里原样重复，而且两边都指着对方。
-- （SQL 那一层没有办法 import TypeScript；能做的是让它们对得上、
--   而且用同一批断言验：check:records 那几条同时打两边。）

create or replace function public.party_debts(in_project_id uuid)
returns table (
  party_id uuid,
  owed_cents bigint,
  oldest_days integer,
  limit_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select r.id, r.party_id, r.amount_cents, coalesce(r.due_on, r.issued_on) as since
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.party_id is not null
      and r.archived_at is null
      and coalesce(r.amount_cents, 0) > 0
      /* 买的那一边不算他欠我 —— 进货单是我欠人家。 */
      and r.module_key <> 'purchases'
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      /* 冲正过的、跟自己是冲正的，都不算收到。
         同一条规矩写在 lib/portal/allocations.ts 的 countsAsReceived。 */
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),
  outstanding as (
    select l.party_id,
           greatest(l.amount_cents - coalesce(p.taken, 0), 0) as still_owed,
           l.since
    from live l
    left join paid p on p.record_id = l.id
  )
  select o.party_id,
         sum(o.still_owed)::bigint as owed_cents,
         /* 最老的那一笔**还没收齐的**单，欠了几天。收齐的不算 ——
            一张三年前收齐的单不该让这个客户看起来欠了三年。 */
         max(
           case when o.still_owed > 0 and o.since is not null
                then (public.today_myt() - o.since)
                else null end
         )::integer as oldest_days,
         max(d.credit_limit_cents)::bigint as limit_cents
  from outstanding o
  join public.directory_entries d on d.id = o.party_id
  /* 🔴 `sees_money`，不是 `works_here`。
     这一支是 security definer，所以它绕过 RLS —— 而它 join 的
     `ledger_allocations` 是老板一个人的。写成 works_here 的话，
     一个师傅打这一支就学得到每一个客户欠多少。
     第一版我就是写 works_here，推上去之前才看到。 */
  where public.sees_money(in_project_id)
  group by o.party_id
  having sum(o.still_owed) > 0;
$$;

revoke execute on function public.party_debts(uuid) from public, anon;
grant execute on function public.party_debts(uuid) to authenticated;

comment on function public.party_debts(uuid) is
  'Per party: what is still owed, how old the oldest unsettled document is, and the credit limit. Ageing is computed here rather than stored because it changes every night. See 20260904060000.';

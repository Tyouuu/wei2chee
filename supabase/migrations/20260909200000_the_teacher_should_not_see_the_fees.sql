-- 🔴 `class_fees_due` 第一版我写成 `works_here` —— 一个老师因此读得到
-- 每一个学生欠多少学费。
--
-- ⚠️ 而 `party_debts`（20260904060000）的注解白纸黑字写过同一句：
-- 「**第一版我就是写 works_here，推上去之前才看到。**」
-- 这一次我在推上去之后才看到 —— 而它今天**零个呼叫端**，
-- 所以这一次收紧的爆炸半径是零（[重点 31]：收紧最危险，而这一支还没有人用）。
--
-- ── 两条守卫，两个不同的问题 ──────────────────────────────────────────────
--
-- | 问什么 | 用哪一条 |
-- |---|---|
-- | 这个班在不在你家 | `works_here` —— 那是一个存在性的问题 |
-- | 🔴 **你看不看得到钱** | `sees_money` |
--
-- ── 🔴 而它抛，不回空集合 ─────────────────────────────────────────────────
--
-- `party_debts` 回空集合，而 [任务 142] 写过那个代价：
-- **一个师傅拿回空的，跟「每一张单都收齐了」长得一模一样。**
-- 那一支是一份**总表**，画面那一边分得出 null 跟空阵列；
-- 而这一支是**按班**的 —— 一个老师打开那一段读到空的，
-- 会以为这个班没有人欠钱。所以它讲一句话。
--
-- ⚠️ **`bill_class` 照旧 `works_here`，故意的**：它底下走的
-- `add_pipeline_record` 就是 `works_here`（一个师傅在工地上开得了一张工单，
-- 而那张单上本来就有金额）。**一个函式挡得比它底下那一支还严，
-- 就是在替资料库发明一条它没有的规矩。**

create or replace function public.class_fees_due(
  in_group_id uuid,
  in_period text default null
)
returns table (
  party_id uuid,
  student text,
  record_id uuid,
  doc_no text,
  amount_cents bigint,
  paid_cents bigint,
  owed_cents bigint,
  due_on date
)
language plpgsql
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
  /* 🔴 这一句是 20260909200000 加的。它讲得出为什么，
     而不是把一个老师留在一份空的清单前面。 */
  if not public.sees_money(grp.project_id) then
    raise exception 'the fees on a class are for the owner';
  end if;

  return query
  select
    d.id,
    d.name,
    r.id,
    r.doc_no,
    coalesce(r.amount_cents, 0)::bigint,
    coalesce(paid.cents, 0)::bigint,
    (coalesce(r.amount_cents, 0) - coalesce(paid.cents, 0))::bigint,
    r.due_on
  from public.class_members m
  join public.directory_entries d on d.id = m.party_id
  join public.pipeline_records r
    on r.project_id = grp.project_id
   and r.party_id = m.party_id
   and r.archived_at is null
   and r.idempotency_key = md5(
         in_group_id::text
         || coalesce(nullif(btrim(in_period), ''), to_char(public.today_myt(), 'YYYY-MM'))
         || m.party_id::text
       )::uuid
  left join lateral (
    select sum(a.amount_cents) as cents
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where a.record_id = r.id
      and e.adjusts_id is null
      and not exists (
        select 1 from public.ledger_entries rev where rev.adjusts_id = e.id
      )
  ) paid on true
  where m.left_on is null
  order by (coalesce(r.amount_cents, 0) - coalesce(paid.cents, 0)) desc, d.name;
end;
$$;

revoke execute on function public.class_fees_due(uuid, text) from public, anon;
grant execute on function public.class_fees_due(uuid, text) to authenticated;

comment on function public.class_fees_due(uuid, text) is
  'One row per student in a class for one billing period: billed, received, still owed. sees_money, not works_here -- it is security definer over ledger_allocations, which is the owner''s alone. Reads the same table party_debts reads, so the two never disagree. See 20260909200000.';

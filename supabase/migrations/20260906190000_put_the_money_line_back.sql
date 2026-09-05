-- 改回去。从 20260906130000 原样抽出来，不是照记忆重打。
--
-- 弄坏那一版红出来的是这三条:
--     师傅看不到「报价快到期」 -- ["contract_due","agreed_unpaid","quote_expiring",...]
--     金额那一栏对他是空的     -- [null,480000,480000,null]
-- 一个师傅打开那一页，看到他老板那张 RM 4,800 的报价。

create or replace function public.nudges_due(
  in_project_id uuid,
  /* 看到哪一天为止。不给就是今天 ＋ 三天 —— 「快到期」本来就要提前讲。 */
  in_until date default null
)
returns table (
  kind text,
  subject_id uuid,
  record_id uuid,
  party text,
  title text,
  due_on date,
  days_late integer,
  amount_cents bigint,
  qty_left numeric,
  qty_floor numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cutoff date;
  money boolean;
  today date;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  today := public.today_myt();
  cutoff := coalesce(in_until, today + 3);
  money := public.sees_money(in_project_id);

  return query
  with hushed as (
    select s.kind, s.subject_id
    from public.nudge_snoozes s
    where s.project_id = in_project_id and s.until >= today
  ),
  taken as (
    /* 这张单收到多少 —— 跟 `party_debts` 同一条：冲正过的不算。 */
    select a.record_id, sum(a.amount_cents) as got
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      and e.direction = 'in'
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),

  /* ① 报价快到期，而且还没变成钱。
     「已确认」是他自己的词，测不了 —— **收到钱没有**是事实，测得了。 */
  quote_expiring as (
    select 'quote_expiring'::text as kind, r.id as subject_id, r.id as record_id,
           coalesce(r.party, '') as party, coalesce(r.title, '') as title,
           r.due_on, coalesce(r.amount_cents, 0)::bigint as amount_cents,
           null::numeric as qty_left, null::numeric as qty_floor
    from public.pipeline_records r
    left join taken t on t.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.module_key = 'quotations'
      and r.archived_at is null
      and r.due_on is not null
      and r.due_on <= cutoff
      and coalesce(t.got, 0) = 0
  ),

  /* ② 客人按了「同意」，而一分订金都还没进来。
     🔴 这一条是六条链里最贵的那一节 —— 他不知道客人答应了。 */
  agreed_unpaid as (
    select 'agreed_unpaid'::text, r.id, r.id,
           coalesce(r.party, ''), coalesce(r.title, ''),
           r.answered_at::date,
           coalesce(r.amount_cents, 0)::bigint,
           null::numeric, null::numeric
    from public.pipeline_records r
    left join taken t on t.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.archived_at is null
      and r.answered_at is not null
      and r.answer = 'accepted'
      and coalesce(t.got, 0) = 0
  ),

  /* ③ 保养该去了。**重用 `due_visits`**，不自己再算一次 ——
     同一个问题两个答案，这个仓库栽过至少八次。 */
  contract_due as (
    select 'contract_due'::text, v.contract_id, v.record_id,
           coalesce(v.party, ''), coalesce(v.title, ''),
           v.due_on, null::bigint, null::numeric, null::numeric
    from public.due_visits(in_project_id, null, cutoff) v
    where v.done_on is null
  ),

  /* ④ 套票剩最后一次 —— 那是他打电话叫客人续的那一刻。
     剩 0 次的不讲：那不是「快用完」，那是「用完了」。 */
  package_last as (
    select 'package_last'::text, b.package_id, null::uuid,
           coalesce(d.name, ''), coalesce(b.name, ''),
           b.expires_on, null::bigint,
           b.sessions_left::numeric, null::numeric
    from public.package_balance b
    join public.directory_entries d on d.id = b.party_id
    where b.project_id = in_project_id
      and b.archived_at is null
      and not b.expired
      and b.sessions_left = 1
  ),

  /* ⑤ 补货线破了。`reorder_at` 从建表那天就在，
     而在今天之前**没有任何地方读过它**（第 N 次「能力有、线没接」）。 */
  below_reorder as (
    select 'below_reorder'::text, i.id, null::uuid,
           '', coalesce(i.name, ''),
           null::date, null::bigint,
           coalesce(h.on_hand, 0)::numeric, i.reorder_at::numeric
    from public.catalog_items i
    left join public.stock_on_hand h on h.item_id = i.id
    where i.project_id = in_project_id
      and i.archived_at is null
      and i.reorder_at is not null
      and coalesce(h.on_hand, 0) < i.reorder_at
  ),

  all_of as (
    select * from quote_expiring
    union all select * from agreed_unpaid
    union all select * from contract_due
    union all select * from package_last
    union all select * from below_reorder
  )
  select a.kind, a.subject_id, a.record_id, a.party, a.title, a.due_on,
         /* 逾期是算出来的。没有日子的（补货线 · 套票）没有逾期这回事。 */
         case when a.due_on is not null
              then greatest((today - a.due_on), 0)::integer end,
         case when money then a.amount_cents end,
         a.qty_left, a.qty_floor
  from all_of a
  where not exists (
    select 1 from hushed s where s.kind = a.kind and s.subject_id = a.subject_id
  )
  /* 逾期的排最前面 —— 他打开那一秒要看的不是「有五件事」，
     是「有一件上个礼拜就该做而你没做」。 */
  order by a.due_on nulls last, a.kind;
end;
$fn$;

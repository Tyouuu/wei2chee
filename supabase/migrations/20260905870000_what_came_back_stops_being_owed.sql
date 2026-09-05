-- 他把货拿回来了，「他还欠我多少」要跟着少。
--
-- 20260905840000 建好了退货，而**三个地方在算他还欠多少**，
-- 三个都还不知道退货这件事：`party_debts`（谁欠我）·
-- `party_aging`（帐龄那一页）· `party_statement`（月结那张纸）。
--
-- 🔴 少了这一支，一个把货拿回来的客人在那三个地方还欠全额 ——
-- **那是系统在说谎，不是少一个功能。**
--
-- ⚠️ 试算表（20260905570000）**故意没有改**，而这一句要写下来：
-- 那里的「客人还欠我」是他自己打的**开帐**数字，不是从单据算出来的；
-- 而收入是**收付实现制**的，退货没有收到的钱要冲。
-- 真的退现金出去的时候，那本来就是一笔钱出去，已经算进去了。
--
-- ⚠️ 三支都是**从各自最后一次定义的那个档案原样抽出来**，只加一段：
-- party_debts 在 20260904080000（不是 060000）· party_aging 在
-- 20260905140000 · party_statement 在 20260905160000（不是 140000）。
-- 「照记忆重打一支」在这个仓库咬过三次。

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
  credited as (
    select t.record_id, sum(t.credit_cents) as given
    from public.returns t
    where t.project_id = in_project_id
    group by t.record_id
  ),
  outstanding as (
    select l.party_id,
           /* 🔴 退过的那一部分他不欠了。少了这一句，一个把货拿回来的客人
              在这一页上还欠全额 —— 而那是系统在说谎，不是少一个功能。 */
           greatest(l.amount_cents - coalesce(c.given, 0) - coalesce(p.taken, 0), 0) as still_owed,
           l.since
    from live l
    left join paid p on p.record_id = l.id
    left join credited c on c.record_id = l.id
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
  credited as (
    select t.record_id, sum(t.credit_cents) as given
    from public.returns t
    where t.project_id = p_project_id
    group by t.record_id
  ),
  owing as (
    select l.party_id,
           greatest(l.amount_cents - coalesce(c.given, 0) - coalesce(p.taken, 0), 0) as still,
           coalesce(l.age, 0) as age
    from live l
    left join paid p on p.record_id = l.id
    left join credited c on c.record_id = l.id
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
    -
    /* 期初也要减掉这一天之前退过的 —— 不然期初比 party_debts 多，
       而这两个数字必须永远对得上（20260905140000 那条断言）。 */
    coalesce((
      select sum(t.credit_cents)
      from public.returns t
      join public.pipeline_records r on r.id = t.record_id
      where t.project_id = p_project_id and r.party_id = p_party_id
        and r.archived_at is null and r.module_key <> 'purchases'
        and t.returned_on < p_from
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

    union all

    /* 退回来的。它跟收款一样是「他欠的少了多少」，所以走同一栏 ——
       而它自己一栏是因为一张纸上要分得出「他给了钱」跟「他把货拿回来」。
       ⚠️ 没有单号（840000 档头写了为什么），认得出它的是那张单的名字。 */
    select
      'return'::text,
      t.returned_on,
      ''::text,
      coalesce(nullif(btrim(r.title), ''), coalesce(r.doc_no, '')),
      0::bigint,
      t.credit_cents::bigint,
      2
    from public.returns t
    join public.pipeline_records r on r.id = t.record_id
    where t.project_id = p_project_id and r.party_id = p_party_id
      and r.archived_at is null and r.module_key <> 'purchases'
      and t.credit_cents > 0
      and t.returned_on between p_from and p_to
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

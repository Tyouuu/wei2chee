-- 把 20260905150000 弄坏的改回去。两支都留着 —— 那是证据：
--
--   FAIL  🔴 订金没有混进期末余额 — **1000000 vs 1300000**
--
-- 那不是一个测试数字：**对帐单说他欠 RM 10,000，系统说 RM 13,000**，
-- 而那张纸是要发给客人的。
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

-- 那张对帐单的行序，跟它自己的累计对不上。
--
-- 20260905870000 给它加了第三种行（退货）之后，尺子当场报期末 800,000
-- 而「谁欠我钱」是 650,000 —— 两个答的是同一个问题。
--
-- 🔴 而真正坏的不是那个总数，是**画出来的那张纸自己在打架**（见函式里的注解）。
--
-- ⚠️ 这不是 870000 带出来的新毛病，是它把一个本来就在的脆弱地方**照亮了**：
-- 那句 `order by 2, 5 desc, 3` 从写出来那天就是窗口排序的替身，
-- 只是两种行的时候刚好对。**期初那一行也一样** —— 它靠「p_from 最早」
-- 排在最前，而一张 p_from 当天就开单的对帐单会把它挤到后面去。
--
-- ⚠️ 从 20260905870000 原样抽出来改那一段，不是照记忆重打。

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
  ),
  sheet as (
    /* 期初排在最前面，靠 -1，不是靠「它那一天最早」——
       一张 p_from 当天就开了单的对帐单，期初本来会掉到那张单后面。 */
    select 'opening'::text as kind, p_from as on_date, ''::text as doc_no,
           ''::text as title, 0::bigint as charge_cents, 0::bigint as credit_cents,
           opening as running_cents, -1 as ord
    union all
    select o.kind, o.on_date, o.doc_no, o.title, o.charge_cents, o.credit_cents,
           o.running::bigint, o.ord
    from ordered o
  )
  /* 🔴 **跟累计用同一把钥匙排。**
     本来这里写的是 `order by 2, 5 desc, 3` —— 那是窗口那三个键
     （on_date · ord · doc_no）的一个**替身**：只有「开单」跟「收款」
     两种行的时候，靠「开单的金额 > 0」刚好排得对。
     退货是第三种，金额 0、又没有单号，於是它排到收款前面 ——
     而累计还是照 ord 算的。画出来是这样：

         开单  1,000,000
         退货     -1,500   累计 650,000
         收款     -2,000   累计 800,000   ← 收了钱累计反而变大

     **一张自己跟自己打架的对帐单。** 两个排序合成一个就没有这件事。 */
  select s.kind, s.on_date, s.doc_no, s.title, s.charge_cents, s.credit_cents, s.running_cents
  from sheet s
  order by s.on_date, s.ord, s.doc_no;
end;
$$;

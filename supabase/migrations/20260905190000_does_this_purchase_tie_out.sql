-- 这张进货单：我叫了多少、到了多少、付了多少 —— 对得上吗。
--
-- ── 🔴 先看别人怎么做，然后**挑更简单的那一版** ──────────────────────────
--
--   `总之就是做每个功能前先参考别人看看有没有更简单的方法 别做错了`
--   `别就是要客户老板 一直绕远路 明明就有很简单的做法`（2026-09-05）
--
-- ERPNext 的三方核对是**三份单据**：采购单 → 收货单 → 供应商发票。
-- 我去读了它的 `Purchase Invoice` doctype 原文：**199 个栏位**，
-- 必填五个，另外还有 `update_billed_amount_in_purchase_order` ·
-- `update_billed_amount_in_purchase_receipt` 那一整套回写。
--
-- 照抄下去，一个五金店老板买一车水泥要**填三张表**。
--
-- 而他真正在问的只有一句话：
--
--   **「这张单我叫了多少、到了多少、付了多少，对得上吗？」**
--
-- 那是**一张单上的三个数字**，不是三份单据 —— 而三个数字，
-- 在他**今天已经在做的三个动作**里全部有了：
--
--   叫了多少   他开那张进货单                （20260831110000）
--   到了多少   他按「货到了」                 （20260901100000）
--   付了多少   他记一笔开销、分摊到这张单上   （20260903030000）
--
-- **所以这一件不是一个新表单，是一个「读」。他一步都不用多做。**
--
-- ── 🔴 而它诚实地答不了一件事，写下来不要假装 ───────────────────────────
--
-- **叫 100 包、来 90 包**，今天表达不了：`receive_purchase` 是照行上的
-- 数量整批进的，没有「实际到货几件」。他要嘛先把行改成 90 再按到货
-- （那样「叫了多少」就没了），要嘛之后补一笔盘点。
--
-- 那一格要动 `receive_purchase` 的输入，是**另一件事**，而且它一定会
-- 多一个要他填的栏位 —— 所以先把这一支能诚实回答的部分做完，
-- 缺的那一半明写在这里。

create or replace function public.purchase_match(in_record_id uuid)
returns table (
  ordered_cents bigint,
  paid_cents bigint,
  unpaid_cents bigint,
  lines_total integer,
  lines_arrived integer,
  arrived boolean,
  overpaid_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  /* 🔴 `sees_money`，不是 `works_here`：这一支回的是他付了多少给供应商，
     跟开销那一页是同一件事。 */
  if rec.id is null or not public.sees_money(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if rec.module_key <> 'purchases' then
    raise exception 'only a purchase order is matched this way';
  end if;

  ordered_cents := coalesce(rec.amount_cents, 0);

  /* 付了多少 —— 分摊到这张单上的、真的出去的钱。
     冲正过的、跟自己是冲正的都不算，跟 party_debts 同一条规矩。 */
  select coalesce(sum(a.amount_cents), 0)::bigint into paid_cents
  from public.ledger_allocations a
  join public.ledger_entries e on e.id = a.entry_id
  where a.record_id = in_record_id
    and e.direction = 'out'
    and e.adjusts_id is null
    and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id);

  unpaid_cents := greatest(ordered_cents - paid_cents, 0);
  overpaid_cents := greatest(paid_cents - ordered_cents, 0);

  /* 到了多少。**按行算**，因为一张单上常常是一半到了一半没到。
     ⚠️ 只数**有数量**的行 —— 一口价那种行（「运费 RM 300」）
     架上没有东西要动，把它算成「没到」会让每一张单都对不上。 */
  select count(*)::integer into lines_total
  from public.record_lines l
  where l.record_id = in_record_id and coalesce(l.qty, 0) > 0;

  select count(distinct m.line_id)::integer into lines_arrived
  from public.stock_moves m
  where m.against_id = in_record_id and m.line_id is not null;

  /* 一张单上一行都没有的时候（他只写了一个总额），
     「到了没有」看那张单自己走到哪一步 —— 而不是回一个假的 true。 */
  if lines_total = 0 then
    arrived := exists (
      select 1 from public.stock_moves m where m.against_id = in_record_id
    );
  else
    arrived := lines_arrived >= lines_total;
  end if;

  return next;
end;
$$;

revoke execute on function public.purchase_match(uuid) from public, anon;
grant execute on function public.purchase_match(uuid) to authenticated;

comment on function public.purchase_match(uuid) is
  'Ordered vs received vs paid for one purchase order. A READ over three things he already does, not a third document -- see the header of 20260905190000 for why ERPNext''s 199-field Purchase Invoice is the wrong shape for a five-person shop.';

-- ── 哪几张单对不上 ────────────────────────────────────────────────────────
--
-- 一整家的那一份。**只回对不上的那几张** —— 一份每次都印出全部的清单
-- 没有人会看，跟一把天天叫狼的尺是同一个毛病。
create or replace function public.purchase_mismatches(in_project_id uuid)
returns table (
  record_id uuid,
  doc_no text,
  party text,
  ordered_cents bigint,
  paid_cents bigint,
  arrived boolean,
  /* 'paid_not_arrived'  钱付了，货没到 —— 他要打电话
     'arrived_not_paid'  货到了，钱没付 —— 他要付钱
     'overpaid'          付超过了 */
  problem text
)
language sql
stable
security definer
set search_path = public
as $$
  with po as (
    select r.id, r.doc_no, r.party, coalesce(r.amount_cents, 0) as ordered
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.module_key = 'purchases'
      and r.archived_at is null
      and coalesce(r.amount_cents, 0) > 0
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as amt
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      and e.direction = 'out'
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),
  got as (
    select m.against_id as record_id, count(*) as moves
    from public.stock_moves m
    where m.project_id = in_project_id and m.against_id is not null
    group by m.against_id
  )
  select po.id, coalesce(po.doc_no, ''), coalesce(po.party, ''),
         po.ordered::bigint,
         coalesce(p.amt, 0)::bigint,
         coalesce(g.moves, 0) > 0,
         case
           when coalesce(p.amt, 0) > po.ordered then 'overpaid'
           when coalesce(p.amt, 0) > 0 and coalesce(g.moves, 0) = 0 then 'paid_not_arrived'
           else 'arrived_not_paid'
         end
  from po
  left join paid p on p.record_id = po.id
  left join got g on g.record_id = po.id
  where public.sees_money(in_project_id)
    /* 对得上的不列：货到了而且付清了。 */
    and not (coalesce(g.moves, 0) > 0 and coalesce(p.amt, 0) = po.ordered)
  order by
    /* 先列他会赔钱的那两种。 */
    case
      when coalesce(p.amt, 0) > po.ordered then 0
      when coalesce(p.amt, 0) > 0 and coalesce(g.moves, 0) = 0 then 1
      else 2
    end,
    po.ordered desc;
$$;

revoke execute on function public.purchase_mismatches(uuid) from public, anon;
grant execute on function public.purchase_mismatches(uuid) to authenticated;

comment on function public.purchase_mismatches(uuid) is
  'Purchase orders that do not tie out, worst first: overpaid, paid but nothing arrived, arrived but unpaid. Only the ones with a problem -- a list that prints everything every time is a list nobody reads. See 20260905190000.';

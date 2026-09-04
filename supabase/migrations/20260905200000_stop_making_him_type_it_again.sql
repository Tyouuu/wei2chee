-- 别再让他把同一行字打第二次。
--
-- ── 判准（[重点 29]，他 2026-09-05 定的）────────────────────────────────
--
--   `就是要尽量优化能 客户老板的打戏时间 改去拖动的也行`
--
-- 四种「不打」，由好到差：**算出来 → 从他自己以前的挑 → 从别处搬过来 →
-- 才轮到他打字**。而这一支做的是第二种，因为第二种今天几乎完全没有：
--
-- 一间五金店的老板，每一张单都要重打一次
-- **「水泥 50kg · 包 · 18.50」** —— 而那三个字**全部就在他自己的货架上**。
-- 那不是一个输入，那是一次抄写。
--
-- ── 三支，全部是「读」 ────────────────────────────────────────────────────
--
--   last_lines_for_party  这个客人**上次买的那几行** —— 一按整张单就有了
--   suggest_items         他自己的货架（名字 · 单位 · 卖价 · 架上几件）
--   usual_units           他自己打过的单位，用得最多的排前面
--
-- 三支都不写任何东西，也都不新增一个要他填的栏位。
--
-- ── 🔴 而有一条线不可以越过 ──────────────────────────────────────────────
--
-- [任务 89] 量过：靠名字自动认人会**把钱记到另一个人头上**。
-- **省他的字，不可以拿「猜」来省。**
--
-- 所以这三支一律**只回候选**，一个都不自动填进去。挑哪一个是他的动作 ——
-- 分不清楚的时候给他挑，不要替他决定。

-- ── 这个客人上次买了什么 ──────────────────────────────────────────────────
--
-- 一间五金店的月结客，每个月买的是同样那五样。今天他一行一行重打；
-- 这一支让那五行变成一次点击。
create or replace function public.last_lines_for_party(
  p_project_id uuid,
  p_party_id uuid,
  p_module_key text
)
returns table (
  description text,
  qty numeric,
  unit text,
  unit_price_cents bigint,
  amount_cents bigint,
  item_id uuid,
  from_doc_no text,
  from_date date
)
language sql
stable
security definer
set search_path = public
as $$
  with last_doc as (
    select r.id, r.doc_no, coalesce(r.due_on, r.issued_on) as on_date
    from public.pipeline_records r
    where r.project_id = p_project_id
      and r.party_id = p_party_id
      and r.module_key = p_module_key
      and r.archived_at is null
      /* 空的那几张不算 —— 「上次买的」是一张**有东西**的单。 */
      and exists (select 1 from public.record_lines l where l.record_id = r.id)
    order by coalesce(r.due_on, r.issued_on) desc, r.created_at desc
    limit 1
  )
  select l.description, l.qty, l.unit, l.unit_price_cents, l.amount_cents, l.item_id,
         d.doc_no, d.on_date
  from last_doc d
  join public.record_lines l on l.record_id = d.id
  where public.works_here(p_project_id)
  order by l.sort_order;
$$;

revoke execute on function public.last_lines_for_party(uuid, uuid, text) from public, anon;
grant execute on function public.last_lines_for_party(uuid, uuid, text) to authenticated;

comment on function public.last_lines_for_party(uuid, uuid, text) is
  'The lines of this party''s most recent document of this kind, shaped to drop straight into set_record_lines. A read -- it fills nothing in by itself. See 20260905200000.';

-- ── 他自己的货架 ──────────────────────────────────────────────────────────
--
-- ⚠️ **不问他库存在哪一页**。他不该为了挑一件货先回答一个我们自己查得到的
-- 问题 —— 那正是[重点 29] 讲的那种多余输入。
create or replace function public.suggest_items(
  p_project_id uuid,
  p_q text default ''
)
returns table (
  item_id uuid,
  name text,
  unit text,
  price_cents bigint,
  on_hand numeric,
  location text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.name, i.unit, i.price_cents,
         coalesce((
           select sum(case when m.direction = 'in' then m.qty else -m.qty end)
           from public.stock_moves m where m.item_id = i.id
         ), 0) as on_hand,
         i.location
  from public.catalog_items i
  where i.project_id = p_project_id
    and i.archived_at is null
    and public.works_here(p_project_id)
    and (
      coalesce(btrim(p_q), '') = ''
      or i.name ilike '%' || btrim(p_q) || '%'
      or i.sku ilike btrim(p_q) || '%'
    )
  /* 常用的排前面：架上有货的先，然后按名字 —— 一个卖完的货品
     排在第一位，是让他每一次都要滑过去。 */
  order by
    (coalesce((
      select sum(case when m.direction = 'in' then m.qty else -m.qty end)
      from public.stock_moves m where m.item_id = i.id
    ), 0) > 0) desc,
    i.name
  limit 20;
$$;

revoke execute on function public.suggest_items(uuid, text) from public, anon;
grant execute on function public.suggest_items(uuid, text) to authenticated;

comment on function public.suggest_items(uuid, text) is
  'His own shelf, for naming a line. Naming a real item is what makes the price fill itself and the stock come off on delivery (20260905050000). Capped at 20 -- a picker is for picking, not for reading. See 20260905200000.';

-- ── 他自己打过的单位 ──────────────────────────────────────────────────────
--
-- 包 · 箱 · 尺 · 平方尺 · 趟 —— **永远不是一张写死的清单**
-- （20260831150000 的原话：一个批发商用箱买、用罐卖，那是任何固定清单
--  表达不了的）。所以这一支回的是**他自己打过的**，用得最多的排前面。
create or replace function public.usual_units(p_project_id uuid)
returns table (unit text, times integer)
language sql
stable
security definer
set search_path = public
as $$
  select u.unit, count(*)::integer as times
  from (
    select btrim(l.unit) as unit
    from public.record_lines l
    where l.project_id = p_project_id and btrim(coalesce(l.unit, '')) <> ''
    union all
    select btrim(i.unit)
    from public.catalog_items i
    where i.project_id = p_project_id and btrim(coalesce(i.unit, '')) <> ''
      and i.archived_at is null
  ) u
  where public.works_here(p_project_id)
  group by u.unit
  order by count(*) desc, u.unit
  limit 12;
$$;

revoke execute on function public.usual_units(uuid) from public, anon;
grant execute on function public.usual_units(uuid) to authenticated;

comment on function public.usual_units(uuid) is
  'The units this business has actually typed, most used first. Never a fixed list -- see 20260831150000. Empty on the first document, which is honest. See 20260905200000.';

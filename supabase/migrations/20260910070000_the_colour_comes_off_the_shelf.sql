-- 沙龙用掉一支染膏，架上要真的少一支 —— **而挑批号那一段只有一份**。
--
-- ── 为什么（2026-09-10 深度研究，[任务 341](../docs/founder-tasks.md#341)）────
--
-- Zenoti 讲得最直白：「**Retail stock and backbar stock are tracked separately,
-- even for the same product.** A shampoo sold from the retail shelf and a
-- shampoo used behind the chair deduct from different buckets」，而且
-- 「Shrinkage becomes visible when retail sales and backbar usage don't
-- reconcile」。
--
-- 🔴 **而我们的洞比那个更基本**：库存 · 批号 · 效期 · 补货线全部有了，
-- 而**没有任何东西会消耗它** —— 只有他自己记得的时候才会少。
-- 所以那几个讯号（快过期 · 低过补货线）是在一组**上线三个月就跟现实脱节**
-- 的数字上叫，而那比没有讯号更糟。
--
-- ⚠️ **医美那一边我们已经做到了**（`add_treatment_product`，20260909040000）：
-- 记一笔疗程用料，架上自己少一支，而且少的是效期最早那一支。
-- **沙龙这一边没有** —— 因为沙龙的活挂在「一次来访的那一行」上，
-- 不挂在一张疗程记录上。
--
-- ── 🔴 一张表，两个挂法 —— 不开第二张 ────────────────────────────────────
--
-- 最省事的做法是抄一张 `line_products` 出来。**不做**：那会连挑批号那一段
-- 一起抄成两份，而两份的那一天，「哪一批快过期」会因为她走了哪一条路而不同
-- （这个仓库栽在「第二份手写清单」上至少八次）。
--
-- 所以 `treatment_products` 多一栏 `line_id`，`note_id` 放宽成可空，
-- 而**两者恰有一个**要有值。表是同一张，出货是同一支，批号是同一个挑法。
--
-- ⚠️ 那张表 2026-09-09 才建，**今天还没有任何一家店在用**，
-- 所以放宽那一个 not null 的爆炸半径是零（[重点 31]：放宽 🟡，而且要讲清楚）。
--
-- ── ⚠️ 而「零售 vs 后场」那一刀我们不切 ───────────────────────────────────
--
-- Zenoti 把同一瓶洗发水分成两个桶。**这一版不做** ——
-- 手写簿上没有两个桶（[重点 34](../docs/founder-points.md)），
-- 而一间店真正要先答的是「用掉了没有」，不是「从哪个桶用掉」。
-- 等有一家店真的问「我卖掉的跟用掉的对不上」再切（[任务 41](../docs/founder-tasks.md#41)：
-- 一次＝个案，两次＝形状）。

alter table public.treatment_products
  add column if not exists line_id uuid references public.appointment_lines(id) on delete cascade;

alter table public.treatment_products
  alter column note_id drop not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'treatment_products_one_anchor'
  ) then
    alter table public.treatment_products
      add constraint treatment_products_one_anchor
      check ((note_id is not null) <> (line_id is not null));
  end if;
end
$do$;

create index if not exists treatment_products_by_line
  on public.treatment_products (line_id);

comment on column public.treatment_products.line_id is
  'The salon side: stuff used on one line of one visit. Exactly one of note_id / line_id is set -- same table, same stock-out call, same batch pick, because two copies of the batch pick would eventually disagree about which lot expires first. See 20260910070000.';

-- ── 🔴 挑批号，一份 ───────────────────────────────────────────────────────
--
-- 原本长在 `add_treatment_product` 里面。抽出来，因为沙龙那一边要用同一个 ——
-- **两个地方挑出来的批号不一样**，就是「哪一批快过期」有两个答案。

create or replace function public.pick_batch(
  in_item_id uuid,
  in_qty numeric
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  /* 效期最早、而且**还够**的那一支。排法逐字来自 20260906120000 的出货那一段 ——
     两个地方给的答案要一样。找不到就回 null：那一笔照样记，
     而不假装它属於某一批。 */
  select b.id
    from public.stock_batches b
   where b.item_id = in_item_id
     and b.archived_at is null
     and coalesce((
           select sum(case when m.direction = 'in' then m.qty else -m.qty end)
             from public.stock_moves m where m.batch_id = b.id
         ), 0) >= in_qty
   order by b.expiry_on nulls last, b.received_on, b.code
   limit 1;
$$;

revoke execute on function public.pick_batch(uuid, numeric) from public, anon;
grant execute on function public.pick_batch(uuid, numeric) to authenticated;

-- ── 疗程那一支改成呼叫它（其余一个字都没动，原样切下来的）────────────────

create or replace function public.add_treatment_product(
  in_note_id uuid,
  in_item_id uuid,
  in_qty numeric,
  in_batch_id uuid default null,
  in_branch_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.treatment_products
language plpgsql
security definer
set search_path = public
as $fn$
declare
  note public.treatment_notes;
  item public.catalog_items;
  mv public.stock_moves;
  row public.treatment_products;
  lot uuid;
begin
  select * into note from public.treatment_notes
   where id = in_note_id and public.works_here(project_id);
  if note.id is null then
    raise exception 'no such treatment note in your business';
  end if;

  select * into item from public.catalog_items
   where id = in_item_id and project_id = note.project_id;
  if item.id is null then
    raise exception 'that item is not on your shelf';
  end if;

  if coalesce(in_qty, 0) <= 0 then
    raise exception 'say how much was used';
  end if;

  lot := in_batch_id;

  /* 🔴 她不讲用哪一支，就拿**效期最早、而且还够**的那一支。
     排法逐字抄 20260906120000 的出货那一段 —— 两个地方给的答案要一样，
     不然「哪一批快过期」会因为她走了哪一条路而不同。 */
  /* 🔴 20260910070000：这一段抽成 `pick_batch` 了 —— 沙龙那一边
     用掉染膏走的是同一支，两个地方挑出来的批号必须一样。 */
  if lot is null then
    lot := public.pick_batch(item.id, in_qty);
  end if;

  /* 🔴 走人按那颗按钮同一支（[重点 23]）—— 批号 · 分店 · 防重复 ·
     序号要讲哪一台，一样都不重写。 */
  mv := public.move_stock(
    in_item_id := in_item_id,
    in_direction := 'out',
    in_qty := in_qty,
    in_reason := left(note.what, 60),
    in_against_id := null,
    in_moved_on := note.done_on,
    in_note := '',
    in_idempotency_key := in_idempotency_key,
    in_branch_id := in_branch_id,
    in_batch_id := lot
  );

  insert into public.treatment_products
    (note_id, project_id, item_id, batch_id, qty, unit, move_id, created_by)
  values (
    in_note_id, note.project_id, in_item_id, lot,
    in_qty, coalesce(item.unit, ''), mv.id, auth.uid()
  )
  returning * into row;

  return row;
end;
$fn$;

-- ── 🔴 一次来访的那一行用掉了什么 ─────────────────────────────────────────

create or replace function public.add_visit_product(
  in_line_id uuid,
  in_item_id uuid,
  in_qty numeric,
  in_batch_id uuid default null,
  in_branch_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.treatment_products
language plpgsql
security definer
set search_path = public
as $fn$
declare
  line public.appointment_lines;
  item public.catalog_items;
  lot uuid;
  mv public.stock_moves;
  row public.treatment_products;
begin
  select * into line from public.appointment_lines
   where id = in_line_id and public.works_here(project_id);
  if line.id is null then
    raise exception 'no such line on a visit in your business';
  end if;

  select * into item from public.catalog_items
   where id = in_item_id and project_id = line.project_id;
  if item.id is null then
    raise exception 'that item is not on your shelf';
  end if;
  if coalesce(in_qty, 0) <= 0 then
    raise exception 'say how much was used';
  end if;

  lot := in_batch_id;
  /* 🔴 她不讲用哪一支，就拿效期最早、而且还够的那一支 —— 同一支 `pick_batch`。 */
  if lot is null then
    lot := public.pick_batch(item.id, in_qty);
  end if;

  /* 🔴 走人按那颗按钮同一支（[重点 23]）—— 批号 · 分店 · 防重复，一样都不重写。 */
  mv := public.move_stock(
    in_item_id := in_item_id,
    in_direction := 'out',
    in_qty := in_qty,
    in_reason := left(line.service, 60),
    in_moved_on := null,
    in_idempotency_key := in_idempotency_key,
    in_branch_id := in_branch_id,
    in_batch_id := lot
  );

  insert into public.treatment_products
    (line_id, project_id, item_id, batch_id, qty, unit, move_id, created_by)
  values (in_line_id, line.project_id, in_item_id, lot,
          in_qty, coalesce(item.unit, ''), mv.id, auth.uid())
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.add_visit_product(uuid, uuid, numeric, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.add_visit_product(uuid, uuid, numeric, uuid, uuid, uuid)
  to authenticated;

-- ── 这一次来访用掉了什么 ──────────────────────────────────────────────────

create or replace function public.visit_products_of(in_appointment_id uuid)
returns table (
  id uuid,
  line_id uuid,
  service text,
  item text,
  qty numeric,
  unit text,
  batch_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, l.id, l.service, c.name, p.qty, p.unit, coalesce(b.code, '')
    from public.treatment_products p
    join public.appointment_lines l on l.id = p.line_id
    join public.catalog_items c on c.id = p.item_id
    left join public.stock_batches b on b.id = p.batch_id
   where l.appointment_id = in_appointment_id
     and public.works_here(p.project_id)
   order by l.sort_order, p.created_at;
$$;

revoke execute on function public.visit_products_of(uuid) from public, anon;
grant execute on function public.visit_products_of(uuid) to authenticated;

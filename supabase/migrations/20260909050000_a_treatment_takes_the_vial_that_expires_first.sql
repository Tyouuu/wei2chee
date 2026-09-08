-- 她不讲用哪一支，就拿快过期的那一支。
--
-- ── 那把尺第一次跑就抓到的 ──────────────────────────────────────────────
--
-- `check:treatments` ②：架上从 300 变 280（对），而两批**一个字都没动**
-- （LOT-A 100 · LOT-B 200）。也就是那 20 个单位**完全不挂批号**。
--
-- 后果不是少一栏，是两句话从此答不出来：
--   「哪一批快过期」—— 那一整格（20260905320000）问的就是这一句
--   「你用在她身上的是哪一批」—— 而那是她真的会被问到的那一句
-- 而且每一批加起来跟那件货的总数会**慢慢分家**，画面上完全正常。
--
-- 🔴 我先把它写成「红的是我的期望」—— 因为 FEFO 住在出货那一支，
-- 不在 `move_stock` 上。**那句话只对一半**：`move_stock` 确实不做 FEFO，
-- 而一次疗程**就是一次出货**，所以那条规则本来就该套上来。
--
-- ── 抄的是 20260906120000 那一段，不是重新想一个 ────────────────────────
--
-- 出货那一支的原话（`deliver_record`）：
--   `order by b.expiry_on nulls last, b.received_on, b.code`
-- 而 Aoikumo 自己的功能页也是同一句：
--   `Track expiry of drugs and ensure the earliest drugs are prescribed first`
--
-- ── 🔴 一笔一支，不拆 ───────────────────────────────────────────────────
--
-- 出货那一支会**把一行拆成两笔**（一批不够就往下一批拿），理由写着
-- 「那正是仓库里真的发生的事」。**在这里不成立**：
-- 她从冰箱拿的是**一支**，不是从两支各抽一半。
-- 而拆下去，`treatment_products.move_id` 那一栏就装不下两笔 ——
-- 一个装得下的做法要多一张表，而那是替一件不会发生的事付的钱（[重点 7d-2]）。
--
-- 所以：**挑效期最早、而且还够的那一批**。真的要用两支，她记两笔 ——
-- 那本来就是她那天做的两个动作。
--
-- ── 🔴 一批都不够的时候：照样记，然后那一笔不挂批号 ────────────────────
--
-- 抄 20260906120000 的收尾，一字不改的判断：
--   `每一批都空了还差一些 —— 照样出，然后讲出来。挡下去他就绕过系统卖…
--    那一笔不挂批号，因为它不属於任何一批，而假装它属於某一批才是说谎。`
-- 她手上那一支已经打进去了，挡下来只会让她不记这一笔。

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
  if lot is null then
    select b.id into lot
      from public.stock_batches b
     where b.item_id = item.id
       and b.archived_at is null
       and coalesce((
             select sum(case when m.direction = 'in' then m.qty else -m.qty end)
               from public.stock_moves m where m.batch_id = b.id
           ), 0) >= in_qty
     order by b.expiry_on nulls last, b.received_on, b.code
     limit 1;
    /* 找不到 → `lot` 留 null → 那一笔不挂批号。见档头最后一段：
       照样记，而不假装它属於某一批。 */
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

-- 搬回去。20260909080000 是故意弄坏的那一版，红出来六条，
-- 而第一条就是它坏掉时的样子：**架上还是 300**，
-- 而她那本病历上写着她用掉了 20 个单位。
-- 🔴 原样搬回来，不是照记忆重打（[重点 31] 第一条）。
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

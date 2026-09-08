-- 故意弄坏：她不讲用哪一支的时候，那一笔不挂批号。
-- 也就是把 20260909050000 修掉的那个洞原样装回去，单独推一次看它红。
-- 20260909070000 把它搬回去。
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

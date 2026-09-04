-- 🔴 故意让「借出去」不动库存，**看它红**。[重点 24]
--
-- 坏掉的样子是画面上看不出来的：架上照样写着「婚纱 1 件」，
-- 而那一件正挂在别人的婚礼上 —— 下一个客人订得下去。
--
-- 下一支 20260905560000 换回来。两份都留在历史里。

create or replace function public.lend_item(
  in_record_id uuid,
  in_descr text,
  in_qty numeric default 1,
  in_item_id uuid default null,
  in_out_on date default null,
  in_due_back_on date default null,
  in_deposit_entry_id uuid default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns public.rentals
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  item public.catalog_items;
  dep public.ledger_entries;
  shelf text;
  row public.rentals;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  /* 借得出去的只有这两种：一张订单 · 一件工程（工地上的鹰架挂在那一件工程上）。 */
  if rec.module_key not in ('orders', 'projects') then
    raise exception 'only an order or a job lends things out';
  end if;

  if coalesce(btrim(in_descr), '') = '' then
    raise exception 'say what went out';
  end if;
  if coalesce(in_qty, 0) <= 0 then
    raise exception 'a lend of nothing is not a lend';
  end if;
  if in_out_on is not null and in_out_on > public.today_myt() then
    raise exception 'it cannot have gone out in the future';
  end if;
  if in_due_back_on is not null and in_due_back_on < coalesce(in_out_on, public.today_myt()) then
    raise exception 'it cannot be due back before it went out';
  end if;

  if in_item_id is not null then
    select * into item from public.catalog_items
     where id = in_item_id and project_id = rec.project_id and archived_at is null;
    if item.id is null then
      raise exception 'no such item on your shelf';
    end if;
  end if;

  /* 🔴 押金那一笔一定要是**这一家**的，而且是**收进来**的。
     指着一笔付出去的钱，会让他的画面写着「押金 RM 500」而那五百是他付的。 */
  if in_deposit_entry_id is not null then
    select * into dep from public.ledger_entries
     where id = in_deposit_entry_id and project_id = rec.project_id;
    if dep.id is null then
      raise exception 'no such payment in your project';
    end if;
    if dep.direction <> 'in' then
      raise exception 'a deposit is money that came in';
    end if;
  end if;

  insert into public.rentals (
    record_id, project_id, item_id, descr, qty, out_on, due_back_on,
    deposit_entry_id, note, created_by, idempotency_key
  ) values (
    in_record_id, rec.project_id, in_item_id,
    left(btrim(in_descr), 200), in_qty,
    coalesce(in_out_on, public.today_myt()), in_due_back_on,
    in_deposit_entry_id, left(coalesce(in_note, ''), 2000),
    auth.uid(), in_idempotency_key
  )
  returning * into row;

  /* 架上那一件当场少一件 —— 走人按的那一支（[重点 23]）。 */
  if false and item.id is not null then
    select pp.page_key into shelf
    from public.project_pages pp
    where pp.project_id = rec.project_id and public.is_catalog_module(pp.page_key)
    order by pp.sort_order nulls last limit 1;

    if shelf is not null then
      perform public.move_stock(
        in_item_id := item.id,
        in_direction := 'out',
        in_qty := in_qty,
        in_branch_id := rec.branch_id,
        in_reason := left(btrim(in_descr), 60),
        in_note := coalesce(rec.doc_no, ''),
        in_idempotency_key := null
      );
    end if;
  end if;

  return row;
exception
  when unique_violation then
    select * into row from public.rentals
     where record_id = in_record_id and idempotency_key = in_idempotency_key;
    return row;
end;
$fn$;

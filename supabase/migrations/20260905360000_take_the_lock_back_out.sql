-- 拿掉那三行 `for update`。20260905340000 试过一次没改到。
--
-- 🔴 而我加它的时候写的注解本身也是错的：**盘点的安全不是靠锁**，
-- 是靠「现在有几件」**在资料库里算** —— 两个人同时送「数出来 84」，
-- 两句话在同一个资料库里排队，第二句读到的是第一句写完之后的数。
-- 20260905170000 本来就没有那一行，是我抄的时候自己加上去的。
--
-- ⚠️ 而拿掉它的时候还踩了第二个：**那个分号就长在 `for update;` 那一行上**，
-- 整行删掉等於把两句 SQL 黏成一句（`INTO specified more than once`）。
-- 两次都是 `db push` 才讲话，而不是我读出来的。
create or replace function public.count_stock(
  in_item_id uuid,
  in_counted numeric,
  in_reason text default '',
  in_note text default '',
  in_idempotency_key uuid default null,
  in_branch_id uuid default null,
  in_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  lot public.stock_batches;
  have numeric;
  gap numeric;
  which text;
  lots integer;
  made public.stock_moves;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your project';
  end if;
  if in_counted is null or in_counted < 0 then
    raise exception 'how many are on the shelf?';
  end if;
  if not public.branch_is_ours(item.project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_batch_id is not null then
    select * into lot from public.stock_batches where id = in_batch_id;
    if lot.id is null or lot.item_id <> in_item_id then
      raise exception 'that batch is not a batch of this item';
    end if;
  else
    /* 🔴 有批号的货，数出来的 84 是哪一批的？答不出来就不准记。
       讲得出该怎么做 —— 一句「违反约束」会让他去关掉这个功能。 */
    select count(*) into lots
    from public.stock_batches b
    where b.item_id = in_item_id and b.archived_at is null;
    if lots > 0 then
      raise exception
        'this item is kept in % batches -- count the batch, not the item', lots;
    end if;
  end if;

  /* 🔴 现在有几件**在资料库里算**，不是浏览器算的 ——
     两个人同时送，两句话在同一个资料库里排队。 */
  if in_batch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m
    where m.batch_id = in_batch_id;
  elsif in_branch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m
    where m.item_id = in_item_id and m.branch_id = in_branch_id;
  else
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m where m.item_id = in_item_id;
  end if;

  gap := in_counted - have;

  /* 数出来跟系统一样，什么都不写，而且讲出来 ——
     一笔 0 的流水是他帐上一行没有发生过的事。 */
  if gap = 0 then
    return jsonb_build_object(
      'counted', in_counted, 'was', have, 'diff', 0, 'wrote', false
    );
  end if;

  select case when p.system_language = 'en' then 'Stocktake' else '盘点' end
    into which
  from public.projects p where p.id = item.project_id;

  made := public.move_stock(
    in_item_id,
    case when gap > 0 then 'in' else 'out' end,
    abs(gap),
    coalesce(nullif(btrim(in_reason), ''), which),
    null, null, null,
    coalesce(in_note, ''), '{}'::jsonb,
    in_idempotency_key, in_branch_id, in_batch_id
  );

  return jsonb_build_object(
    'counted', in_counted, 'was', have, 'diff', gap,
    'wrote', true, 'move_id', made.id
  );
end;
$$;

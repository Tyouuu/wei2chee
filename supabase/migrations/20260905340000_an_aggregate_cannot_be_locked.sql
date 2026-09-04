-- ⚠️ **这一支没有修好它。** 我要拿掉的是 `for update` 那三行，
-- 而我写的那句 sed 对不上缩排 —— 推上去的还是同一份坏的。
--
-- 留着不删，因为它就是「我以为修好了」跟「真的修好了」之间那一步：
-- **推上去不代表改到了**，而抓到它的是再跑一次 check:branch-stock。
-- 真正修好它的是 20260905360000。
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
     两个人同时盘点，两边都读到 91 再各自送「出 7」，架上会变成 77。 */
  if in_batch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m
    where m.batch_id = in_batch_id
    for update;
  elsif in_branch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m
    where m.item_id = in_item_id and m.branch_id = in_branch_id
    for update;
  else
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m where m.item_id = in_item_id
    for update;
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

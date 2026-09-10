-- 🔴 故意弄坏 20260911540000：拿掉那一行 `perform ... for update`，
-- 看 `check:records` 第 ⑱ 段（两个人同时数同一个数）真的红回去。
-- 单独推、单独跑，看过它红，才算数——不是看代码顺眼就相信锁生效了。
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
  the_project uuid;
  before_qty numeric;
  diff numeric;
  open_branches integer;
  lots integer;
  lot public.stock_batches;
  moved public.stock_moves;
  is_en boolean;
  the_reason text;
begin
  select i.project_id into the_project
  from public.catalog_items i
  where i.id = in_item_id and public.works_here(i.project_id);
  if the_project is null then
    raise exception 'no such item in your project';
  end if;

  if in_counted is null or in_counted < 0 then
    raise exception 'a count cannot be negative';
  end if;

  if not public.branch_is_ours(the_project, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_batch_id is not null then
    select * into lot from public.stock_batches where id = in_batch_id;
    if lot.id is null or lot.item_id <> in_item_id then
      raise exception 'that batch is not a batch of this item';
    end if;
  else
    select count(*) into lots
    from public.stock_batches b
    where b.item_id = in_item_id and b.archived_at is null;
    if lots > 0 then
      select p.system_language = 'en' into is_en
        from public.projects p where p.id = the_project;
      if is_en then
        raise exception
          'This item is kept in % batches, so count the batch, not the item -- otherwise nothing can say which lot the difference belongs to.', lots;
      else
        raise exception
          '这一件货分成 % 批放，所以要数哪一批，不是数这一件货 —— 不然没有东西讲得出那个差是哪一批的。', lots;
      end if;
    end if;
  end if;

  if in_batch_id is null then
    select count(*) into open_branches
    from public.branches b where b.project_id = the_project and b.active;

    if open_branches > 1 and in_branch_id is null then
      select p.system_language = 'en' into is_en
        from public.projects p where p.id = the_project;
      if is_en then
        raise exception
          'You have more than one branch, so say which shelf you counted -- counting without one would wipe the stock at the others.';
      else
        raise exception
          '你有不止一间店，所以要讲清楚数的是哪一间的架子 —— 不讲会把其他店的库存抹掉。';
      end if;
    end if;
  end if;

  /* 🔴 那一行锁拿掉了。 */

  if in_batch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into before_qty
    from public.stock_moves m
    where m.batch_id = in_batch_id;
  else
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into before_qty
    from public.stock_moves m
    where m.item_id = in_item_id
      and (in_branch_id is null or m.branch_id = in_branch_id);
  end if;
  before_qty := coalesce(before_qty, 0);

  diff := in_counted - before_qty;

  if diff = 0 then
    return jsonb_build_object('before', before_qty, 'counted', in_counted, 'moved', 0);
  end if;

  the_reason := nullif(btrim(coalesce(in_reason, '')), '');
  if the_reason is null then
    select p.system_language = 'en' into is_en
      from public.projects p where p.id = the_project;
    the_reason := case when is_en then 'Stocktake' else '盘点' end;
  end if;

  moved := public.move_stock(
    in_item_id := in_item_id,
    in_direction := case when diff > 0 then 'in' else 'out' end,
    in_qty := abs(diff),
    in_branch_id := in_branch_id,
    in_batch_id := in_batch_id,
    in_reason := the_reason,
    in_note := left(coalesce(in_note, ''), 2000),
    in_idempotency_key := in_idempotency_key
  );

  return jsonb_build_object(
    'before', before_qty,
    'counted', in_counted,
    'moved', diff,
    'move_id', moved.id,
    'doc_no', moved.doc_no
  );
end;
$$;

-- 🔴 故意弄坏：把「两头都要一间店」装回去 ——
-- 也就是 20260906710000 之前它真实的样子。
-- **单独推一次**（重点 31 第三条）。下一支 20260906730000 原样搬回去。

create or replace function public.transfer_stock(
  in_item_id uuid,
  in_from_branch uuid,
  in_to_branch uuid,
  in_qty numeric,
  in_moved_on date default null,
  in_note text default '',
  in_batch_id uuid default null,
  in_idempotency_key uuid default null
)
returns table (
  transfer_id uuid,
  moved numeric,
  /* 那一间店本来有几件 —— 搬之前。 */
  had numeric,
  /* 🔴 不够的那几件。**0 是「够」**，而不是「没问题」的同义词:
     画面上要看得到差多少。 */
  short numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  tid uuid;
  on_hand numeric;
  existing record;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if not found then
    raise exception 'no such item';
  end if;
  if not public.works_here(item.project_id) then
    raise exception 'that project is not yours';
  end if;

  if coalesce(in_qty, 0) <= 0 then
    raise exception 'say how many are going across';
  end if;
  if in_from_branch is null or in_to_branch is null then
    raise exception 'say which shop it comes from and goes to';
  end if;
  /* 🔴 而**从哪里来可以是空的** —— 那是「还没有分到任何一间店的那些货」。
     一间本来只有一间店的生意，它所有的货都挂在那里（20260905170000
     特地留着那个 null），而开第二间店那一天他要做的第一件事，
     就是把已经有的货分到第一间店去。
     少了这一条，那件事**根本做不到** —— `walk:hardware` 走出来的。 */
  if in_from_branch is not distinct from in_to_branch then
    raise exception 'that is the same shop on both ends';
  end if;
  if in_from_branch is not null
     and not public.branch_is_ours(item.project_id, in_from_branch) then
    raise exception 'that shop is not in this project';
  end if;
  if not public.branch_is_ours(item.project_id, in_to_branch) then
    raise exception 'that shop is not in this project';
  end if;

  /* 按两下是一次搬运。**那两笔要嘛都在，要嘛都不在** ——
     半次调拨正是这一支存在的理由。 */
  if in_idempotency_key is not null then
    select m.transfer_id into tid
    from public.stock_moves m
    where m.item_id = in_item_id
      and m.idempotency_key = in_idempotency_key
    limit 1;
    if tid is not null then
      select coalesce(sum(abs(m.qty)), 0) / 2 into on_hand
      from public.stock_moves m where m.transfer_id = tid;
      return query select tid, on_hand, null::numeric, 0::numeric;
      return;
    end if;
  end if;

  /* 搬之前那一间店有几件 —— 讲得出差多少，才不用他自己去数。 */
  /* ⚠️ **直接从流水上数**，不去问 `stock_by_branch` ——
     那是一张 `security_invoker` 的 view，而这一支是 security definer：
     从这里问它，它会用**拥有者**的身分读（穿过权限）。
     这一支上面已经问过 `works_here`，所以不会漏；
     但一支依赖「那张 view 是哪一种安全模式」的函式，
     哪天那张 view 改了就会静静地变成另一件事。 */
  select coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
       - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0)
    into on_hand
  from public.stock_moves m
  where m.item_id = in_item_id
    and m.branch_id is not distinct from in_from_branch;
  on_hand := coalesce(on_hand, 0);

  tid := gen_random_uuid();

  perform public.move_stock(
    in_item_id := in_item_id,
    in_direction := 'out',
    in_qty := in_qty,
    in_reason := coalesce(nullif(btrim(in_note), ''), '调拨'),
    in_moved_on := in_moved_on,
    in_branch_id := in_from_branch,
    in_batch_id := in_batch_id,
    in_idempotency_key := in_idempotency_key
  );
  perform public.move_stock(
    in_item_id := in_item_id,
    in_direction := 'in',
    in_qty := in_qty,
    in_reason := coalesce(nullif(btrim(in_note), ''), '调拨'),
    in_moved_on := in_moved_on,
    in_branch_id := in_to_branch,
    in_batch_id := in_batch_id
  );

  /* 两笔都写完了才串起来 —— 中间断掉的话，两笔都还在流水上，
     只是没有被认成一次调拨，而那比少一笔好。 */
  update public.stock_moves m
     set transfer_id = tid
   where m.item_id = in_item_id
     and m.transfer_id is null
     and m.branch_id in (in_from_branch, in_to_branch)
     and m.id in (
       select x.id from public.stock_moves x
       where x.item_id = in_item_id and x.transfer_id is null
       order by x.created_at desc
       limit 2
     );

  return query
  select tid, in_qty, on_hand, greatest(in_qty - on_hand, 0);
end;
$$;

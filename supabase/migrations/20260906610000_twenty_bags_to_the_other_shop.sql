-- 从吉隆坡搬二十包去 Puchong —— 一个动作，不是两个。
--
-- [任务 148](#148) 立分店库存的时候自己写下这一条还欠着：
--     「**没有调拨**（从 KL 搬 20 包去 Puchong）—— 今天要记一出一进两笔。」
--
-- 两笔当然记得了，而那不是重点。重点是**那两笔会对不上**:
-- 他打了「出 20」，接电话，回来打「进 2」——
-- 而**架上从此少了十八包，没有任何东西会讲**。
--
-- ── 🔴 所以这一支真正在买的是那一句「一定对得上」──────────────────
-- 一次呼叫，两笔，同样的货、同样的数量、同一个编号串起来。
-- 打错只能整个打错，不会打错一半。
--
-- ── 三个判断 ────────────────────────────────────────────────────────
--
--  1. **架上不够照样搬，然后讲出来。**
--     跟出货那一条同一句（20260905440000）：挡下去他就绕过系统搬，
--     而那一天起两间店的数字都是假的。**他真的把货搬走了，
--     错的是那个数字** —— 所以照记，然后回报差多少。
--
--  2. **同一间店搬到同一间店 → 拒绝。**
--     那不是一次调拨，那是两笔互相抵销的流水，
--     而它会让「这个月调拨过几次」永远算不准。
--
--  3. 🔴 **撤销是写两笔反的，不是把那两笔删掉。**
--     跟退货那一条（20260905870000）一模一样：
--     一次真的发生过的搬运是历史。删掉它，
--     那本流水帐就答不了「为什么上个礼拜三少了二十包」。

alter table public.stock_moves
  add column if not exists transfer_id uuid;

comment on column public.stock_moves.transfer_id is
  'The two halves of one branch transfer carry the same id. Null on every other move -- see 20260906610000.';

create index if not exists stock_moves_transfer_idx
  on public.stock_moves (transfer_id) where transfer_id is not null;


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
    raise exception 'say which shop it leaves and which shop it goes to';
  end if;
  if in_from_branch = in_to_branch then
    raise exception 'that is the same shop on both ends';
  end if;
  if not public.branch_is_ours(item.project_id, in_from_branch)
     or not public.branch_is_ours(item.project_id, in_to_branch) then
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
  select coalesce(s.on_hand, 0) into on_hand
  from public.stock_by_branch(item.project_id) s
  where s.item_id = in_item_id and s.branch_id = in_from_branch;
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

revoke execute on function public.transfer_stock(uuid, uuid, uuid, numeric, date, text, uuid, uuid)
  from public, anon;
grant execute on function public.transfer_stock(uuid, uuid, uuid, numeric, date, text, uuid, uuid)
  to authenticated;


/* 搬错了。**写两笔反的，不是把那两笔删掉** ——
   一次真的发生过的搬运是历史（跟退货那一条一模一样）。 */
create or replace function public.undo_transfer(in_transfer_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n integer := 0;
begin
  for m in
    select * from public.stock_moves where transfer_id = in_transfer_id
  loop
    if not public.works_here(m.project_id) then
      raise exception 'that project is not yours';
    end if;
    perform public.move_stock(
      in_item_id := m.item_id,
      in_direction := case when m.direction = 'out' then 'in' else 'out' end,
      in_qty := abs(m.qty),
      in_reason := '调拨撤销',
      in_branch_id := m.branch_id,
      in_batch_id := m.batch_id
    );
    n := n + 1;
  end loop;

  if n = 0 then
    raise exception 'no such transfer';
  end if;
  return n;
end;
$$;

revoke execute on function public.undo_transfer(uuid) from public, anon;
grant execute on function public.undo_transfer(uuid) to authenticated;


create or replace function public.transfers_of(
  in_project_id uuid,
  in_from date default null,
  in_to date default null
)
returns table (
  transfer_id uuid,
  item_id uuid,
  item_name text,
  qty numeric,
  from_branch uuid,
  from_name text,
  to_branch uuid,
  to_name text,
  moved_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;

  return query
  select
    m.transfer_id,
    max(m.item_id),
    max(c.name),
    max(abs(m.qty)),
    max(m.branch_id) filter (where m.direction = 'out'),
    max(bf.name) filter (where m.direction = 'out'),
    max(m.branch_id) filter (where m.direction = 'in'),
    max(bt.name) filter (where m.direction = 'in'),
    max(m.moved_on)
  from public.stock_moves m
  join public.catalog_items c on c.id = m.item_id
  left join public.branches bf on bf.id = m.branch_id
  left join public.branches bt on bt.id = m.branch_id
  where m.project_id = in_project_id
    and m.transfer_id is not null
    and (in_from is null or m.moved_on >= in_from)
    and (in_to is null or m.moved_on <= in_to)
  group by m.transfer_id
  order by max(m.moved_on) desc, max(m.created_at) desc;
end;
$$;

revoke execute on function public.transfers_of(uuid, date, date) from public, anon;
grant execute on function public.transfers_of(uuid, date, date) to authenticated;

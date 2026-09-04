-- 🔴 我 20260905320000 把 `count_stock` **整支重写**，而不是在原来那一支上
-- 加一个参数 —— 於是它静静掉了两样东西：
--
--   · **两间店以上一定要讲哪一间**那条守卫（20260905170000 立的）
--   · 回传那几个键的名字（`before` / `moved` / `doc_no`）
--
-- `check:branch-stock` 当场红了六条。**而 `db push` 三次一句话都没讲。**
--
-- ⚠️ 教训不是「小心一点」：**要在原来那一支上加，不要照着记忆重打一支。**
-- 20260831080000 已经踩过一模一样的（整支重写，漏掉 `unique_violation`
-- 那一段，於是按两下会开出两张单）。这是第二次。
--
-- 这一支＝ 20260905170000 那一份原文，只加批号那三处。

create or replace function public.count_stock(
  in_item_id uuid,
  in_counted numeric,
  in_reason text default '',
  in_note text default '',
  in_idempotency_key uuid default null,
  in_branch_id uuid default null,
  /* 数的是哪一批。 */
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

  /* ── 批号那一层 ─────────────────────────────────────────────────────
     🔴 有批号的货，数出来的 84 是哪一批的？**没有任何规则答得出来。**
     随便挑一批就是毁掉「什么快过期了」那一句。
     跟下面那条分店的守卫同一个理由：**猜错会毁掉资料的地方就拒绝。** */
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

  /* ── 🔴 两间店以上，一定要讲是哪一间 ───────────────────────────────
     这一条不是龟毛，它挡的是**静静毁掉库存**：
     一间店在 Puchong 数出 84，而全公司有 91（那边 84 ＋ 吉隆坡 7）。
     不问哪一间，这一支会写 −7，把吉隆坡那 7 包抹掉，
     **而画面上没有任何东西会讲**。

     ⚠️ 讲了哪一批就不用讲哪一间 —— 一批货比一间店更准。 */
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

  /* 🔴 自己读，不要相信浏览器送来的那个数字。
     两个人同时盘点的时候，那是唯一挡得住的地方。 */
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

  /* 数出来跟系统一样 —— **什么都不写**，而且要讲出来。 */
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

revoke execute on function public.count_stock(uuid, numeric, text, text, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.count_stock(uuid, numeric, text, text, uuid, uuid, uuid)
  to authenticated;

comment on function public.count_stock(uuid, numeric, text, text, uuid, uuid, uuid) is
  'Refuses to count a batched item at item level, and refuses to count without a branch when there is more than one -- both for the same reason: the difference cannot be attributed and a guess would silently destroy stock. Says what to do instead, in the system''s own language. See 20260905370000.';

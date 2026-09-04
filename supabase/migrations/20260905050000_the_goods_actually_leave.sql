-- 东西卖出去了，架上就该少 —— 而今天不会。
--
-- ── 🔴 这不是一个新功能，这是一个已经上线的东西在说谎 ────────────────────
--
-- 库存 2026-09-01 上线，`stock_on_hand` 是流水加起来的，而我数了全部会动
-- 库存的地方：**开帐 · 收货 · 盘点**。
--
--   **没有一个是「卖掉」。**
--
-- 一间五金店卖掉十包水泥，架上的数字一动都不动。三个月之后那本帐是假的，
-- 而且**没有任何东西会告诉他**（[任务 123] 讲过同一句：一个存起来的数量，
-- 是任何东西都写得进去的数字，而跟钱不一样，没有人用眼睛看得出来）。
--
-- ── 而那条线断在更前面的地方 ──────────────────────────────────────────────
--
-- 追下去才看到它断了三截，而不是一截：
--
--   ① `set_record_lines` **根本不收 `item_id`** —— 所以一行「水泥 50kg」
--      永远只是一串字，没有办法指向架上那一件
--   ② 没有任何东西把货送出去
--   ③ `catalog_items.price_cents` 建表那天就在，**全仓库零个地方读它**
--
-- 三截是同一个故事：**卖东西这条线，从「这一行是架上哪一件」就断了。**
-- 只修 ② 会变成一支永远找不到货品的函式。
--
-- ── ⚠️ 那句「不要 item_code」的注解没有被推翻 ────────────────────────────
--
-- `20260831150000` 白纸黑字写着不给行加 `item_code`，理由是
-- 「一个承包商写『拆除旧厨房』是在描述一件工作，不是在卖目录上的一条」。
--
-- **那句话今天还是对的，所以这里加的是可选的。**
-- 一行可以是**一件工作**（没有货品），也可以是**架上的一件货**（有货品）。
-- 装修那一行一个字都不用改。

-- ── ① 一行可以说出它是架上的哪一件 ────────────────────────────────────────
create or replace function public.set_record_lines(
  in_record_id uuid,
  in_lines jsonb
)
returns setof public.record_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  i integer := 0;
  received integer;
  is_en boolean;
  proj uuid;
  the_item uuid;
  the_price bigint;
  the_qty numeric;
  the_amount bigint;
begin
  /* works_here, not account_id: a site supervisor writes the lines of a job
     too. The money functions are the ones that still ask sees_money. */
  select exists (
    select 1 from public.pipeline_records r
    join public.projects p on p.id = r.project_id
    where r.id = in_record_id and public.works_here(p.id)
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
  end if;

  select r.project_id into proj
    from public.pipeline_records r where r.id = in_record_id;

  /* 🔴 20260901110000 加的那一条，一个字都没改：货已经动过的单，行就锁了。
     ⚠️ 而它问的是 `against_id = 这张单`，**没有问方向** —— 所以它今天
     自动把「已经出货的单」一起锁住了，不用另外写一条。 */
  select count(*) into received
  from public.stock_moves where against_id = in_record_id;

  if received > 0 then
    select p.system_language = 'en' into is_en
      from public.pipeline_records r
      join public.projects p on p.id = r.project_id
     where r.id = in_record_id;
    if is_en then
      raise exception
        'The goods on this order have already moved in your stock, so its lines cannot be changed. Record what actually happened as a stock movement instead.';
    else
      raise exception
        '这张单的货已经在库存里动过了，行就不能再改了。要更正就记一笔进或出。';
    end if;
  end if;

  if jsonb_typeof(coalesce(in_lines, 'null'::jsonb)) <> 'array' then
    raise exception 'lines must be an array';
  end if;

  /* Twenty is a document; two hundred is an import, and an import is a
     different feature with a different set of questions. */
  if jsonb_array_length(in_lines) > 60 then
    raise exception 'too many lines on one document';
  end if;

  delete from public.record_lines where record_id = in_record_id;

  for item in select * from jsonb_array_elements(in_lines)
  loop
    if coalesce(btrim(item->>'description'), '') = '' then
      raise exception 'every line needs a description';
    end if;

    /* ── 这一行指的是架上哪一件 ──────────────────────────────────────
       可选。给了就要是**这一家自己的货品** —— 一行指向别人家货品的单，
       在画面上完全正常，而按下出货那一刻它会去动别人的架子。 */
    the_item := nullif(item->>'item_id', '')::uuid;
    the_price := nullif(item->>'unit_price_cents', '')::bigint;
    the_qty := nullif(item->>'qty', '')::numeric;
    the_amount := nullif(item->>'amount_cents', '')::bigint;

    if the_item is not null then
      perform 1 from public.catalog_items
        where id = the_item and project_id = proj and archived_at is null;
      if not found then
        raise exception 'that item is not on your shelf';
      end if;

      /* 🔴 卖价第一次真的被读到。`price_cents` 从 20260901070000 就在，
         而在今天之前**没有一个地方读过它** —— 第二十次「能力有、线没接」。

         ⚠️ **只在他没有自己写价钱的时候用**。目录上的价是他平常卖的价；
         这一单谈的价是这一单的。谈好的那个永远赢 ——
         一个会把他谈好的价盖掉的目录，他第二天就不敢用了。 */
      if the_price is null then
        select c.price_cents into the_price
          from public.catalog_items c where c.id = the_item;
      end if;
    end if;

    /* 两个都没给、而算得出来的时候才算。
       ⚠️ `amount_cents` 的注解写着「它存的是**谈好**的那个数」——
       所以这里只填空白，不覆盖：一个当天给的折扣不是 qty × price。 */
    if coalesce(the_amount, 0) = 0 and the_qty is not null and the_price is not null then
      the_amount := round(the_qty * the_price)::bigint;
    end if;

    insert into public.record_lines (
      record_id, project_id, description, qty, unit,
      unit_price_cents, amount_cents, sort_order, note, extra, item_id
    ) values (
      in_record_id,
      /* Overwritten by the trigger; a value is needed for the not-null. */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 300),
      the_qty,
      left(coalesce(btrim(item->>'unit'), ''), 30),
      the_price,
      coalesce(the_amount, 0),
      i,
      left(coalesce(item->>'note', ''), 500),
      coalesce(item->'extra', '{}'::jsonb),
      the_item
    );
    i := i + 1;
  end loop;

  /* An emptied list has to put the total back under the owner's control
     rather than leaving the last computed sum standing as if it were typed. */
  if jsonb_array_length(in_lines) = 0 then
    update public.pipeline_records set amount_cents = null, updated_at = now()
     where id = in_record_id;
  end if;

  return query
    select * from public.record_lines
     where record_id = in_record_id
     order by sort_order;
end;
$$;

-- ── ② 货真的出去了 ────────────────────────────────────────────────────────
--
-- `receive_purchase`（20260901100000）的镜像，而**有三处故意不一样**，
-- 每一处都有理由：
--
--   1. 🔴 **找不到那件货就跳过，不建新的。**
--      收货的时候建是对的：你进了一件没进过的货，那就是一件新货。
--      **卖的时候不是** —— 一个打错字的描述会变出一件幽灵货品，
--      然后它的库存是负的
--   2. 🔴 **架上不够也照样出货，然后讲出来。**
--      挡下去他就会绕过系统卖（而那是他停止用它的那一天）；
--      静静地变成 -7 也不行。所以：出，然后回报几件不够
--      —— 跟额度那一条同一句：**我们讲事实，判断留给他**
--   3. **只有订单出得了货。** 报价单不是交货，工程也不是。
create or replace function public.deliver_record(in_record_id uuid)
returns table (moved integer, short integer, unknown integer, skipped integer, stage text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  shelf text;
  ln public.record_lines;
  item public.catalog_items;
  on_hand numeric;
  n_moved integer := 0;
  n_short integer := 0;
  n_unknown integer := 0;
  n_skipped integer := 0;
  is_en boolean;
  gone text;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if rec.module_key <> 'orders' then
    raise exception 'only an order sends goods out';
  end if;

  select p.system_language = 'en' into is_en
    from public.projects p where p.id = rec.project_id;
  gone := case when is_en then 'Delivered' else '交货了' end;

  /* 架子在哪一页。null 是一个真的答案：一间没有库存页的生意，
     照样要把单标成交货了 —— 那一半对它才是有用的那一半。 */
  select pp.page_key into shelf
  from public.project_pages pp
  where pp.project_id = rec.project_id and public.is_catalog_module(pp.page_key)
  order by pp.sort_order nulls last
  limit 1;

  if shelf is not null then
    for ln in
      select * from public.record_lines
       where record_id = in_record_id
       order by sort_order
    loop
      /* 已经出过了。不是错误 —— 那是第二次按，而诚实的答案是别动第一次。 */
      if exists (select 1 from public.stock_moves where line_id = ln.id) then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      /* 没有数量的是一口价那种行 —— 「安装费 RM 300」—— 架上没有东西要动。 */
      if coalesce(ln.qty, 0) <= 0 then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      item := null;
      if ln.item_id is not null then
        select * into item from public.catalog_items where id = ln.item_id;
      end if;

      if item.id is null then
        select * into item
        from public.catalog_items
        where project_id = rec.project_id
          and module_key = shelf
          and archived_at is null
          and lower(btrim(name)) = lower(btrim(ln.description))
        order by created_at
        limit 1;
      end if;

      /* 🔴 找不到就跳过。**不建**。见档头第 1 条。 */
      if item.id is null then
        n_unknown := n_unknown + 1;
        continue;
      end if;

      /* 架上现在有几件。直接从流水加，不走那个 view ——
         那个 view 是 security_invoker，而这一支是 definer，
         两种身分混在一句话里是这个仓库出过事的地方（20260901080000）。 */
      select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
        into on_hand
      from public.stock_moves m where m.item_id = item.id;

      if on_hand < ln.qty then
        n_short := n_short + 1;
      end if;

      insert into public.stock_moves (
        project_id, item_id, branch_id, doc_no, direction, qty, reason,
        against_id, line_id, moved_on, recorded_by
      ) values (
        rec.project_id,
        item.id,
        rec.branch_id,
        public.next_doc_no(rec.project_id, shelf),
        'out',
        ln.qty,
        coalesce(rec.doc_no, ''),
        in_record_id,
        ln.id,
        public.today_myt(),
        auth.uid()
      );

      /* 认出来的那一件写回去，下一次就不用再靠名字猜。 */
      if ln.item_id is null then
        update public.record_lines set item_id = item.id where id = ln.id;
      end if;
      n_moved := n_moved + 1;
    end loop;
  end if;

  /* 单往前走，不管架上有没有动 —— 车已经开出去了。
     只往前：一张已经「付清了」的单，不会因为有人再按一次交货而退回去。 */
  if coalesce(rec.stage, '') <> gone
     and coalesce(rec.stage, '') not in ('付清了', 'Paid') then
    update public.pipeline_records
       set stage = gone, updated_at = now()
     where id = in_record_id;
  end if;

  select r.stage into stage from public.pipeline_records r where r.id = in_record_id;
  moved := n_moved; short := n_short; unknown := n_unknown; skipped := n_skipped;
  return next;
end;
$$;

revoke execute on function public.deliver_record(uuid) from public, anon;
grant execute on function public.deliver_record(uuid) to authenticated;

comment on function public.deliver_record(uuid) is
  'An order went out: take its lines off the shelf. Never creates an item (a typo would become a phantom product) and never blocks a sale for being short -- it reports how many lines were short and lets the owner judge. Mirror of receive_purchase. See 20260905050000.';

comment on column public.catalog_items.price_cents is
  'What he sells it for. Read by set_record_lines when a line names this item and he did not type a price of his own -- the price agreed on the document always wins. Dead from 20260901070000 until 20260905050000.';

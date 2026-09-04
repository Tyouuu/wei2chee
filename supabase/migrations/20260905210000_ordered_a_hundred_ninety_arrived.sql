-- 叫 100 包，来 90 包。
--
-- ── 先读，再挑更简单的那一版（[重点 7d-2]）──────────────────────────────
--
-- `frappe/erpnext` 的 `Purchase Receipt Item`：**128 个栏位**，
-- 光是数量就有**八个**：`received_qty` · `qty`（验收合格的）· `rejected_qty` ·
-- `stock_qty` · `returned_qty` · `received_stock_qty` …
--
-- 那是给有品管部门的工厂做的。**一个五金店老板不做验收** ——
-- 罗厘来了，他数一数，写 90。
--
-- **所以一行只多一个数字：实际来了几件。**
--
-- ── 🔴 而这一件同时是一个打字问题（[重点 29]）───────────────────────────
--
-- 今天他要先把单上的「100」改成「90」，再按「货到了」——
-- **两个动作，而且「我本来叫了 100」被他自己覆盖掉了**。
-- 之后供应商开他 100 包的钱，他手上没有任何东西讲得出差在哪。
--
-- ── 🔴 一行只准一笔，是分批收货的对立面 ────────────────────────────────
--
-- 20260901100000 建了 `stock_moves_line_idx`（一行只准一笔进出），
-- 而它当时是对的：那时候收货是「整行一次进」，那条索引挡的是按两下。
--
-- **分批收货要求同一行有好几笔**，所以那条索引要走。
-- 防重复搬去它本来就该在的地方：**这一次按下去那一把钥匙**
-- （`stock_moves_idempotency_idx`，从建表那天就在）。
--
-- ⚠️ 而 `deliver_record` 也跟着改：它原本靠 `exists(...)` 判「出过了」，
-- 索引一拿掉就要改成**数量比数量** —— 不然一张分两车出的单，
-- 第二车永远出不去。**改一条规矩，要把靠着它的每一个地方一起改。**
--
-- ── ⚠️ 签名变了，所以先 drop（今天才踩过一次）────────────────────────────
--
-- 20260905180000 那一课：加一个有预设的参数**不是取代，是多一个多载**，
-- 而 PostgREST 会拒绝选，整条线当场瘫掉。

drop index if exists public.stock_moves_line_idx;

drop function if exists public.receive_purchase(uuid);
drop function if exists public.deliver_record(uuid);

create or replace function public.receive_purchase(
  in_record_id uuid,
  /* 每一行实际来了几件：`[{"line_id": uuid, "qty": 90}]`。
     **不给就是「剩下的全部到了」** —— 他今天按那颗按钮的意思一个字没变。 */
  in_received jsonb default null,
  /* 一次按下去的钥匙。分几次收货的时候，防重复靠它，不靠「一行一笔」。 */
  in_idempotency_key uuid default null
)
returns table (moved integer, created integer, skipped integer, over integer, short integer, stage text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  shelf text;
  ln public.record_lines;
  item public.catalog_items;
  n_moved integer := 0;
  n_created integer := 0;
  n_skipped integer := 0;
  n_over integer := 0;
  n_short integer := 0;
  ordered_qty numeric;
  already_qty numeric;
  take_qty numeric;
  said jsonb;
  is_en boolean;
  arrived text;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if rec.module_key <> 'purchases' then
    raise exception 'only a purchase order brings goods in';
  end if;

  select p.system_language = 'en' into is_en
    from public.projects p where p.id = rec.project_id;
  arrived := case when is_en then 'Received' else '到货了' end;

  /* Which page the shelf lives on. Null is a real answer: a business with no
     stock page still gets its order marked as arrived, which is the half of
     this that is useful to it. */
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
      /* 一口价那种行 —— 「运费 RM 300」—— 架上没有东西要动。 */
      if coalesce(ln.qty, 0) <= 0 then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      ordered_qty := coalesce(ln.qty, 0);

      /* 🔴 **已经收到几件**，不是「收过了没有」。
         叫 100 来 90，下个礼拜再来 10 —— 那是这一行每天在发生的事，
         而旧的那句 `exists(...)` 让第二车永远进不来。 */
      select coalesce(sum(m.qty), 0) into already_qty
      from public.stock_moves m
      where m.line_id = ln.id and m.direction = 'in';

      /* 他讲了这一行来几件就照他讲的；没讲就是「剩下的全部到了」。 */
      said := null;
      if in_received is not null then
        select x into said
        from jsonb_array_elements(in_received) x
        where (x->>'line_id')::uuid = ln.id
        limit 1;
        if said is null then
          /* 他这一次没提到这一行 = 这一行这一车没有来。 */
          n_skipped := n_skipped + 1;
          if already_qty < ordered_qty then n_short := n_short + 1; end if;
          continue;
        end if;
        take_qty := coalesce((said->>'qty')::numeric, 0);
      else
        take_qty := ordered_qty - already_qty;
      end if;

      if take_qty <= 0 then
        n_skipped := n_skipped + 1;
        if already_qty < ordered_qty then n_short := n_short + 1; end if;
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

      if item.id is null then
        /* Through the same function a person presses (重点 23). The unit comes
           off the line, because the line is where he wrote it. */
        item := public.add_catalog_item(
          rec.project_id,
          shelf,
          left(btrim(ln.description), 200),
          coalesce(ln.unit, ''),
          '', '', null, '', null,
          /* What it cost, on the item, from the line he actually paid. It is
             not used for anything yet -- see the note on valuation in
             20260901070000 -- and it is the only moment the number is known. */
          ln.unit_price_cents,
          null,
          '',
          jsonb_build_object('from_purchase', rec.id)
        );
        n_created := n_created + 1;
      end if;

      insert into public.stock_moves (
        project_id, item_id, branch_id, doc_no, direction, qty, reason,
        against_id, line_id, cost_cents, moved_on, recorded_by, idempotency_key
      ) values (
        rec.project_id,
        item.id,
        rec.branch_id,
        public.next_doc_no(rec.project_id, shelf),
        'in',
        take_qty,
        coalesce(rec.doc_no, ''),
        in_record_id,
        ln.id,
        ln.unit_price_cents,
        public.today_myt(),
        auth.uid(),
        /* 一行一把钥匙，从他这一次按下去那一把derive ——
           同一次按两下，第二下什么都不会再进。 */
        case when in_idempotency_key is null then null
             else md5(in_idempotency_key::text || ln.id::text)::uuid end
      );

      update public.record_lines set item_id = item.id where id = ln.id;
      n_moved := n_moved + 1;

      /* 讲出来：来多了几行、还差几行。**他要知道，而且不该由我们判**。 */
      if already_qty + take_qty > ordered_qty then
        n_over := n_over + 1;
      elsif already_qty + take_qty < ordered_qty then
        n_short := n_short + 1;
      end if;
    end loop;
  end if;

  /* The stage moves whether or not anything went on a shelf: the lorry came.
     Only forward -- an order already marked 付清了 is not walked backwards by
     somebody pressing receive again. */
  /* 🔴 只有**收齐了**才走到「到货了」。收了一半就标成到货，
     是这张单在说一句不是真的话，而他之后要靠它判断还要不要追货。 */
  if n_short = 0
     and coalesce(rec.stage, '') <> arrived
     and coalesce(rec.stage, '') not in ('付清了', 'Paid') then
    update public.pipeline_records
       set stage = arrived, updated_at = now()
     where id = in_record_id;
  end if;

  select r.stage into stage from public.pipeline_records r where r.id = in_record_id;
  moved := n_moved; created := n_created; skipped := n_skipped;
  over := n_over; short := n_short;
  return next;
end;
$$;


-- ── 出货也跟着改成看累计 ──────────────────────────────────────────────────
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
      /* 已经出过了。**看累计，不看有没有** —— 20260905210000 拿掉了
         「一行只准一笔」那条索引（分批收货要它），所以这里也要跟着改成
         数量比数量，不然一张分两车出的单第二车永远出不去。 */
      if coalesce((
        select sum(m.qty) from public.stock_moves m
        where m.line_id = ln.id and m.direction = 'out'
      ), 0) >= coalesce(ln.qty, 0) then
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


revoke execute on function public.receive_purchase(uuid, jsonb, uuid) from public, anon;
grant execute on function public.receive_purchase(uuid, jsonb, uuid) to authenticated;
revoke execute on function public.deliver_record(uuid) from public, anon;
grant execute on function public.deliver_record(uuid) to authenticated;

comment on function public.receive_purchase(uuid, jsonb, uuid) is
  'Goods arrived. Say how many per line and it takes that many; say nothing and it takes whatever is still outstanding. One number per line, not ERPNext''s eight -- a hardware shop counts the lorry, it does not run an inspection. See 20260905210000.';

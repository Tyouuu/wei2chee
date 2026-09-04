-- 批号跟着货走：进货的时候出生，出货的时候照效期先出。
--
-- 20260905320000 建了那张表跟「什么快过期了」。**而一张没有人写进去、
-- 也没有人扣出来的表，只是一个漂亮的空格子** —— 这个仓库最常犯的错就是
-- 「能力有、线没接」，所以两半在同一天做完。
--
--   进：`receive_purchase` 从单据那一行的批号跟效期开一批
--   出：`deliver_record` 没讲哪一批就**照效期最早的先出**，一行可以拆两笔
--
-- ── 🔴 出货为什么可以自动挑，而盘点不可以 ────────────────────────────────
--
-- 两件事看起来一样，判断相反，理由要写清楚：
--
--   · **出货**：不挑，「这一批还剩几件」立刻变成假数字。而 FEFO 不是猜 ——
--     那是这三行生意本来就在做的事，反过来（让快过期的留在架上）才是错的。
--     **而且他真的拿了别一盒，改那一笔就好**
--   · **盘点**：数出来 84 是哪一批的，**没有任何规则答得出来**。
--     随便挑一批就是毁资料，而毁掉的是「什么快过期了」那一句
--
-- 分界是同一条：**有规则的地方照规则，没有规则的地方问他。**

create or replace function public.receive_purchase(
  in_record_id uuid,
  in_received jsonb default null,
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
  lot public.stock_batches;
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
      if coalesce(ln.qty, 0) <= 0 then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      ordered_qty := coalesce(ln.qty, 0);

      select coalesce(sum(m.qty), 0) into already_qty
      from public.stock_moves m
      where m.line_id = ln.id and m.direction = 'in';

      said := null;
      if in_received is not null then
        select x into said
        from jsonb_array_elements(in_received) x
        where (x->>'line_id')::uuid = ln.id
        limit 1;
        if said is null then
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
        item := public.add_catalog_item(
          rec.project_id, shelf,
          left(btrim(ln.description), 200), coalesce(ln.unit, ''),
          '', '', null, '', null, ln.unit_price_cents, null, '',
          jsonb_build_object('from_purchase', rec.id)
        );
        n_created := n_created + 1;
      end if;

      /* 🔴 **一批货就是在这里出生的。**
         供应商的单上印着批号跟效期，而那两栏他刚刚打在这一行上。
         这一车的批号也可以在按下去的时候讲（`in_received` 里带 batch），
         因为同一行分两车到，两车常常是两批。 */
      lot := null;
      declare
        said_code text := nullif(btrim(coalesce(said->>'batch_code', '')), '');
        said_exp date := nullif(said->>'expiry_on', '')::date;
        use_code text;
        use_exp date;
      begin
        use_code := coalesce(said_code, nullif(btrim(coalesce(ln.batch_code, '')), ''));
        use_exp := coalesce(said_exp, ln.expiry_on);
        if use_code is not null then
          lot := public.add_stock_batch(item.id, use_code, use_exp, public.today_myt(), '');
        end if;
      end;

      insert into public.stock_moves (
        project_id, item_id, branch_id, batch_id, doc_no, direction, qty, reason,
        against_id, line_id, cost_cents, moved_on, recorded_by, idempotency_key
      ) values (
        rec.project_id, item.id, rec.branch_id, lot.id,
        public.next_doc_no(rec.project_id, shelf),
        'in', take_qty, coalesce(rec.doc_no, ''),
        in_record_id, ln.id, ln.unit_price_cents,
        public.today_myt(), auth.uid(),
        case when in_idempotency_key is null then null
             else md5(in_idempotency_key::text || ln.id::text)::uuid end
      );

      update public.record_lines set item_id = item.id where id = ln.id;
      n_moved := n_moved + 1;

      if already_qty + take_qty > ordered_qty then
        n_over := n_over + 1;
      elsif already_qty + take_qty < ordered_qty then
        n_short := n_short + 1;
      end if;
    end loop;
  end if;

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

comment on function public.receive_purchase(uuid, jsonb, uuid) is
  'Receiving is where a batch is born: the lot and expiry printed on the supplier''s line become a stock_batches row and tag the movement. The lot can also be named per delivery in in_received, because one line arriving in two lorries is usually two batches. See 20260905330000.';

-- ── 出货：没讲哪一批就照效期最早的先出 ────────────────────────────────────
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
  lot record;
  on_hand numeric;
  want numeric;
  take numeric;
  n_moved integer := 0;
  n_short integer := 0;
  n_unknown integer := 0;
  n_skipped integer := 0;
  has_lots integer;
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
      if exists (select 1 from public.stock_moves where line_id = ln.id) then
        n_skipped := n_skipped + 1;
        continue;
      end if;
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
      if item.id is null then
        n_unknown := n_unknown + 1;
        continue;
      end if;

      select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
        into on_hand
      from public.stock_moves m where m.item_id = item.id;

      if on_hand < ln.qty then
        n_short := n_short + 1;
      end if;

      select count(*) into has_lots
      from public.stock_batches b
      where b.item_id = item.id and b.archived_at is null;

      if has_lots = 0 then
        insert into public.stock_moves (
          project_id, item_id, branch_id, doc_no, direction, qty, reason,
          against_id, line_id, moved_on, recorded_by
        ) values (
          rec.project_id, item.id, rec.branch_id,
          public.next_doc_no(rec.project_id, shelf),
          'out', ln.qty, coalesce(rec.doc_no, ''),
          in_record_id, ln.id, public.today_myt(), auth.uid()
        );
      else
        /* 🔴 照效期最早的先出。一批不够就往下一批拿 ——
           **一行可以拆成两笔**，而那正是仓库里真的发生的事。 */
        want := ln.qty;
        for lot in
          select b.id,
                 coalesce((
                   select sum(case when m.direction = 'in' then m.qty else -m.qty end)
                   from public.stock_moves m where m.batch_id = b.id
                 ), 0)::numeric as have
          from public.stock_batches b
          where b.item_id = item.id
            and b.archived_at is null
            /* 他指名了就只用那一批。 */
            and (nullif(btrim(coalesce(ln.batch_code, '')), '') is null
                 or b.code = btrim(ln.batch_code))
          order by b.expiry_on nulls last, b.received_on, b.code
        loop
          exit when want <= 0;
          if lot.have <= 0 then
            continue;
          end if;
          take := least(want, lot.have);
          insert into public.stock_moves (
            project_id, item_id, branch_id, batch_id, doc_no, direction, qty, reason,
            against_id, line_id, moved_on, recorded_by
          ) values (
            rec.project_id, item.id, rec.branch_id, lot.id,
            public.next_doc_no(rec.project_id, shelf),
            'out', take, coalesce(rec.doc_no, ''),
            in_record_id, ln.id, public.today_myt(), auth.uid()
          );
          want := want - take;
        end loop;

        /* 🔴 每一批都空了还差一些 —— **照样出，然后讲出来**。
           挡下去他就绕过系统卖，而那是他停用它的那一天
           （20260905050000 定的同一条）。那一笔不挂批号，
           因为它不属於任何一批，而假装它属於某一批才是说谎。 */
        if want > 0 then
          insert into public.stock_moves (
            project_id, item_id, branch_id, doc_no, direction, qty, reason,
            against_id, line_id, moved_on, recorded_by
          ) values (
            rec.project_id, item.id, rec.branch_id,
            public.next_doc_no(rec.project_id, shelf),
            'out', want, coalesce(rec.doc_no, ''),
            in_record_id, ln.id, public.today_myt(), auth.uid()
          );
        end if;
      end if;

      if ln.item_id is null then
        update public.record_lines set item_id = item.id where id = ln.id;
      end if;
      n_moved := n_moved + 1;
    end loop;
  end if;

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

comment on function public.deliver_record(uuid) is
  'Sends the goods out, earliest expiry first when the item is kept in batches -- one line can split across two lots. FEFO is not a guess: it is what these trades do, and leaving the soon-to-expire box on the shelf is the wrong answer. See 20260905330000.';

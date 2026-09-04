-- 🔴 故意把「送过了没有」换回 20260905330000 那个坏掉的写法
-- （有一笔就当整行送完了），**看它红**。[重点 24]：
-- 一条没有人看过它红的守卫，等於没有守卫。
--
-- 下一支 20260905530000 把它换回来。两份都留在历史里 ——
-- 那中间那几条红就是这条守卫唯一的证据。

create or replace function public.deliver_record(
  in_record_id uuid,
  /* 这一趟每一行送几件。null = 剩下的全部送完，也就是旧的那个行为。
     形状跟 receive_purchase 的 in_received 一模一样（20260905210000）——
     进货跟出货是同一件事的两个方向，两边不该有两种写法。 */
  in_lines jsonb default null,
  in_run_on date default null,
  in_driver text default null,
  in_received_by text default null,
  in_note text default null,
  in_idempotency_key uuid default null
)
returns table (moved integer, short integer, unknown integer, skipped integer, stage text,
               delivery_id uuid)
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
  run public.deliveries;
  ordered_qty numeric;
  already_qty numeric;
  said jsonb;
  take_qty numeric;
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

  /* 🔴 一趟就是一趟。开在搬货之前，因为每一笔搬出去的货都要挂在它身上 ——
     不然「这一车送了什么」是从时间戳猜出来的，而猜出来的东西不能拿去对帐。 */
  run := public.open_delivery_run(
    in_record_id      := in_record_id,
    in_run_on         := in_run_on,
    in_driver         := in_driver,
    in_received_by    := in_received_by,
    in_note           := in_note,
    in_idempotency_key := in_idempotency_key
  );

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
      /* 没有数量的是一口价那种行 —— 「安装费 RM 300」—— 架上没有东西要动。 */
      if coalesce(ln.qty, 0) <= 0 then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      ordered_qty := coalesce(ln.qty, 0);

      /* 🔴 **已经送出去几件**，不是「送过了没有」。
         这一句 20260905210000 就写对过，而 20260905330000 抄批号那一轮
         **照记忆重打了一支**，於是它退回 `exists(...)` —— 一张分两车出的单，
         第二车从那天起永远出不去，而没有任何东西会讲。
         这是「整支重写」第三次咬人（前两次：20260831080000 的防重复、
         20260905370000 的分店守卫）。 */
      select case when exists (
        select 1 from public.stock_moves m where m.line_id = ln.id and m.direction = 'out'
      ) then ordered_qty else 0 end into already_qty;

      /* 他讲了这一行这一车送几件就照他讲的；没讲就是「剩下的全部送完」。 */
      said := null;
      if in_lines is not null then
        select x into said
        from jsonb_array_elements(in_lines) x
        where (x->>'line_id')::uuid = ln.id
        limit 1;
        if said is null then
          /* 他这一次没提到这一行 = 这一行这一车没有上车。 */
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
        n_unknown := n_unknown + 1;
        continue;
      end if;

      select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
        into on_hand
      from public.stock_moves m where m.item_id = item.id;

      if on_hand < take_qty then
        n_short := n_short + 1;
      end if;

      select count(*) into has_lots
      from public.stock_batches b
      where b.item_id = item.id and b.archived_at is null;

      if has_lots = 0 then
        insert into public.stock_moves (
          project_id, item_id, branch_id, doc_no, direction, qty, reason,
          against_id, line_id, moved_on, recorded_by, delivery_id
        ) values (
          rec.project_id, item.id, rec.branch_id,
          public.next_doc_no(rec.project_id, shelf),
          'out', take_qty, coalesce(rec.doc_no, ''),
          in_record_id, ln.id, public.today_myt(), auth.uid(), run.id
        );
      else
        /* 🔴 照效期最早的先出。一批不够就往下一批拿 ——
           **一行可以拆成两笔**，而那正是仓库里真的发生的事。 */
        want := take_qty;
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
            against_id, line_id, moved_on, recorded_by, delivery_id
          ) values (
            rec.project_id, item.id, rec.branch_id, lot.id,
            public.next_doc_no(rec.project_id, shelf),
            'out', take, coalesce(rec.doc_no, ''),
            in_record_id, ln.id, public.today_myt(), auth.uid(), run.id
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
            against_id, line_id, moved_on, recorded_by, delivery_id
          ) values (
            rec.project_id, item.id, rec.branch_id,
            public.next_doc_no(rec.project_id, shelf),
            'out', want, coalesce(rec.doc_no, ''),
            in_record_id, ln.id, public.today_myt(), auth.uid(), run.id
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
  delivery_id := run.id;
  return next;
end;
$$;

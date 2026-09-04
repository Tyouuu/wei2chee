-- 🔴 故意弄坏，看两条守卫红。**下一支立刻改回去。**
--
-- 弄坏两样，两样都是「照收货那一支抄」会自然写出来的样子：
--   ① 架上找不到就建一件新的 —— 打错字变出一件幽灵货品
--   ② 不再数「架上不够」的那几行 —— 他永远不知道自己超卖了
--
-- 应该报：
--   FAIL  🔴 认不得的那一行跳过，不建新货品
--   FAIL  🔴 但是讲出来有一行不够
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
        item := public.add_catalog_item(
          rec.project_id, shelf, left(btrim(ln.description), 200),
          coalesce(ln.unit, ''), '', '', null, '', null, null, null, '', '{}'::jsonb
        );
      end if;

      /* 架上现在有几件。直接从流水加，不走那个 view ——
         那个 view 是 security_invoker，而这一支是 definer，
         两种身分混在一句话里是这个仓库出过事的地方（20260901080000）。 */
      select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
        into on_hand
      from public.stock_moves m where m.item_id = item.id;


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

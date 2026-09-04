-- 🔴 故意把出货的顺序从「效期最早」换成「批号倒着排」，**看它红**。
--
-- [重点 24]：一条没有人看过它红的守卫，等於没有守卫。
-- 而这一条守的是这一整件事的主张：**先出快过期的那一盒**。
-- 坏掉的样子不是报错，是**快过期的那一批静静留在架上烂掉**，
-- 而画面上每一个数字看起来都正常。
--
-- 下一支（20260905400000）改回去。两支都留在历史里。
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
          order by b.code desc
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

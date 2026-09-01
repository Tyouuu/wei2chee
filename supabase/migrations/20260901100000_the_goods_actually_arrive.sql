-- supabase/migrations/20260901100000_the_goods_actually_arrive.sql
--
-- 进货单 → 库存. The wire 20260901070000 said out loud that it had not built.
--
-- ── WHAT WAS MISSING ─────────────────────────────────────────────────────
--
-- A purchase order could be written, given lines, and walked to 「到货了」 --
-- and nothing arrived anywhere. Stock had to be typed in a second time, on
-- another page, from the same piece of paper. That is exactly the double entry
-- this product exists to remove, and it is the reason its own header named
-- this as the next piece of work rather than leaving somebody to discover it.
--
-- ── READ FIRST: HOW ERPNext ANCHORS IT ───────────────────────────────────
--
-- Their Stock Ledger Entry carries three fields for provenance:
--
--     voucher_type · voucher_no · voucher_detail_no
--
-- The third is the LINE, not the document. That is the whole trick and it is
-- why receiving twice cannot double their stock: a movement belongs to one row
-- of one document, so 「has this line been received」 is a lookup rather than a
-- flag somebody has to maintain.
--
-- Copied as a real foreign key with a UNIQUE index, so it is enforced by the
-- database rather than by remembering to pass an idempotency key. A second
-- press cannot write a second movement even if every guard above it is wrong.
--
-- ── WHAT IS DELIBERATELY SIMPLER ─────────────────────────────────────────
--
-- · NO SEPARATE RECEIPT DOCUMENT. ERPNext has Purchase Order → Purchase
--   Receipt → Stock Ledger Entry. A five-man hardware shop does not write a
--   goods receipt note; the lorry comes and the bags go in the store. Here the
--   purchase order reaching 「到货了」 IS the receipt.
--
-- · NO received_qty / rejected_qty / accepted_qty. Their line carries three
--   quantities so a partial delivery can be split. Ours carries one: what the
--   line says arrived. ⚠️ SO A PARTIAL DELIVERY IS HANDLED BY EDITING THE LINE
--   BEFORE RECEIVING -- 100 ordered, 60 came, change the line to 60 -- or by
--   writing the rest as its own movement afterwards. Said here rather than
--   discovered: three quantity columns nobody fills in are worse than one that
--   is understood.
--
-- ── MATCHING A LINE TO AN ITEM, AND WHY IT IS SAFE HERE ──────────────────
--
-- A line says 「水泥 50kg」; the shelf has an item called 「水泥 50kg」. Matched
-- on the name, case- and space-insensitively, and created when there is none.
--
-- ⚠️ THAT IS THE OPPOSITE CALL FROM convert_enquiry, WHICH REFUSES TO MATCH
-- PEOPLE BY NAME (20260901060000). The difference is real: two 陈先生 with
-- different numbers are two men, and 陈 is one of the commonest surnames in
-- this market. Two shelf entries both called 「水泥 50kg」 in one shop are not
-- two things -- they are the same thing typed twice, and merging them is the
-- correct answer rather than a risk.

-- ── THE LINE KNOWS WHICH ITEM IT IS ───────────────────────────────────────

alter table public.record_lines
  add column if not exists item_id uuid
    references public.catalog_items(id) on delete set null;

comment on column public.record_lines.item_id is
  'Which shelf entry this line turned out to be, filled in when the order is received. `on delete set null` -- archiving an item must not rewrite what a purchase order said at the time.';

create index if not exists record_lines_item_idx
  on public.record_lines (item_id) where item_id is not null;

-- ── A MOVEMENT BELONGS TO ONE LINE ────────────────────────────────────────

alter table public.stock_moves
  add column if not exists line_id uuid
    references public.record_lines(id) on delete set null;

/* THE WHOLE IDEMPOTENCY, IN ONE INDEX. ERPNext's voucher_detail_no, enforced.
   Receiving the same order twice cannot write a second movement for a line,
   whatever the caller does. */
create unique index if not exists stock_moves_line_idx
  on public.stock_moves (line_id) where line_id is not null;

comment on column public.stock_moves.line_id is
  'The document line that caused this movement -- ERPNext''s voucher_detail_no. Unique, so a second press cannot double the stock even if every check above it is wrong.';

-- ── RECEIVING ─────────────────────────────────────────────────────────────

create or replace function public.receive_purchase(in_record_id uuid)
returns table (moved integer, created integer, skipped integer, stage text)
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
      /* Already received. Not an error -- it is the second press, and the
         honest answer is to leave the first one alone. */
      if exists (select 1 from public.stock_moves where line_id = ln.id) then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      /* A line with no quantity is a lump-sum line -- 「防水工程 RM 4,500」 --
         and there is nothing to put on a shelf. */
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
        against_id, line_id, cost_cents, moved_on, recorded_by
      ) values (
        rec.project_id,
        item.id,
        rec.branch_id,
        public.next_doc_no(rec.project_id, shelf),
        'in',
        ln.qty,
        coalesce(rec.doc_no, ''),
        in_record_id,
        ln.id,
        ln.unit_price_cents,
        public.today_myt(),
        auth.uid()
      );

      update public.record_lines set item_id = item.id where id = ln.id;
      n_moved := n_moved + 1;
    end loop;
  end if;

  /* The stage moves whether or not anything went on a shelf: the lorry came.
     Only forward -- an order already marked 付清了 is not walked backwards by
     somebody pressing receive again. */
  if coalesce(rec.stage, '') <> arrived
     and coalesce(rec.stage, '') not in ('付清了', 'Paid') then
    update public.pipeline_records
       set stage = arrived, updated_at = now()
     where id = in_record_id;
  end if;

  select r.stage into stage from public.pipeline_records r where r.id = in_record_id;
  moved := n_moved; created := n_created; skipped := n_skipped;
  return next;
end;
$$;

comment on function public.receive_purchase(uuid) is
  '进货单 → 库存, one press. Each line becomes one movement, anchored to the line so a second press cannot double it. Matches shelf entries by name and creates what is missing -- the opposite call from convert_enquiry, and the header of 20260901100000 says why that is right for things and wrong for people.';

revoke execute on function public.receive_purchase(uuid) from public;
grant execute on function public.receive_purchase(uuid) to authenticated;

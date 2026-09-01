-- supabase/migrations/20260901110000_a_received_order_is_closed.sql
--
-- 🔴 A purchase order that had already been received could be edited, and
-- receiving it again doubled the stock.
--
-- ── MEASURED, NOT REASONED ───────────────────────────────────────────────
--
--     收第一次: {"moved":1,"skipped":0}      架上: Cement 50kg  100
--     ...he adds a delivery line and presses receive again...
--     收第二次: {"moved":1,"skipped":1}      架上: Cement 50kg  200
--
-- One hundred bags became two hundred, in the one place nobody can catch it by
-- eye: a contractor does not know he should have a hundred.
--
-- ── WHY THE GUARD THAT WAS THERE DID NOTHING ─────────────────────────────
--
-- 20260901100000 anchors each movement to the LINE that caused it, with a
-- unique index -- ERPNext's `voucher_detail_no`, and it is the right anchor.
-- It assumed line ids are stable. They are not: `set_record_lines` REPLACES
-- the whole list (deletes every row, inserts new ones), because a document's
-- lines are edited as a block and a half-applied edit is a total nobody
-- agreed to. So after any edit the old ids are gone, `line_id` has been set to
-- null by the foreign key, and every line looks unreceived.
--
-- The two designs are each correct and they are incompatible. Something had to
-- give, and it is not the block edit -- that rule protects the quotation
-- totals every customer sees.
--
-- ── SO: ONCE GOODS HAVE ARRIVED, THE LINES ARE CLOSED ────────────────────
--
-- Which is what a document system does. ERPNext calls it `docstatus` -- a
-- submitted document is immutable, and a correction is a new document. This
-- schema already applies the same rule to money: `update_ledger_words` changes
-- the words and never the amount, because 20260831020000 decided a wrong
-- payment is corrected by a reversal rather than by an edit.
--
-- Stock is the same kind of fact. The bags are in the store; editing the piece
-- of paper does not take them out again.
--
-- ⚠️ SO WHAT DOES HE DO WHEN ONLY 60 OF 100 ARRIVED?
--
--   · before receiving -- edit the line. That is the ordinary case and it
--     still works, which is why this refuses only AFTER goods have moved
--   · after receiving  -- write the difference as its own movement. That is
--     also the honest record: something came, and then something else did
--
-- The message says so, in his words, because 「violates unique constraint」
-- teaches a contractor nothing he can act on.

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

  /* 🔴 THE ONE ADDED TODAY. See the header: without it, editing a received
     purchase order and pressing receive again doubles the stock, because the
     replacement below gives every line a new id and the movements no longer
     recognise them. */
  select count(*) into received
  from public.stock_moves where against_id = in_record_id;

  if received > 0 then
    select p.system_language = 'en' into is_en
      from public.pipeline_records r
      join public.projects p on p.id = r.project_id
     where r.id = in_record_id;
    if is_en then
      raise exception
        'The goods on this order are already in your stock, so its lines cannot be changed. Record what actually happened as a stock movement instead.';
    else
      raise exception
        '这张单的货已经进了库存，行就不能再改了。要更正就记一笔进或出。';
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
    insert into public.record_lines (
      record_id, project_id, description, qty, unit,
      unit_price_cents, amount_cents, sort_order, note, extra
    ) values (
      in_record_id,
      /* Overwritten by the trigger; a value is needed for the not-null. */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 300),
      nullif(item->>'qty', '')::numeric,
      left(coalesce(btrim(item->>'unit'), ''), 30),
      nullif(item->>'unit_price_cents', '')::bigint,
      coalesce(nullif(item->>'amount_cents', '')::bigint, 0),
      i,
      left(coalesce(item->>'note', ''), 500),
      coalesce(item->'extra', '{}'::jsonb)
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

comment on function public.set_record_lines(uuid, jsonb) is
  'Replaces a document''s lines as a block. REFUSES once goods from that document are in stock -- see 20260901110000: the block replacement gives every line a new id, and receiving again would then count the whole order a second time.';

revoke execute on function public.set_record_lines(uuid, jsonb) from public;
grant execute on function public.set_record_lines(uuid, jsonb) to authenticated;

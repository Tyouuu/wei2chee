-- supabase/migrations/20260831040000_a_deleted_receipt_must_not_jam_the_book.sql
--
-- Deleting one document stopped a business from ever writing another.
--
-- ── WHAT HAPPENED, MEASURED ───────────────────────────────────────────────
--
--   RC-2026-0001 · RC-2026-0002 · RC-2026-0003     three receipts
--   delete RC-2026-0002                            allowed: it is his own row
--   next receipt -> count(*) = 2 -> RC-2026-0003   which already exists
--
--   ERROR: duplicate key value violates unique constraint
--          "ledger_entries_doc_no_unique"
--
-- And it never recovers. Every subsequent attempt counts the same two rows and
-- proposes the same taken number, so the ledger is jammed permanently by one
-- ordinary act the interface allows. Reproduced on both shapes: pipeline_records
-- has carried this since 20260830040000.
--
-- ── WHY THE ORIGINAL REASONING WAS RIGHT AND THE CODE WAS NOT ─────────────
--
-- 20260830040000 says, correctly:
--
--     "A cancelled document leaves its number spent, which is correct: an
--      accounting number is never reused and a gap is evidence rather than a
--      defect."
--
-- That is exactly the right rule. `count(*)` is simply not an implementation
-- of it -- counting REUSES the gap it was supposed to preserve. The comment
-- described the intended behaviour and the code did the opposite, which is why
-- reading it never raised a question.
--
-- ── THE IMPLEMENTATION THAT MATCHES THE SENTENCE ──────────────────────────
--
-- Take the highest number already issued and add one. A gap stays a gap
-- forever, a deleted receipt keeps its number spent, and nothing that happens
-- to existing rows can propose a number that was ever used.
--
-- It is still not a sequence, for the reason already recorded: a sequence per
-- project per module per year is thousands of objects that cannot be renumbered
-- when an owner changes his prefix. The unique constraint remains what makes a
-- race impossible rather than unlikely -- two simultaneous inserts still read
-- the same max, and the loser still retries.
--
-- ── HOW IT WAS FOUND ──────────────────────────────────────────────────────
--
-- The founder asked whether a different UI could be swapped in later. Testing
-- that meant asking what a front end could do to these tables WITHOUT the RPC,
-- and one of those things is `delete`, which the RLS policy allows because the
-- rows are his. The question was about UI portability; the answer was a defect
-- in the numbering. Neither test suite would have found it, because both write
-- and none of them delete.

create or replace function public.next_doc_no(in_project_id uuid, in_module_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  my_prefix text;
  yr text := to_char(public.today_myt(), 'YYYY');
  highest bigint;
  like_pattern text;
begin
  select prefix into my_prefix
  from public.project_doc_prefixes
  where project_id = in_project_id and module_key = in_module_key;

  my_prefix := coalesce(my_prefix, public.default_doc_prefix(in_module_key));
  like_pattern := my_prefix || '-' || yr || '-%';

  /* The highest ALREADY ISSUED, not how many exist. The extra `~ '-[0-9]+$'`
     is not defensive noise: a document number can be set directly by anything
     holding an authenticated session, so a row ending in something that is not
     a number is reachable, and `::bigint` on it would raise -- turning a
     cosmetic oddity into the same permanent jam this migration removes. */
  if public.is_pipeline_module(in_module_key) then
    select coalesce(max(substring(doc_no from '[0-9]+$')::bigint), 0) into highest
    from public.pipeline_records
    where project_id = in_project_id
      and module_key = in_module_key
      and doc_no like like_pattern
      and doc_no ~ '-[0-9]+$';
  elsif public.is_ledger_module(in_module_key) then
    select coalesce(max(substring(doc_no from '[0-9]+$')::bigint), 0) into highest
    from public.ledger_entries
    where project_id = in_project_id
      and module_key = in_module_key
      and doc_no like like_pattern
      and doc_no ~ '-[0-9]+$';
  else
    /* Loudly. A module with no table behind it must not be handed a number
       that looks real -- that is how a shape gets half-wired. */
    raise exception 'no numbered table for module: %', in_module_key;
  end if;

  return my_prefix || '-' || yr || '-' || lpad((highest + 1)::text, 4, '0');
end;
$$;

comment on function public.next_doc_no(uuid, text) is
  'The next document number for one project, module and year: QT-2026-0042 or RC-2026-0007. One MORE than the highest already issued, never a count -- counting reuses the number of any deleted row and jams the book permanently against the unique constraint. Branches on the module''s shape; raises for a module with no numbered table rather than inventing DOC-.';

revoke execute on function public.next_doc_no(uuid, text) from public;
grant execute on function public.next_doc_no(uuid, text) to authenticated;

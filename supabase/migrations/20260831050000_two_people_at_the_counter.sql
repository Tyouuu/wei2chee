-- supabase/migrations/20260831050000_two_people_at_the_counter.sql
--
-- Eight people pressing 「收了」 in the same second recorded six payments.
--
-- ── MEASURED, NOT SUSPECTED ───────────────────────────────────────────────
--
--   8 concurrent add_ledger_entry calls, eight DIFFERENT payments
--   -> 6 rows written, 2 raised
--      duplicate key value violates unique constraint
--      "ledger_entries_doc_no_unique"
--
-- Not a retry, not a double-press: eight separate customers paying. An
-- idempotency key cannot help, because these are not the same intent -- that
-- is precisely the case a key is not for.
--
-- Both readers of max(doc_no) ran before either wrote, so both proposed the
-- same next number and the unique constraint -- correctly -- refused the
-- second. The constraint was doing its job. The number generator was not.
--
-- This is a salon with three staff at one counter, a restaurant at closing,
-- a wholesaler keying in the morning's orders. It is not an edge case in this
-- market; it is Saturday.
--
-- ── HOW A SYSTEM THAT RUNS REAL BOOKS DOES IT ─────────────────────────────
--
-- frappe/frappe (MIT, 10.7k stars, the engine under ERPNext) -- frappe/model/
-- naming.py, read rather than remembered:
--
--     current = (frappe.qb.from_(series).where(series.name == key)
--                .for_update().select("current")).run()
--     frappe.db.sql("UPDATE `tabSeries` SET `current` = `current` + 1
--                    WHERE `name`=%s", (key,))
--     ...
--     frappe.db.sql("INSERT INTO `tabSeries` (`name`, `current`)
--                    VALUES (%s, 1)", (key,))
--
-- A COUNTER ROW, LOCKED. Never a count of the documents themselves. Both of
-- this repo's numbering defects -- the jam after a delete, and this race --
-- come from the same root: asking the data how many there are instead of
-- keeping a record of how far it has got.
--
-- ── WHY NOT A POSTGRES SEQUENCE ───────────────────────────────────────────
--
-- The reason recorded in 20260830040000 still holds: one sequence per project
-- per module per year is thousands of catalogue objects, and none of them can
-- be renumbered when an owner changes his prefix. A counter row is a row --
-- it can be edited, reset, exported and bought out with the rest of his data.
--
-- ── WHY THE LOOP IS STILL THERE ───────────────────────────────────────────
--
-- A counter alone assumes nothing else ever writes a doc_no. Measured on
-- 2026-08-31: any authenticated session CAN insert one directly, because the
-- RLS policy lets an owner write his own rows and the column is just text. So
-- the counter can fall behind reality. Rather than pretend that cannot happen,
-- next_doc_no skips numbers that are already taken and carries the counter
-- forward past them -- bounded, so a broken state fails loudly instead of
-- spinning.

create table if not exists public.doc_counters (
  project_id uuid not null references public.projects(id) on delete cascade,
  module_key text not null,
  yr text not null,
  /* The last number ISSUED, not the number of rows. A deleted document does
     not give its number back -- that is the same rule 20260831040000 restored,
     now held by a counter that cannot forget it. */
  last_no bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (project_id, module_key, yr)
);

comment on table public.doc_counters is
  'How far each project/module/year has got in its numbering. Held as a counter rather than counted from the documents: counting reuses the number of anything deleted, and two people counting at once propose the same number. Mirrors tabSeries in frappe/model/naming.py.';

/* ── NOBODY REACHES THIS TABLE DIRECTLY ────────────────────────────────────
   RLS on with no policies at all: every path in is next_doc_no(), which is
   security definer and therefore runs as the owner. Deliberate -- a counter a
   client can set is a counter that can be walked backwards over numbers a
   business has already printed and handed to a customer. */
alter table public.doc_counters enable row level security;

create or replace function public.next_doc_no(in_project_id uuid, in_module_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  my_prefix text;
  yr text := to_char(public.today_myt(), 'YYYY');
  n bigint;
  seed bigint;
  candidate text;
  like_pattern text;
  attempts integer := 0;
begin
  if not (public.is_pipeline_module(in_module_key) or public.is_ledger_module(in_module_key)) then
    /* Loudly. A module with no table behind it must not be handed a number
       that looks real -- that is how a shape gets half-wired. */
    raise exception 'no numbered table for module: %', in_module_key;
  end if;

  select prefix into my_prefix
  from public.project_doc_prefixes
  where project_id = in_project_id and module_key = in_module_key;

  my_prefix := coalesce(my_prefix, public.default_doc_prefix(in_module_key));
  like_pattern := my_prefix || '-' || yr || '-%';

  loop
    attempts := attempts + 1;
    if attempts > 50 then
      /* Fifty taken numbers in a row means something is writing doc_no behind
         the counter's back. Failing here is right: silently walking further
         would hide it, and the alternative -- issuing a duplicate -- is the
         one thing an accounting number may never be. */
      raise exception 'could not find a free document number for % after % tries', in_module_key, attempts;
    end if;

    /* The fast path, and the one that makes concurrency safe: a single UPDATE
       takes a row lock, so a second caller waits, re-reads, and gets n+1. */
    /* Qualified on both sides: the column is `yr` and so is the variable, and
       an unqualified `yr = yr` is a tautology that would increment every year
       this project has -- the same 42702 family of mistake as the site_slug
       collision recorded on 2026-08-25, which was also only visible at run
       time. */
    update public.doc_counters
       set last_no = doc_counters.last_no + 1, updated_at = now()
     where doc_counters.project_id = in_project_id
       and doc_counters.module_key = in_module_key
       and doc_counters.yr = next_doc_no.yr
    returning doc_counters.last_no into n;

    if not found then
      /* First document of this module this year -- or the first since this
         table existed. Seeded from what has ALREADY been issued so a business
         with rows from before today continues from where it was rather than
         restarting at 0001 on top of its own receipts. */
      if public.is_pipeline_module(in_module_key) then
        select coalesce(max(substring(doc_no from '[0-9]+$')::bigint), 0) into seed
        from public.pipeline_records
        where project_id = in_project_id and module_key = in_module_key
          and doc_no like like_pattern and doc_no ~ '-[0-9]+$';
      else
        select coalesce(max(substring(doc_no from '[0-9]+$')::bigint), 0) into seed
        from public.ledger_entries
        where project_id = in_project_id and module_key = in_module_key
          and doc_no like like_pattern and doc_no ~ '-[0-9]+$';
      end if;

      insert into public.doc_counters (project_id, module_key, yr, last_no)
      values (in_project_id, in_module_key, yr, seed)
      on conflict (project_id, module_key, yr) do nothing;

      /* Round again. Whether this call seeded it or lost the race to another
         that did, the UPDATE above is now the single place the number comes
         from. */
      continue;
    end if;

    candidate := my_prefix || '-' || yr || '-' || lpad(n::text, 4, '0');

    /* Taken by something that did not come through here -- see the header.
       Skip it and let the counter carry past. */
    if public.is_pipeline_module(in_module_key) then
      perform 1 from public.pipeline_records
       where project_id = in_project_id and module_key = in_module_key and doc_no = candidate;
    else
      perform 1 from public.ledger_entries
       where project_id = in_project_id and module_key = in_module_key and doc_no = candidate;
    end if;
    if not found then
      return candidate;
    end if;
  end loop;
end;
$$;

comment on function public.next_doc_no(uuid, text) is
  'The next document number for one project, module and year: QT-2026-0042 or RC-2026-0007. Comes from a locked counter row, never from counting documents -- counting reuses a deleted row''s number and gives two simultaneous callers the same one. Skips numbers taken behind its back, bounded, rather than issuing a duplicate.';

revoke execute on function public.next_doc_no(uuid, text) from public;
grant execute on function public.next_doc_no(uuid, text) to authenticated;

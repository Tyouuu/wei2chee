-- supabase/migrations/20260831060000_a_variable_named_like_its_column.sql
--
-- 20260831050000 shipped a next_doc_no() that could not run:
--
--     ERROR: missing FROM-clause entry for table "next_doc_no"
--
-- The local variable was called `yr` and so is the column, so the WHERE clause
-- had to say which one it meant. `next_doc_no.yr` is the documented way to
-- qualify a plpgsql variable by its function's implicit label -- and inside a
-- WHERE clause the parser reaches for a TABLE of that name first and fails.
--
-- ⚠️ THE SAME FAMILY OF MISTAKE AS 2026-08-25.
--
-- submit_site_enquiry took a parameter named `site_slug` while `projects` has
-- a column named `site_slug`, and threw 42702 on the first real form
-- submission. It was found by filling in the form, not by reading the SQL --
-- and this one was found by running eight concurrent calls, not by reading it
-- either. plpgsql resolves names when it RUNS. A migration that applies
-- cleanly has proven nothing about whether its functions work.
--
-- The repair is the boring one, and the one that cannot come back: give the
-- variable a name no column has. `next_doc_no` is otherwise unchanged from
-- 20260831050000 -- the counter, the seeding and the bounded skip all stand.

create or replace function public.next_doc_no(in_project_id uuid, in_module_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  my_prefix text;
  v_yr text := to_char(public.today_myt(), 'YYYY');
  n bigint;
  seed bigint;
  candidate text;
  like_pattern text;
  attempts integer := 0;
begin
  if not (public.is_pipeline_module(in_module_key) or public.is_ledger_module(in_module_key)) then
    raise exception 'no numbered table for module: %', in_module_key;
  end if;

  select prefix into my_prefix
  from public.project_doc_prefixes
  where project_id = in_project_id and module_key = in_module_key;

  my_prefix := coalesce(my_prefix, public.default_doc_prefix(in_module_key));
  like_pattern := my_prefix || '-' || v_yr || '-%';

  loop
    attempts := attempts + 1;
    if attempts > 50 then
      /* Fifty taken numbers in a row means something is writing doc_no behind
         the counter's back. Failing here is right: the alternative -- issuing
         a duplicate -- is the one thing an accounting number may never be. */
      raise exception 'could not find a free document number for % after % tries', in_module_key, attempts;
    end if;

    /* The fast path, and what makes concurrency safe: a single UPDATE takes a
       row lock, so a second caller waits, re-reads and gets n+1. Measured
       before this existed: 8 simultaneous presses wrote 6 payments. */
    update public.doc_counters
       set last_no = doc_counters.last_no + 1, updated_at = now()
     where doc_counters.project_id = in_project_id
       and doc_counters.module_key = in_module_key
       and doc_counters.yr = v_yr
    returning doc_counters.last_no into n;

    if not found then
      /* First document of this module this year -- or the first since this
         counter existed. Seeded from what has ALREADY been issued, so a
         business with rows from before today continues from where it was
         rather than restarting at 0001 on top of its own receipts. */
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
      values (in_project_id, in_module_key, v_yr, seed)
      on conflict (project_id, module_key, yr) do nothing;

      /* Round again. Whether this call seeded it or lost the race to one that
         did, the UPDATE above is now the single place a number comes from. */
      continue;
    end if;

    candidate := my_prefix || '-' || v_yr || '-' || lpad(n::text, 4, '0');

    /* Taken by something that did not come through here -- an authenticated
       session can still insert a doc_no directly. Skip it and let the counter
       carry past rather than raise in the caller's face. */
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

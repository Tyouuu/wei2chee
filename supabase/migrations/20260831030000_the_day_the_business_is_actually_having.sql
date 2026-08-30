-- supabase/migrations/20260831030000_the_day_the_business_is_actually_having.sql
--
-- Every date this product writes was eight hours wrong for eight hours a day.
--
-- ── HOW IT WAS FOUND ──────────────────────────────────────────────────────
--
-- Not by a test. The founder asked why the ledger was being written from
-- scratch when his own SIM-dealer business (Tyouuu/vibe-dealer) already runs
-- on this, and reading his code answered a question nobody here had asked:
--
--     // Malaysia is a fixed UTC+8 offset (no DST) -- shift the instant before
--     // slicing so "today"/"yesterday" match the Malaysia calendar date even
--     // though the server (Vercel) runs in UTC. Using plain server-local time
--     // here would misreport "yesterday" for anyone viewing between 12am-8am.
--                                                    -- src/lib/month.ts
--
-- He wrote that because it had already bitten him. This codebase then made the
-- identical mistake twice: `current_date` in 20260830040000 and again in
-- 20260831020000, in the column defaults AND inside both RPCs.
--
-- ── WHAT IT ACTUALLY DOES ─────────────────────────────────────────────────
--
-- Supabase runs Postgres in UTC. `current_date` is therefore the UTC calendar
-- day. Between 00:00 and 08:00 Malaysia time -- which is when a contractor
-- keys in yesterday's site work and when a restaurant closes its day -- every
-- one of these lands on the WRONG DATE:
--
--   · a payment's entry_on             -> last month's takings, in the wrong month
--   · a quotation's issued_on          -> a validity window that starts a day early
--   · the YEAR inside a document number-> RC-2025-0001 issued on 1 Jan 2026
--
-- The last one cannot be repaired later without renumbering a business's
-- receipts, which is the one thing an accounting number may never do.
--
-- ── WHY A FUNCTION AND NOT `AT TIME ZONE` IN SIX PLACES ───────────────────
--
-- Six copies of a timezone rule is five chances to fix five of them. This is
-- the same reason next_doc_no branches instead of being duplicated per shape.
--
-- ⚠️ It is Malaysia-specific ON PURPOSE and says so in its comment. Every
-- customer of this product is a Malaysian SME; the day the first one is not,
-- this becomes a column on `projects` and this function reads it. Guessing at
-- that generality now would mean a timezone setting nobody has ever set.

create or replace function public.today_myt()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Kuala_Lumpur')::date;
$$;

comment on function public.today_myt() is
  'The calendar date in Malaysia. Postgres runs in UTC here, so current_date is the previous day between midnight and 8am local -- which is exactly when this market keys in the previous day''s work. Malaysia has no DST, so this is a fixed +8. When a customer outside Malaysia exists, this reads a timezone from `projects` instead.';

alter table public.pipeline_records
  alter column issued_on set default public.today_myt();

alter table public.ledger_entries
  alter column entry_on set default public.today_myt();

-- ── THE YEAR IN A DOCUMENT NUMBER ─────────────────────────────────────────
-- Same fix, and the one with no second chance: a receipt numbered RC-2025-0001
-- on the first of January 2026 stays wrong forever.

create or replace function public.next_doc_no(in_project_id uuid, in_module_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  my_prefix text;
  yr text := to_char(public.today_myt(), 'YYYY');
  used integer;
  like_pattern text;
begin
  select prefix into my_prefix
  from public.project_doc_prefixes
  where project_id = in_project_id and module_key = in_module_key;

  my_prefix := coalesce(my_prefix, public.default_doc_prefix(in_module_key));
  like_pattern := my_prefix || '-' || yr || '-%';

  /* Counted, not sequenced. A cancelled document leaves its number spent,
     which is correct: an accounting number is never reused and a gap is
     evidence rather than a defect. */
  if public.is_pipeline_module(in_module_key) then
    select count(*) into used
    from public.pipeline_records
    where project_id = in_project_id
      and module_key = in_module_key
      and doc_no like like_pattern;
  elsif public.is_ledger_module(in_module_key) then
    select count(*) into used
    from public.ledger_entries
    where project_id = in_project_id
      and module_key = in_module_key
      and doc_no like like_pattern;
  else
    raise exception 'no numbered table for module: %', in_module_key;
  end if;

  return my_prefix || '-' || yr || '-' || lpad((used + 1)::text, 4, '0');
end;
$$;

-- ── AND INSIDE THE TWO WRITERS ────────────────────────────────────────────
-- The coalesce() in each RPC names `current_date` explicitly, so a column
-- default cannot save it. Both are re-declared, unchanged apart from the date.
-- Repairing one and not the other is this repo's most-repeated defect.

create or replace function public.add_pipeline_record(
  in_project_id uuid,
  in_module_key text,
  in_title text default '',
  in_party text default '',
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.pipeline_records;
  first_stage text;
begin
  select exists (
    select 1 from public.projects
    where id = in_project_id and account_id = auth.uid()
  ) into mine;
  if not mine then
    raise exception 'not your project';
  end if;

  if not public.is_pipeline_module(in_module_key) then
    raise exception 'not a pipeline module: %', in_module_key;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.pipeline_records
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  /* A row with no stage starts at the beginning of THIS business's own
     workflow rather than at a word we invented. */
  if in_stage is null or btrim(in_stage) = '' then
    select case when p.system_language = 'en'
                then coalesce(ar.after_workflow_en, ar.after_workflow)
                else ar.after_workflow
           end ->> 0
      into first_stage
      from public.projects p
      join public.accounts a on a.id = p.account_id
      join public.analysis_results ar on ar.lead_id = a.lead_id
     where p.id = in_project_id;
  end if;

  insert into public.pipeline_records (
    project_id, module_key, doc_no, title, party, amount_cents, stage,
    issued_on, due_on, extra, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
    left(coalesce(in_party, ''), 200),
    in_amount_cents,
    left(coalesce(nullif(btrim(coalesce(in_stage, '')), ''), coalesce(first_stage, '')), 60),
    coalesce(in_issued_on, public.today_myt()),
    in_due_on,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.pipeline_records
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

create or replace function public.add_ledger_entry(
  in_project_id uuid,
  in_module_key text,
  in_direction text default null,
  in_amount_cents bigint default 0,
  in_party text default '',
  in_against_id uuid default null,
  in_entry_on date default null,
  in_method text default '',
  in_reference text default '',
  in_receipt_url text default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.ledger_entries;
  dir text;
  allocated bigint := 0;
begin
  select exists (
    select 1 from public.projects
    where id = in_project_id and account_id = auth.uid()
  ) into mine;
  if not mine then
    raise exception 'not your project';
  end if;

  if not public.is_ledger_module(in_module_key) then
    raise exception 'not a ledger module: %', in_module_key;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.ledger_entries
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if coalesce(in_amount_cents, 0) < 0 then
    raise exception 'amount cannot be negative -- use direction instead';
  end if;

  dir := lower(btrim(coalesce(in_direction, '')));
  if dir not in ('in', 'out') then
    dir := case in_module_key when 'payments' then 'in' else 'out' end;
  end if;

  if in_against_id is not null then
    perform 1 from public.pipeline_records
      where id = in_against_id and project_id = in_project_id;
    if not found then
      raise exception 'that document is not in this project';
    end if;
    allocated := coalesce(in_amount_cents, 0);
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, direction, amount_cents,
    allocated_cents, against_id, entry_on, method, reference, receipt_url,
    note, recorded_by, extra, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_party, ''), 200),
    dir,
    coalesce(in_amount_cents, 0),
    allocated,
    in_against_id,
    coalesce(in_entry_on, public.today_myt()),
    left(coalesce(in_method, ''), 40),
    left(coalesce(in_reference, ''), 80),
    in_receipt_url,
    left(coalesce(in_note, ''), 500),
    auth.uid(),
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.ledger_entries
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

create or replace function public.reverse_ledger_entry(
  in_entry_id uuid,
  in_note text default ''
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.ledger_entries;
  row public.ledger_entries;
  already uuid;
begin
  select * into original
  from public.ledger_entries e
  where e.id = in_entry_id
    and exists (
      select 1 from public.projects p
      where p.id = e.project_id and p.account_id = auth.uid()
    );
  if not found then
    raise exception 'no such entry in your project';
  end if;

  if original.adjusts_id is not null then
    raise exception 'that entry is itself a reversal';
  end if;

  select id into already
  from public.ledger_entries where adjusts_id = in_entry_id;
  if already is not null then
    raise exception 'that entry has already been reversed';
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, direction, amount_cents,
    allocated_cents, against_id, adjusts_id, entry_on, method, reference,
    note, recorded_by, extra
  ) values (
    original.project_id,
    original.module_key,
    public.next_doc_no(original.project_id, original.module_key),
    original.party,
    case original.direction when 'in' then 'out' else 'in' end,
    original.amount_cents,
    original.allocated_cents,
    original.against_id,
    original.id,
    public.today_myt(),
    original.method,
    original.reference,
    left(coalesce(nullif(btrim(in_note), ''), '冲正 ' || original.doc_no), 500),
    auth.uid(),
    original.extra
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.today_myt() from public;
grant execute on function public.today_myt() to authenticated;

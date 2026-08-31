-- supabase/migrations/20260831110000_a_purchase_order_is_a_pipeline.sql
--
-- 进货单. The eighteenth module, and it needs no new shape -- which is the
-- whole argument 任务 67 made after measuring six real systems: 「pipeline 做完
-- 之后采购单几乎是白捡的」.
--
-- ── READ FIRST, BUILT SECOND ──────────────────────────────────────────────
--
-- ERPNext's Purchase Order doctype, read from its own JSON rather than from an
-- impression. Its required fields are supplier, company, transaction_date,
-- currency and items; its status list is
--
--     Draft · On Hold · To Receive and Bill · To Bill · To Receive ·
--     Completed · Cancelled · Closed · Delivered
--
-- and the thing worth taking is not that list. It is what generates it: two
-- INDEPENDENT facts, `per_received` and `per_billed`. 「到货了没有」 and 「付了
-- 没有」 are separate questions, and every status above is a position on that
-- pair. A single linear stage list that mixes them is how a system ends up
-- unable to say 「货到了，钱还没付」 -- which is the only state a purchase order
-- spends most of its life in.
--
-- So the default stages are that pair, in the business's own words, and the
-- money half is answered by the ledger it already has: an expense written
-- against this document.
--
-- ── WHAT IS DELIBERATELY NOT COPIED ───────────────────────────────────────
--
-- ERPNext's `items` child table. A purchase order here is ONE ROW with a
-- total, not an itemised order with quantities and unit prices. That is a real
-- limitation and it is stated rather than hidden:
--
--   · line items need a table of their own, which is a new SHAPE, and 任务 41
--     says a shape is earned by seeing the same need twice rather than by
--     anticipating it
--   · the businesses this is for -- a contractor buying cement, a shop
--     restocking -- get an invoice from the supplier that already itemises it.
--     The photograph of that invoice belongs on the row (`receipt_url` on the
--     expense), not retyped into it
--
-- When a second module needs line items, they arrive together.
--
-- ── THE PARTY IS A SUPPLIER, NOT A CUSTOMER ───────────────────────────────
--
-- party_by_name() searched every directory entry of the project, so a purchase
-- order naming 陈先生 would have linked to the CUSTOMER 陈先生 -- the same
-- person can legitimately be both, and the money would have been filed against
-- the wrong side of the business. It takes the directory module now, and each
-- pipeline module says which side it buys or sells on.

create or replace function public.is_pipeline_module(key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select key in ('quotations', 'orders', 'projects', 'tasks', 'purchases');
$$;

create or replace function public.default_doc_prefix(key text)
returns text
language sql
immutable
as $$
  select case key
    when 'quotations' then 'QT'
    when 'orders' then 'SO'
    when 'projects' then 'PJ'
    when 'tasks' then 'TK'
    /* PO, the abbreviation every supplier in this market already reads on a
       fax. 「PU」 would be ours; this one is theirs. */
    when 'purchases' then 'PO'
    when 'payments' then 'RC'
    when 'expenses' then 'EX'
    when 'commission' then 'CM'
    else 'DOC'
  end;
$$;

-- ── WHICH SIDE OF THE BUSINESS A MODULE DEALS WITH ────────────────────────
--
-- One place, so the answer cannot differ between the resolver and the writer.

create or replace function public.directory_side(module_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when module_key = 'purchases' then 'suppliers' else 'customers' end;
$$;

comment on function public.directory_side(text) is
  'Which directory a pipeline module''s counterparty lives in. 进货单 buys from suppliers; everything else sells to customers. The same person may be both, which is why this is asked rather than assumed.';

-- ── RESOLVING A NAME, ON THE RIGHT SIDE ───────────────────────────────────

drop function if exists public.party_by_name(uuid, text);

create function public.party_by_name(
  in_project_id uuid,
  in_name text,
  in_module_key text default 'customers'
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with hits as (
    select d.id
      from public.directory_entries d
     where d.project_id = in_project_id
       and d.archived_at is null
       and d.module_key = in_module_key
       and lower(btrim(d.name)) = lower(btrim(coalesce(in_name, '')))
     limit 2
  )
  select id from hits where (select count(*) from hits) = 1;
$$;

comment on function public.party_by_name(uuid, text, text) is
  'One party of this project, on the named side of the book, with exactly this name -- or null. Refuses to choose between two people who share a name, and refuses to cross sides: a purchase order naming 陈先生 must not attach to the customer 陈先生.';

revoke execute on function public.party_by_name(uuid, text, text) from public;
grant execute on function public.party_by_name(uuid, text, text) to authenticated;

-- ── THE WRITERS LEARN WHICH SIDE THEY ARE ON ──────────────────────────────
--
-- Re-declared in full. plpgsql resolves names when it RUNS, so a body patched
-- around a changed signature pushes successfully and fails in front of a
-- customer; and the unique_violation tail is transcribed with them, because
-- 090000 exists because it once was not.

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
  in_idempotency_key uuid default null,
  in_party_id uuid default null
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
  the_party uuid;
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

  if in_party_id is not null then
    /* Checked against the side this module deals with, not merely against the
       project: an id typed into the wrong form is the same mistake as a name
       resolved on the wrong side. */
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = in_project_id
        and module_key = public.directory_side(in_module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  else
    the_party := public.party_by_name(
      in_project_id, in_party, public.directory_side(in_module_key)
    );
  end if;

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
    project_id, module_key, doc_no, title, party, party_id, amount_cents, stage,
    issued_on, due_on, extra, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
    left(coalesce(in_party, ''), 200),
    the_party,
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

revoke execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid) from public;
grant execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid) to authenticated;

-- update_pipeline_record resolves the name too, and would otherwise cross
-- sides the moment somebody corrected a supplier's spelling.

create or replace function public.update_pipeline_record(
  in_id uuid,
  in_title text default null,
  in_party text default null,
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default null,
  in_party_id uuid default null,
  in_clear_party boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.pipeline_records;
  the_party uuid;
begin
  select * into row from public.pipeline_records r
   where r.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = r.project_id and p.account_id = auth.uid()
     );
  if not found then
    raise exception 'no such record in your project';
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = row.project_id
        and module_key = public.directory_side(row.module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  elsif in_clear_party then
    the_party := null;
  elsif in_party is not null and btrim(in_party) is distinct from btrim(row.party) then
    the_party := public.party_by_name(
      row.project_id, in_party, public.directory_side(row.module_key)
    );
  else
    the_party := row.party_id;
  end if;

  update public.pipeline_records set
    title = coalesce(left(btrim(in_title), 200), title),
    party = coalesce(left(btrim(in_party), 200), party),
    party_id = the_party,
    amount_cents = coalesce(in_amount_cents, amount_cents),
    stage = coalesce(left(btrim(in_stage), 60), stage),
    issued_on = coalesce(in_issued_on, issued_on),
    due_on = coalesce(in_due_on, due_on),
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean) from public;
grant execute on function public.update_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean) to authenticated;

-- And the ledger's own resolver, which had the same single-sided assumption:
-- an expense paid to 建材行 belongs to the SUPPLIER of that name.

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
  in_idempotency_key uuid default null,
  in_party_id uuid default null
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
  the_party uuid;
  side text;
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

  /* Money in comes from a customer; money out goes to a supplier. Reading the
     direction rather than the module is what lets 开销 paid to a supplier and
     a refund paid to a customer both land on the right person. */
  side := case when dir = 'in' then 'customers' else 'suppliers' end;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id and project_id = in_project_id;
    if not found then
      raise exception 'that party is not in this project';
    end if;
    the_party := in_party_id;
  else
    if in_against_id is not null then
      select party_id into the_party from public.pipeline_records where id = in_against_id;
    end if;
    the_party := coalesce(
      the_party,
      public.party_by_name(in_project_id, in_party, side),
      /* And if that side has nobody by this name, the other one -- a business
         with only a customer list must still be able to file an expense
         against the person it typed. Tried second, never first: crossing sides
         is a fallback, not a default. */
      public.party_by_name(
        in_project_id, in_party,
        case when side = 'customers' then 'suppliers' else 'customers' end
      )
    );
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, party_id, direction, amount_cents,
    allocated_cents, against_id, entry_on, method, reference, receipt_url,
    note, recorded_by, extra, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_party, ''), 200),
    the_party,
    dir,
    coalesce(in_amount_cents, 0),
    allocated,
    in_against_id,
    coalesce(in_entry_on, public.today_myt()),
    left(coalesce(in_method, ''), 60),
    left(coalesce(in_reference, ''), 120),
    in_receipt_url,
    left(coalesce(in_note, ''), 2000),
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

revoke execute on function public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid) from public;
grant execute on function public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid) to authenticated;

-- ── AND THE PAGE ITSELF HAS TO BE ALLOWED TO EXIST ────────────────────────
--
-- `project_pages.page_key` is a closed list, on purpose: a page whose key
-- nothing can build is a blank canvas for a paying customer. So a new module
-- is not a new module until this constraint says so -- and the failure mode
-- without it is the worst kind, because everything else would work: the
-- catalogue would offer 进货单, the AI would pick it, and the insert would be
-- refused at the last step with a constraint name for an error message.

alter table public.project_pages
  drop constraint if exists project_pages_page_key_check;

alter table public.project_pages
  add constraint project_pages_page_key_check
  check (
    page_key in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff',
      'inventory', 'purchases',
      'website'
    )
    or page_key ~ '^custom_[a-z0-9]{8,32}$'
  );
create or replace function public.add_project_page(
  requested_key text,
  new_title text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_key text;
  v_title text;
  v_count int;
  v_next int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_project_id
  from public.projects
  where account_id = auth.uid();

  if v_project_id is null then
    raise exception 'no project for this account';
  end if;

  select count(*) into v_count from public.project_pages where project_id = v_project_id;
  if v_count >= 12 then
    raise exception 'page limit reached';
  end if;

  v_title := nullif(btrim(coalesce(new_title, '')), '');
  v_title := left(v_title, 24);

  if requested_key is null or requested_key = '' then
    if v_title is null then
      raise exception 'a custom page needs a title';
    end if;
    v_key := 'custom_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  else
    if requested_key not in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory',
      'website'
    ) then
      raise exception 'unknown page type: %', requested_key;
    end if;
    v_key := requested_key;
    if exists (
      select 1 from public.project_pages
      where project_id = v_project_id and page_key = v_key
    ) then
      return v_key;
    end if;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next
  from public.project_pages
  where project_id = v_project_id;

  insert into public.project_pages (project_id, page_key, title, sort_order)
  values (v_project_id, v_key, v_title, v_next);

  return v_key;
end;
$$;

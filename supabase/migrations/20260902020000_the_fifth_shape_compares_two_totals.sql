-- supabase/migrations/20260902020000_the_fifth_shape_compares_two_totals.sql
--
-- 对账 stops being a drawing. It is the last shape the founder's own first
-- business needs: vibe-dealer's four tables map onto directory (dealers),
-- ledger (transactions), catalog (sim_stock) and this one
-- (company_statements). Three of the four have been real since 2026-08-31.
--
-- ---------------------------------------------------------------------------
-- What was read first
-- ---------------------------------------------------------------------------
-- ERPNext's `Bank Transaction` doctype, straight out of the repository rather
-- than off a marketing page. Its shape is one row per line of the outside
-- statement, carrying `deposit` / `withdrawal` as two columns rather than a
-- signed number, plus `allocated_amount` and `unallocated_amount` -- the
-- difference living on the line itself. That is the same idea `ledger_entries`
-- already uses for a deposit (amount_cents - allocated_cents), and it is worth
-- saying so: this repository arrived at that shape independently and the
-- biggest open ERP agrees with it.
--
-- ⚠️ WHAT COULD NOT BE READ. `Tyouuu/vibe-dealer` is private and returns 404 to
-- this machine, so `company_statements` is known only from what 任务 74 and 77
-- recorded about it: 「公司只给 total + 盈利，不给明细，差异要标出来」. If that
-- turns out to carry a column this table does not, it is a migration and not a
-- rewrite -- which is the whole reason `extra` exists.
--
-- ---------------------------------------------------------------------------
-- What is copied, and what is deliberately not
-- ---------------------------------------------------------------------------
-- COPIED: one row per outside figure; the difference as something DERIVED
-- rather than stored; a free-text reference; never deleting a row.
--
-- NOT COPIED -- line-by-line bank import. ERPNext has Bank Statement Import
-- with CSV templates, delimiters, a CSV sniffer and MT940. Malaysian SME banks
-- do not give a small business an API, and the businesses this product serves
-- do not reconcile line by line: the upstream hands them a TOTAL. The module's
-- own blurb has said so since it was written -- 「拿上游/银行/平台出的总数，对
-- 系统里的逐笔总额」 -- and building an importer for a file nobody has would be
-- the second time this repository shipped a capability with no wire.
--
-- NOT COPIED -- a document number. A reconciliation is identified by the month
-- and the source; 「2026-08 · Celcom」 IS the name of it, and a second identity
-- issued from the counter table would be a number nobody would ever say out
-- loud. 20260831070000 made the same call for a person. Asserted, not assumed:
-- next_doc_no() must still refuse this module.
--
-- ---------------------------------------------------------------------------
-- The one decision this table turns on
-- ---------------------------------------------------------------------------
-- ONLY WHAT THE OUTSIDE SAID IS STORED. Our own total is not a column; it is
-- summed from ledger_entries when the page is read.
--
-- Storing it would create a second truth that goes stale the moment a
-- correcting entry is written -- and a reconciliation whose "our figure" is out
-- of date is worse than no reconciliation, because it reports agreement that
-- no longer exists. It is the same rule as 「how much is left is the sum of the
-- movements」 (20260901070000) and 「with line items the total is not his to
-- type」 (20260831150000), and both of those were arrived at the hard way.
create table if not exists public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* Which of this business's pages. 对账 today; a business reconciling two
     upstreams on two pages costs nothing. */
  module_key text not null,

  /* A bare uuid and no foreign key, exactly as the other four shapes do. There
     is no `branches` table: 地基决定 2 put the post in without building the
     feature, because a column added later has to be backfilled across every
     historical row and a null column costs nothing. */
  branch_id uuid,

  /* THE MONTH, stored as its first day. A date rather than a 「2026-08」 string
     so it sorts, so it can be compared, and so the same today_myt() reasoning
     applies -- the server runs UTC and the owner is UTC+8, and a month
     boundary is eight hours wrong twice a year in exactly the wrong direction.
     Normalised by the writer, never by the caller. */
  period date not null,

  /* WHO GAVE THE FIGURE. Celcom, Maybank, Grab, the supplier. Free text and
     never an enum: the same call as `stage` and `unit`, and here it is also
     the word the owner will read on his own page. */
  source text not null,

  /* WHAT THEIR FIGURE IS ABOUT, and this is the column that stops the number
     being meaningless.

     A telco's statement is money IN -- the total the dealer topped up. A
     supplier's is money OUT. A bank's is the NET movement. Comparing a telco
     total against a net figure would silently subtract the owner's own
     expenses from it and report a difference that is not one. One column,
     three values, and the page says which. */
  direction text not null default 'in'
    check (direction in ('in', 'out', 'net')),

  /* Sen, like every other money column here. Signed is allowed: a bank's net
     movement for a bad month really is negative, and forcing it positive would
     make the owner type a lie to get it in. */
  their_cents bigint not null,

  /* Their reference for it -- a statement number, an email subject. */
  reference text not null default '',

  note text not null default '',
  extra jsonb not null default '{}'::jsonb,

  /* HE HAS LOOKED AT IT AND IS SATISFIED. Not 「it matches」 -- a difference he
     has explained in the note is also settled, and most months in this market
     end that way rather than at zero. Null means still open. */
  settled_at timestamptz,

  /* Never deleted, like the other four. Last year's reconciliation is the
     answer to 「why is August short by 300」. */
  archived_at timestamptz,

  recorded_by uuid references auth.users(id) on delete set null,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reconciliations is
  'One outside figure, for one month, from one source. THERE IS DELIBERATELY NO COLUMN FOR OUR OWN TOTAL -- it is summed from ledger_entries by the reconciliation_lines view. See the header of 20260902020000.';
comment on column public.reconciliations.direction is
  'What their figure measures: in (a telco total), out (a supplier statement) or net (a bank movement). Comparing the wrong one silently subtracts the owner''s expenses from a supplier''s total.';
comment on column public.reconciliations.settled_at is
  'He has looked and is satisfied -- which includes a difference he explained in the note. Not the same as the difference being zero.';

create index if not exists reconciliations_month_idx
  on public.reconciliations (project_id, module_key, period desc)
  where archived_at is null;

/* ONE FIGURE PER SOURCE PER MONTH. Two rows for 2026-08 · Celcom are not two
   reconciliations, they are the same one entered twice -- and which of them the
   page believes would be arbitrary. Partial, so an archived month does not
   block re-entering it. */
create unique index if not exists reconciliations_one_per_month_idx
  on public.reconciliations (project_id, module_key, period, lower(source))
  where archived_at is null;

/* The same guard the other four carry: a double-tap on a phone is one figure,
   not two. Partial because most writes pass no key. */
create unique index if not exists reconciliations_idempotency_idx
  on public.reconciliations (project_id, idempotency_key)
  where idempotency_key is not null;

alter table public.reconciliations enable row level security;

create policy "reconciliations_members" on public.reconciliations
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── WHICH PAGES ARE THIS SHAPE ────────────────────────────────────────────

create or replace function public.is_reconcile_module(key text)
returns boolean
language sql
immutable
as $$
  select key in ('reconciliation');
$$;

comment on function public.is_reconcile_module(text) is
  'Kept beside is_pipeline_module / is_ledger_module / is_directory_module / is_catalog_module, and kept in step with lib/portal/module-catalog.ts by module-catalog.test.ts.';

-- ── THE COMPARISON ────────────────────────────────────────────────────────
--
-- ⚠️ `security_invoker = true`, WITHOUT WHICH THIS LEAKS. A view executes with
-- the privileges of its OWNER unless this is set, and migrations run as
-- `postgres` -- so it would read straight past row-level security on both
-- tables underneath and hand one business another business's figures. That is
-- not a hypothetical: stock_on_hand shipped exactly that way on 2026-09-01, in
-- a file whose own comment asserted the opposite, and it was caught only
-- because every RPC is called for real by a second customer before it counts
-- as done. views_without_invoker() has watched for it since.
create or replace view public.reconciliation_lines
with (security_invoker = true)
as
  select
    r.id,
    r.project_id,
    r.module_key,
    r.period,
    r.source,
    r.direction,
    r.their_cents,
    r.reference,
    r.note,
    r.settled_at,
    r.archived_at,
    r.created_at,
    /* OUR SIDE, SUMMED RATHER THAN STORED. Every ledger entry of this project
       whose date falls in the month, taking the side their figure is about.
       Reversals are included and that is correct arithmetic: an entry and its
       reversal net to zero, which is what the books actually say. */
    coalesce((
      select
        case r.direction
          when 'in' then
            coalesce(sum(e.amount_cents) filter (where e.direction = 'in'), 0)
          when 'out' then
            coalesce(sum(e.amount_cents) filter (where e.direction = 'out'), 0)
          else
            coalesce(sum(e.amount_cents) filter (where e.direction = 'in'), 0)
            - coalesce(sum(e.amount_cents) filter (where e.direction = 'out'), 0)
        end
      from public.ledger_entries e
      where e.project_id = r.project_id
        and e.entry_on >= r.period
        and e.entry_on < (r.period + interval '1 month')
    ), 0) as ours_cents,
    (
      select count(*)
      from public.ledger_entries e
      where e.project_id = r.project_id
        and e.entry_on >= r.period
        and e.entry_on < (r.period + interval '1 month')
    ) as entries
  from public.reconciliations r;

comment on view public.reconciliation_lines is
  'Their figure beside ours. `ours_cents` is summed from ledger_entries every time this is read; nothing caches it, because a cached agreement that has stopped being true is worse than no reconciliation at all.';

grant select on public.reconciliation_lines to authenticated;

-- ── WRITING ONE ───────────────────────────────────────────────────────────

create or replace function public.add_reconciliation(
  in_project_id uuid,
  in_module_key text,
  in_period date,
  in_source text,
  in_their_cents bigint,
  in_direction text default 'in',
  in_reference text default '',
  in_note text default '',
  in_branch_id uuid default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  first_of date;
  clean_source text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_reconcile_module(in_module_key) then
    raise exception 'not a reconcile module: %', in_module_key;
  end if;

  clean_source := btrim(coalesce(in_source, ''));
  if clean_source = '' then
    raise exception 'a reconciliation needs to say who gave the figure';
  end if;

  /* NORMALISED HERE, NOT AT THE CALLER. Two callers rounding a month to its
     first day two different ways is two months, and the unique index would let
     both in. today_myt() rather than current_date for the default, for the
     eight hours 20260831030000 exists over. */
  first_of := date_trunc('month', coalesce(in_period, public.today_myt()))::date;

  insert into public.reconciliations (
    project_id, module_key, branch_id, period, source, direction,
    their_cents, reference, note, extra, recorded_by, idempotency_key
  ) values (
    in_project_id, in_module_key, in_branch_id, first_of, clean_source,
    coalesce(nullif(btrim(coalesce(in_direction, '')), ''), 'in'),
    coalesce(in_their_cents, 0),
    left(btrim(coalesce(in_reference, '')), 120),
    btrim(coalesce(in_note, '')),
    coalesce(in_extra, '{}'::jsonb),
    auth.uid(), in_idempotency_key
  )
  returning id into new_id;

  return new_id;

exception
  /* THE TAIL THAT 20260831080000 DROPPED WHEN IT REWROTE A FUNCTION AND HAD TO
     BE PUT BACK BY 20260831090000. Pressing twice, or entering a month that is
     already there, gives back the row that exists rather than an error the
     owner cannot act on. */
  when unique_violation then
    select id into new_id
    from public.reconciliations
    where project_id = in_project_id
      and (
        (in_idempotency_key is not null and idempotency_key = in_idempotency_key)
        or (module_key = in_module_key
            and period = first_of
            and lower(source) = lower(clean_source)
            and archived_at is null)
      )
    order by created_at
    limit 1;
    return new_id;
end;
$$;

revoke execute on function public.add_reconciliation(
  uuid, text, date, text, bigint, text, text, text, uuid, jsonb, uuid
) from public;
grant execute on function public.add_reconciliation(
  uuid, text, date, text, bigint, text, text, text, uuid, jsonb, uuid
) to authenticated;

create or replace function public.update_reconciliation(
  in_id uuid,
  in_period date,
  in_source text,
  in_their_cents bigint,
  in_direction text default 'in',
  in_reference text default '',
  in_note text default '',
  in_extra jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
  first_of date;
  clean_source text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select project_id into proj from public.reconciliations where id = in_id;
  if proj is null then
    raise exception 'no such reconciliation';
  end if;
  if not public.works_here(proj) then
    raise exception 'not your project';
  end if;

  clean_source := btrim(coalesce(in_source, ''));
  if clean_source = '' then
    raise exception 'a reconciliation needs to say who gave the figure';
  end if;

  first_of := date_trunc('month', coalesce(in_period, public.today_myt()))::date;

  update public.reconciliations
  set period = first_of,
      source = clean_source,
      direction = coalesce(nullif(btrim(coalesce(in_direction, '')), ''), 'in'),
      their_cents = coalesce(in_their_cents, 0),
      reference = left(btrim(coalesce(in_reference, '')), 120),
      note = btrim(coalesce(in_note, '')),
      extra = coalesce(in_extra, '{}'::jsonb),
      updated_at = now()
  where id = in_id;
end;
$$;

revoke execute on function public.update_reconciliation(
  uuid, date, text, bigint, text, text, text, jsonb
) from public;
grant execute on function public.update_reconciliation(
  uuid, date, text, bigint, text, text, text, jsonb
) to authenticated;

-- ── SETTLED, AND PUT AWAY ─────────────────────────────────────────────────
--
-- Two different words on purpose. 结了 is the owner saying he has looked and is
-- satisfied, including at a difference he has explained; 收起来 is the row
-- leaving the list. Collapsing them would mean a month he explained disappears
-- from the page that exists to show him the months.
create or replace function public.set_reconciliation_settled(
  in_id uuid,
  in_settled boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  select project_id into proj from public.reconciliations where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your reconciliation';
  end if;

  update public.reconciliations
  set settled_at = case when in_settled then now() else null end,
      updated_at = now()
  where id = in_id;
end;
$$;

revoke execute on function public.set_reconciliation_settled(uuid, boolean) from public;
grant execute on function public.set_reconciliation_settled(uuid, boolean) to authenticated;

create or replace function public.set_reconciliation_archived(
  in_id uuid,
  in_archived boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  select project_id into proj from public.reconciliations where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your reconciliation';
  end if;

  update public.reconciliations
  set archived_at = case when in_archived then now() else null end,
      updated_at = now()
  where id = in_id;
end;
$$;

revoke execute on function public.set_reconciliation_archived(uuid, boolean) from public;
grant execute on function public.set_reconciliation_archived(uuid, boolean) to authenticated;

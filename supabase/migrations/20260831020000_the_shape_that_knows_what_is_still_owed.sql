-- supabase/migrations/20260831020000_the_shape_that_knows_what_is_still_owed.sql
--
-- The second shape that holds a customer's own business: `ledger`.
-- 收款 · 开销 · 佣金 -- three modules, one table, same rule as pipeline.
--
-- ── WHAT MAKES A LEDGER DIFFERENT FROM A PIPELINE ─────────────────────────
--
-- A pipeline asks 「走到哪了」. A ledger asks 「收了多少、还差多少」.
--
-- That difference is one column: `allocated_cents`. Money arrives before the
-- paperwork that explains it -- a contractor takes RM 10,000 deposit for a job
-- that has no quotation yet, a salon sells a 10-visit package on Monday and
-- spends it over four months. The part of a payment that has not yet been
-- applied to a document is not an error, it is THE DEPOSIT, and it is what an
-- owner actually needs to see.
--
--     amount_cents - allocated_cents  =  未分摊  =  订金 / 预付余额 / 套票余额
--
-- ⚠️ That one column closes three separate things this repo recorded on three
-- separate days, each time as if it were new:
--   · 任务 61  「未分摊金额 = 订金。先收一笔、之后一张一张扣」
--   · 任务 67  「套票 / 预付余额 -- Tunai 头条, Aoikumo 每一档, 我们没有」
--   · 任务 44  沙龙那一单签之前要问清楚的第一件事
-- They were one column the whole time.
--
-- ── THE SPEC IS A REAL BUSINESS, NOT A GUESS ──────────────────────────────
--
-- The founder's own SIM-dealer business (Tyouuu/vibe-dealer, 31 migrations,
-- real money) has been running on a `transactions` table for months. Its
-- columns are not a design, they are a scar record. Taken from it:
--
--   receipt_url      a payment nobody can produce evidence for is a claim
--   adjusts_id       money is never edited or deleted -- you write a reversal
--   recorded_by      who entered it
--   idempotency_key  he had already been bitten; so had we (20260831010000)
--
-- ── ONE THING FROM IT THAT DELIBERATELY DOES NOT PORT ─────────────────────
--
-- `commission_rm numeric generated always as (round(points * 0.02, 2))`.
--
-- It is the right idea -- the database computes the money, so no two callers
-- can disagree about it. But 0.02 is ONE business's rate baked into a column
-- definition, which is exactly the `if (client === X)` that 任务 41 forbids:
-- it cannot be one table serving many businesses. The rate belongs to the
-- counterparty, and the counterparty is `directory`, which is the next shape.
-- Until then commission is an ordinary entry with direction 'out'.
--
-- ── WHY `verified_by` IS NOT HERE AND `branch_id` IS ──────────────────────
--
-- Both are unbuilt features. The difference is what it costs to add them late:
--   · branch_id    retrofitting means DECIDING which branch each old row was
--                  for, and nobody can answer that afterwards. So it is a
--                  column now, null for every row, as approved on 2026-08-30.
--   · verified_by  retrofits as null = 「还没人复核」, which is both true and
--                  free. Adding it now, with no second person who could
--                  possibly verify anything, would be decoration -- and an
--                  unused column is this repo's most-repeated defect. It lands
--                  with staff accounts (地基决定 3).

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 'payments' | 'expenses' | 'commission'. Constrained below against the
     TypeScript catalogue, same as pipeline. */
  module_key text not null,

  /* RC-2026-0042. Assigned by next_doc_no(), never by the client. */
  doc_no text not null,

  /* Who the money is with. Free text until `directory` lands, and it stays
     text afterwards: renaming a customer must not rewrite last year's receipt.
     Same decision, same reason, as pipeline_records.party. */
  party text not null default '',

  /* ── THE AXIS OF THIS SHAPE ──────────────────────────────────────────────
     'in'  money arrived   (收款)
     'out' money left      (开销 · 佣金付出去)

     Direction rather than a signed amount, because a negative number is how
     people make mistakes -- a mistyped minus becomes an income, silently, and
     the month still adds up to something. A positive amount plus a direction
     cannot be got wrong by accident, and it sums with a CASE.

     It is per ROW and not per module on purpose: commission is money out when
     you pay your staff and money in when a principal pays you. Both kinds of
     business exist in this market. */
  direction text not null check (direction in ('in', 'out')),

  /* Sen. Always positive -- the sign is `direction`. */
  amount_cents bigint not null check (amount_cents >= 0),

  /* How much of it has been applied to a document. The remainder is the
     deposit / prepaid balance -- see the header. */
  allocated_cents bigint not null default 0 check (allocated_cents >= 0),

  /* The document this money is against, when there is one. Null is the normal
     state for a deposit: the money exists before the paperwork does.

     `on delete set null` and not cascade: deleting a quotation must never
     delete the money that came in for it. The payment happened. */
  against_id uuid references public.pipeline_records(id) on delete set null,

  /* ── CORRECTIONS ARE ENTRIES, NOT EDITS ──────────────────────────────────
     Points at the entry this one reverses. Taken from vibe-dealer's
     `adjusts_id`, which is the correct instinct for money and the one thing no
     amount of UPDATE permission can substitute for: a corrected figure with no
     trace of the correction is indistinguishable from a lie. */
  adjusts_id uuid references public.ledger_entries(id) on delete restrict,

  entry_on date not null default current_date,

  /* 现金 · 转账 · FPX · 支票 · 卡. Free text, like `stage`: the customer's own
     vocabulary is the product. Constraining it would force every business in
     Malaysia through one list. */
  method text not null default '',

  /* Bank reference, cheque number, the last four of a card. */
  reference text not null default '',

  /* The photo of the receipt or bank slip. A payment nobody can produce
     evidence for is a claim, and this market runs on bank-transfer screenshots
     sent over WhatsApp. */
  receipt_url text,

  note text not null default '',

  /* Who entered it. Wired today, because the owner is the only account there
     is; it becomes meaningful, not different, when staff accounts land. */
  recorded_by uuid references auth.users(id) on delete set null,

  /* This business's own fields. Never used for arithmetic the system does. */
  extra jsonb not null default '{}'::jsonb,

  /* A column, not a feature -- see the header. */
  branch_id uuid,

  /* Pressing 「收了」 twice is one payment. */
  idempotency_key uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ledger_entries_doc_no_unique unique (project_id, module_key, doc_no),

  /* You cannot apply more of a payment than the payment contains. This is the
     invariant that makes 未分摊 a number rather than an opinion. */
  constraint ledger_entries_allocation_fits check (allocated_cents <= amount_cents)
);

comment on table public.ledger_entries is
  'Rows for every module of shape `ledger` -- 收款 · 开销 · 佣金. One table per shape; see the header of 20260831020000.';
comment on column public.ledger_entries.allocated_cents is
  'How much of this entry has been applied to a document. amount_cents - allocated_cents is the deposit / prepaid balance -- the number tasks 61, 67 and 44 each asked for separately.';
comment on column public.ledger_entries.direction is
  '''in'' or ''out''. Direction rather than a negative amount: a mistyped minus sign would otherwise become income and still add up.';
comment on column public.ledger_entries.adjusts_id is
  'The entry this one reverses. Money is corrected by writing an opposite entry, never by editing -- a corrected figure with no trace of the correction cannot be told apart from a lie.';
comment on column public.ledger_entries.branch_id is
  'Deliberately unused, same as pipeline_records.branch_id. Null for every row until branch management exists.';

-- One module's entries, newest first -- the question this table is asked.
create index if not exists ledger_entries_page_idx
  on public.ledger_entries (project_id, module_key, entry_on desc, created_at desc);

-- 「这个客户还有多少订金没用完」 -- the deposit question, answered without a scan.
create index if not exists ledger_entries_unallocated_idx
  on public.ledger_entries (project_id, party)
  where allocated_cents < amount_cents;

create unique index if not exists ledger_entries_idempotency_idx
  on public.ledger_entries (project_id, idempotency_key)
  where idempotency_key is not null;

-- ── WHO CAN SEE IT ────────────────────────────────────────────────────────
-- Row level, identical to pipeline_records: the rule lives in the database so
-- an application mistake cannot leak one business's money to another, and a
-- bought-out copy (task 64) carries its own protection.

alter table public.ledger_entries enable row level security;

create policy "ledger_entries_select_own" on public.ledger_entries
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = ledger_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "ledger_entries_insert_own" on public.ledger_entries
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = ledger_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "ledger_entries_update_own" on public.ledger_entries
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = ledger_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "ledger_entries_delete_own" on public.ledger_entries
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = ledger_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

-- ── THE MODULE KEY HAS TO BE ONE WE BUILD ─────────────────────────────────

create or replace function public.is_ledger_module(key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select key in ('payments', 'expenses', 'commission');
$$;

comment on function public.is_ledger_module(text) is
  'The modules of shape `ledger`. Mirrors MODULE_CATALOG in lib/portal/module-catalog.ts; module-catalog.test.ts fails if the two drift.';

alter table public.ledger_entries
  add constraint ledger_entries_module_is_ledger
  check (public.is_ledger_module(module_key));

-- ── DOCUMENT NUMBERS, FOR BOTH SHAPES ─────────────────────────────────────
--
-- next_doc_no() counted `pipeline_records` by name. A second shape needing
-- numbers is exactly the moment that becomes wrong, and the wrong repair is a
-- second copy of the same function -- this repo has been bitten four times by
-- a hand-written list outliving the thing it described.
--
-- So it branches on the shape, in one place, and a module belonging to neither
-- raises instead of silently returning DOC-2026-0001.

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
    when 'payments' then 'RC'
    when 'expenses' then 'EX'
    when 'commission' then 'CM'
    else 'DOC'
  end;
$$;

create or replace function public.next_doc_no(in_project_id uuid, in_module_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  my_prefix text;
  yr text := to_char(now(), 'YYYY');
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
    /* Loudly. A module with no table behind it must not be handed a number
       that looks real -- that is how a shape gets half-wired. */
    raise exception 'no numbered table for module: %', in_module_key;
  end if;

  return my_prefix || '-' || yr || '-' || lpad((used + 1)::text, 4, '0');
end;
$$;

comment on function public.next_doc_no(uuid, text) is
  'The next document number for one project, module and year: QT-2026-0042 or RC-2026-0007. Branches on the module''s shape; raises for a module with no numbered table rather than inventing DOC-.';

-- ── WRITING AN ENTRY ──────────────────────────────────────────────────────
--
-- The same RPC a person's button calls, and therefore the only way the
-- assistant may write one too -- 「AI 平权」, 重点 23. Permissions, numbering,
-- idempotency and allocation are applied once because there is one of them.

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

  /* The module's usual direction when the caller did not say. 收款 is money
     in; 开销 is money out; 佣金 is paid out far more often than received, and
     a caller who means otherwise says so. A default is not a constraint. */
  dir := lower(btrim(coalesce(in_direction, '')));
  if dir not in ('in', 'out') then
    dir := case in_module_key when 'payments' then 'in' else 'out' end;
  end if;

  /* An entry written against a document is applied to it in full; an entry
     with no document is a deposit sitting on the counterparty until something
     is written to spend it against. That IS the deposit -- see the header. */
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
    coalesce(in_entry_on, current_date),
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
    /* Two calls carrying the same key raced, or two entries raced for the same
       document number. The first is the caller's own retry and gets the row
       that won; the second is a genuine collision and must surface. */
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

-- ── CORRECTING ONE ────────────────────────────────────────────────────────
--
-- Not an UPDATE. A reversal is a second entry, opposite in direction and equal
-- in amount, pointing at the one it cancels -- so the month still adds up, the
-- original stays readable, and the correction is visible as a correction.
--
-- This ships WITH the column rather than after it, because a money table whose
-- only means of correction is UPDATE teaches its first users the wrong habit,
-- and habits are what a ledger is made of.

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
    current_date,
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

revoke execute on function public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid) from public;
grant execute on function public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid) to authenticated;

revoke execute on function public.reverse_ledger_entry(uuid, text) from public;
grant execute on function public.reverse_ledger_entry(uuid, text) to authenticated;

create or replace function public.ledger_entries_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ledger_entries_touch_updated on public.ledger_entries;
create trigger ledger_entries_touch_updated
  before update on public.ledger_entries
  for each row execute function public.ledger_entries_touch();

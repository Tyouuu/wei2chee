-- supabase/migrations/20260831070000_the_third_shape_is_a_noun.sql
--
-- The third shape that holds a customer's own business: `directory`.
-- 客户 · 供应商 · 员工 -- three modules, one table.
--
-- The console picked this one, not a person: with pipeline and ledger live it
-- reported 「directory · 6 客户在用 · 还是画的」 -- the most-wanted of every
-- shape that had no table behind it.
--
-- ── WHAT MAKES A DIRECTORY DIFFERENT FROM THE FIRST TWO ───────────────────
--
-- pipeline asks 「走到哪了」. ledger asks 「收了多少、还差多少」.
-- A directory asks nothing. It is a NOUN -- the thing the other two point at.
--
-- Three consequences, and each one is a column the other two have that this
-- one does not:
--
--   no doc_no      A document number is for a document: it gets printed, it is
--                  referenced, and it is never reused. A customer is not a
--                  document. Measured rather than assumed -- vibe-dealer's
--                  `dealers` has no code column at all, atomic-crm's
--                  `companies` has none, and ERPNext's Customer does have
--                  `naming_series` but sets `title_field: customer_name`, so
--                  even there nobody sees it. Two of three do not have one and
--                  the third hides it. It also costs nothing to add later,
--                  which a pipeline number did not: gaps and ordering would
--                  have been wrong forever.
--
--   no amount      Every amount a directory page shows -- 未付 · 本月业绩 ·
--                  累计 -- is a SUM OF OTHER ROWS, not a fact about the party.
--                  A typed one is right on the day it is typed and lying the
--                  first time money moves. It stays blank until the ledger can
--                  compute it. ⚠️ That means a supplier page with real rows
--                  has an empty 未付 column, which is honest and looks unfinished;
--                  it is finished by the ledger link below, not by a text box.
--
--   no stage       A party has no workflow. `status` here is the business's own
--                  word for this person -- 施工中 · 待跟进 · 新客户 · 活跃 --
--                  the same decision as `stage`, for the same reason: the
--                  vocabulary is the product.
--
-- ── ONE ROW, NOT TWO TABLES ───────────────────────────────────────────────
--
-- 任务 72 recorded 「directory 要分「公司」跟「人」两张，TIN 在公司那张」,
-- from atomic-crm. That is right for atomic-crm and wrong here, and the
-- founder's own production database is what says so: `dealers` carries
-- `company_name` AND `contact_person` on ONE row.
--
-- The split exists in atomic-crm and ERPNext because a B2B sales team has many
-- contacts inside one account. A renovation contractor's customer IS a person;
-- a wholesaler's is a shop with one towkay. Splitting would make the common
-- case need two rows and a join to show a phone number.
--
-- What survives from ERPNext is the one field that actually decides anything:
-- `customer_type` (reqd 1). It is `kind` here, and it is what says whether
-- reg_no and tax_id apply at all -- which LHDN needs, because Supplier and
-- Buyer are STRUCTURES in MyInvois, not lines of text (任务 70).
--
-- ── WHY phone AND whatsapp ARE TWO NAMED COLUMNS ──────────────────────────
--
-- 任务 72 also recorded 「电话要一开始就用 jsonb 阵列，不要 phone_1 / phone_2」,
-- from atomic-crm's 2025-01 migration off two fixed columns. Half right, and
-- the half that is wrong matters here.
--
-- An array is correct when the count is unbounded and no number has a JOB.
-- vibe-dealer's 0030 says why that is not this case, from inside this market:
--
--     「Malaysia SME dealers are contacted over WhatsApp far more than by
--      call, and that number sometimes differs from the shop's main line --
--      one "Phone" field forced staff to pick one or cram both into it.」
--
-- Here the numbers have jobs: `whatsapp` is what a wa.me link is built from
-- (任务 48) and what an enquiry notification is sent to (任务 59). A consumer
-- of `[{number, type}]` has to search the array and decide what to do about
-- two entries claiming to be WhatsApp. A named column is one value, indexable,
-- and cannot be ambiguous.
--
-- The unbounded tail is not lost: it is `extra`, which this product already
-- has and which the owner reaches by adding a column to his own page.
--
-- ── WHAT IS DELIBERATELY NOT HERE: party_id ───────────────────────────────
--
-- Both earlier migrations promise it: 「It becomes a foreign key when
-- `directory` lands」. It does not land today, and the test is the one this
-- repo already wrote for `branch_id`: add a column early only when
-- retrofitting means DECIDING something nobody can answer afterwards.
--
--   branch_id   unanswerable later. Which branch was this row for? Nobody
--               knows. So it is a column now, null for every row.
--   party_id    answerable later, exactly:
--                 update pipeline_records r set party_id = d.id
--                 from directory_entries d
--                 where d.project_id = r.project_id and d.name = r.party;
--               because `party` is the same text this form writes.
--
-- An unused column is this repo's most-repeated defect, and adding one plus a
-- delete guard that can never fire would be two of them.
--
-- ⚠️ What lands WITH party_id, so that it is not rediscovered: vibe-dealer's
-- 0011 lets a dealer be deleted ONLY when nothing financial points at it --
-- 「narrowly scoped to the one case where nothing of financial consequence has
-- happened yet」 -- and enforces it in the database rather than in app code.
-- Ours is `on delete restrict` on party_id, mirroring
-- `transactions_dealer_id_fkey ... ON DELETE RESTRICT`.

create table if not exists public.directory_entries (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 'customers' | 'suppliers' | 'staff'. Constrained below against the
     TypeScript catalogue, same as the other two shapes. */
  module_key text not null,

  /* Person or company. From ERPNext's `customer_type`, the one required field
     on its Customer besides the name -- because it is what decides whether a
     registration number and a tax identifier mean anything for this row. */
  kind text not null default 'person' check (kind in ('person', 'company')),

  /* WHO. The identity of the row, and what the owner reads down the first
     column. Not unique: two 陈先生 is a real situation, and merging them
     because they share a name would be worse than showing both. */
  name text not null,

  /* The person to ask for, when `name` is a company. Empty for a person --
     vibe-dealer keeps both on one row and so do we; see the header. */
  contact_person text not null default '',

  /* Two numbers with two jobs -- see the header. Free text, because a
     Malaysian number is written 「012-345 6789」, 「+60 12-345 6789」 and
     「60123456789」 by three different people and all three are correct. */
  phone text not null default '',
  whatsapp text not null default '',

  email text not null default '',

  /* Where. One field, not a structured address: a contractor's customer has a
     site, a supplier has a shop, and neither is a postal form. `region` is
     separate because it is the one part that gets FILTERED on -- vibe-dealer
     indexes it for exactly that. */
  address text not null default '',
  region text not null default '',

  /* SSM / ROC company number. vibe-dealer's `company_no`. */
  reg_no text not null default '',

  /* LHDN TIN. Empty for every row today; e-Invoice is scheduled after this
     shape and cannot be built without a place to put it (任务 70/71).
     ⚠️ Unlike branch_id this is not a reserved column: the owner can type it
     the day he has it, and the form shows it for a company. */
  tax_id text not null default '',

  /* This business's own word for where this party stands: 施工中 · 待跟进 ·
     新客户 · 活跃 · 在职. Never an enum -- see the header. */
  status text not null default '',

  note text not null default '',

  /* This business's own fields, keyed by the column the owner added. Never
     used for arithmetic the system does. */
  extra jsonb not null default '{}'::jsonb,

  /* A column, not a feature. Identical to pipeline_records.branch_id and for
     the identical reason: which outlet an old row belonged to cannot be
     decided afterwards. */
  branch_id uuid,

  /* Off the shelf, not gone. A supplier you stopped buying from is next year's
     answer to 「上次那家云石厂叫什么」; deleting them throws that away.
     Same column, same meaning, as pipeline_records.archived_at. */
  archived_at timestamptz,

  /* Pressing 「保存」 twice on 4G is one customer. */
  idempotency_key uuid,

  created_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.directory_entries is
  'Rows for every module of shape `directory` -- 客户 · 供应商 · 员工. One table per shape; see the header of 20260831070000. No document number and no amount, both on purpose.';
comment on column public.directory_entries.kind is
  'person or company. From ERPNext''s required customer_type: it is what decides whether reg_no and tax_id apply, and MyInvois needs Buyer as a structure rather than a line of text.';
comment on column public.directory_entries.whatsapp is
  'Separate from phone on purpose. In this market the WhatsApp number is often not the shop line, and it is the number wa.me links and enquiry notifications are built from -- a job a jsonb array of numbers cannot do unambiguously.';
comment on column public.directory_entries.status is
  'The business''s own word for this party. Never an enum: the vocabulary is the product.';
comment on column public.directory_entries.branch_id is
  'Deliberately unused, same as pipeline_records.branch_id. Null for every row until branch management exists.';

-- The question this table is asked: one module's parties, most recent first.
-- Archived rows are excluded from the index as well as from the page, because
-- a shelf that has been cleared should not cost anything to skip.
create index if not exists directory_entries_page_idx
  on public.directory_entries (project_id, module_key, created_at desc)
  where archived_at is null;

-- 「那个姓陈的客户」 -- name lookup, and the join party_id will be backfilled
-- through (see the header).
create index if not exists directory_entries_name_idx
  on public.directory_entries (project_id, name);

create unique index if not exists directory_entries_idempotency_idx
  on public.directory_entries (project_id, idempotency_key)
  where idempotency_key is not null;

-- ── WHO CAN SEE IT ────────────────────────────────────────────────────────
-- Row level, identical to the first two shapes. The rule lives in the database
-- so an application mistake cannot leak one business's customer list to
-- another, and a bought-out copy carries its own protection (任务 64).
--
-- ⚠️ A customer list is the most portable thing in this table. A contractor's
-- quotations are useless to a competitor; his customer list is not.

alter table public.directory_entries enable row level security;

create policy "directory_entries_select_own" on public.directory_entries
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = directory_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "directory_entries_insert_own" on public.directory_entries
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = directory_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "directory_entries_update_own" on public.directory_entries
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = directory_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "directory_entries_delete_own" on public.directory_entries
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = directory_entries.project_id
        and projects.account_id = auth.uid()
    )
  );

-- ── THE MODULE KEY HAS TO BE ONE WE BUILD ─────────────────────────────────

create or replace function public.is_directory_module(key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select key in ('customers', 'suppliers', 'staff');
$$;

comment on function public.is_directory_module(text) is
  'The modules of shape `directory`. Mirrors MODULE_CATALOG in lib/portal/module-catalog.ts; module-catalog.test.ts fails if the two drift, in both directions.';

alter table public.directory_entries
  add constraint directory_entries_module_is_directory
  check (public.is_directory_module(module_key));

-- ── WRITING A PARTY ───────────────────────────────────────────────────────
--
-- The same function the person's form calls and the only one the assistant may
-- call -- 「AI 平权」, 重点 23. There is no document number to protect here, so
-- the reason for an RPC is the other three: the ownership check, the
-- idempotency key, and one place where the trimming and the length caps live.
--
-- ⚠️ Every text input is capped. `name` at 200 to match `party` on the other
-- two tables -- they hold the same string and a name that fits one has to fit
-- the other.

create or replace function public.add_directory_entry(
  in_project_id uuid,
  in_module_key text,
  in_name text,
  in_kind text default null,
  in_contact_person text default '',
  in_phone text default '',
  in_whatsapp text default '',
  in_email text default '',
  in_address text default '',
  in_region text default '',
  in_reg_no text default '',
  in_tax_id text default '',
  in_status text default '',
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.directory_entries;
  the_kind text;
begin
  select exists (
    select 1 from public.projects
    where id = in_project_id and account_id = auth.uid()
  ) into mine;
  if not mine then
    raise exception 'not your project';
  end if;

  if not public.is_directory_module(in_module_key) then
    raise exception 'not a directory module: %', in_module_key;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.directory_entries
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  /* A row with no name is a row nobody can find again. The other two shapes
     refuse the same way, and for the same reason: the first column is the one
     a person scanning a list cannot read past. */
  if coalesce(btrim(in_name), '') = '' then
    raise exception 'a directory entry needs a name';
  end if;

  /* A caller who said nothing gets `person` -- which is what a renovation
     contractor's customer, a salon's guest and an employee all are. Not forced
     for any module: a wholesaler's customer is a shop, and a business that
     puts a subcontracting company on its 员工 page is describing its own
     arrangement rather than making a mistake. A default is not a constraint. */
  the_kind := lower(btrim(coalesce(in_kind, '')));
  if the_kind not in ('person', 'company') then
    the_kind := 'person';
  end if;

  insert into public.directory_entries (
    project_id, module_key, kind, name, contact_person, phone, whatsapp,
    email, address, region, reg_no, tax_id, status, note, extra,
    created_by, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    the_kind,
    left(btrim(in_name), 200),
    left(btrim(coalesce(in_contact_person, '')), 200),
    left(btrim(coalesce(in_phone, '')), 40),
    left(btrim(coalesce(in_whatsapp, '')), 40),
    left(btrim(coalesce(in_email, '')), 200),
    left(btrim(coalesce(in_address, '')), 400),
    left(btrim(coalesce(in_region, '')), 120),
    left(btrim(coalesce(in_reg_no, '')), 60),
    /* MyInvois caps the TIN it accepts; 60 is generous against that and still
       refuses a paragraph pasted into the wrong box. */
    left(btrim(coalesce(in_tax_id, '')), 60),
    left(btrim(coalesce(in_status, '')), 60),
    left(coalesce(in_note, ''), 2000),
    coalesce(in_extra, '{}'::jsonb),
    auth.uid(),
    in_idempotency_key
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.add_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, text, jsonb, uuid
) from public;
grant execute on function public.add_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, text, jsonb, uuid
) to authenticated;

-- updated_at should mean something.
create or replace function public.directory_entries_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists directory_entries_touch_updated on public.directory_entries;
create trigger directory_entries_touch_updated
  before update on public.directory_entries
  for each row execute function public.directory_entries_touch();

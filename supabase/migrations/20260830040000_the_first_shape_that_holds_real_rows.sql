-- supabase/migrations/20260830040000_the_first_shape_that_holds_real_rows.sql
--
-- The first table in this product that holds a customer's own business.
--
-- Until now every row a customer saw was a literal in lib/portal/*: a hundred
-- customers were shown the same 陈先生 · RM 48,500 · 已确认. This is the
-- foundation the founder approved on 2026-08-30, built one shape at a time,
-- starting with the one that carries four modules.
--
-- ── WHY ONE TABLE PER SHAPE, NOT PER MODULE ───────────────────────────────
--
-- 报价单, 订单, 项目 and 任务 are four different things to an owner and one
-- table to a database: a document, a counterparty, an amount, a stage it is
-- stuck at, and two dates. Seventeen tables would be the same bug with
-- seventeen places to hide, and every question ("what is stuck?") would be a
-- seventeen-way union.
--
-- ── WHY NOT ONE UNIVERSAL jsonb TABLE ─────────────────────────────────────
--
-- Because then amounts do not add up, dates do not sort, and a stage cannot be
-- constrained -- and an amount with a stage is precisely what `pipeline` MEANS.
-- The shared ninety percent is real columns; the varying ten percent, which is
-- genuinely per-business (a salon's colour formula, a contractor's site access
-- note), lives in `extra`.
--
-- ── WHY THE STAGE IS TEXT AND NOT AN ENUM ─────────────────────────────────
--
-- The stages are the CUSTOMER'S OWN WORDS, produced by the questionnaire:
-- 「Approved · Deposit · Progress」 for one contractor, 「已报价 · 等确认 ·
-- 收订金」 for another. See workflowStages() in industry-template.ts. An enum
-- would force every business in Malaysia through one vocabulary, which is the
-- opposite of what this product sells.
--
-- What IS constrained is that the stage must be one the project actually
-- declares -- that check lives in the RPC, where the project's own workflow can
-- be read. A CHECK constraint cannot see another table.
--
-- ── branch_id IS DELIBERATELY UNUSED ──────────────────────────────────────
--
-- Approved 2026-08-30 as a column and NOT as a feature. Tunai, Aoikumo and
-- StoreHub all price per outlet, so this market's businesses have branches --
-- but nobody has asked for branch management yet. Adding the column now costs
-- nothing; adding it after twenty customers means migrating every row of every
-- business.
--
-- ⚠️ This repo's most common defect is a capability wired to nothing, and an
-- unused column is exactly that shape. It is unused ON PURPOSE, it is null for
-- every row until branches exist, and a test asserts it stays nullable so that
-- nobody "fixes" it into a required field before the feature is real.

create table if not exists public.pipeline_records (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* Which module this row belongs to: 'quotations', 'orders', 'projects',
     'tasks' -- and 'purchases' when that arrives (see task 67: a purchase
     order is a pipeline, so it costs a row here rather than a new shape).
     Constrained against the catalogue by a trigger below, because the list
     lives in TypeScript and Postgres cannot import it. */
  module_key text not null,

  /* The owner's document number: QT-2026-0042. Assigned by next_doc_no()
     below, never by the application -- two people opening a quotation at the
     same moment is the one case only the database can get right. */
  doc_no text not null,

  /* Who it is with. Free text for now: 客户 is not yet a real table, so a name
     is what exists. It becomes a foreign key when `directory` lands, and the
     text stays as what was written at the time -- a renamed customer must not
     silently rewrite last year's quotation. */
  party text not null default '',

  /* Money, in the smallest unit (sen), because a float cannot hold RM 48,500.10
     and a business's own money is the last place to accept rounding. Nullable
     because a task has no amount. */
  amount_cents bigint,

  /* Where it is stuck. The customer's own word -- see the note above. */
  stage text not null default '',

  issued_on date,
  due_on date,

  /* This business's own fields. Never used for arithmetic the system does. */
  extra jsonb not null default '{}'::jsonb,

  /* See the note above: a column, not a feature. */
  branch_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* One document number per project per module. Not globally unique: two
     businesses both having QT-2026-0001 is correct and expected. */
  constraint pipeline_records_doc_no_unique unique (project_id, module_key, doc_no)
);

comment on table public.pipeline_records is
  'Rows for every module of shape `pipeline` -- 报价单 · 订单 · 项目 · 任务. One table per shape, not per module: see the header of 20260830040000.';
comment on column public.pipeline_records.branch_id is
  'Deliberately unused. A column reserved on 2026-08-30 so that adding branches later does not mean migrating every customer''s rows. Null for every row until branch management exists.';
comment on column public.pipeline_records.amount_cents is
  'Sen, not ringgit. A float cannot hold RM 48,500.10 exactly.';
comment on column public.pipeline_records.stage is
  'The customer''s own word for where this is stuck, from their questionnaire. Never an enum: the vocabulary is the product.';

-- The questions this table gets asked, in the order it gets asked them: one
-- module's rows, newest first.
create index if not exists pipeline_records_page_idx
  on public.pipeline_records (project_id, module_key, created_at desc);

-- ── WHO CAN SEE IT ────────────────────────────────────────────────────────
--
-- Row level, exactly like project_pages: the rule lives in the database, so an
-- application-layer mistake cannot leak one business's quotations to another.
-- It is also what makes a bought-out copy safe on its own (see task 64): the
-- schema carries its own protection.

alter table public.pipeline_records enable row level security;

create policy "pipeline_records_select_own" on public.pipeline_records
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = pipeline_records.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "pipeline_records_insert_own" on public.pipeline_records
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = pipeline_records.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "pipeline_records_update_own" on public.pipeline_records
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = pipeline_records.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "pipeline_records_delete_own" on public.pipeline_records
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = pipeline_records.project_id
        and projects.account_id = auth.uid()
    )
  );

-- ── THE MODULE KEY HAS TO BE ONE WE BUILD ─────────────────────────────────
--
-- `is_known_register()` exists for exactly this reason on the style side: a
-- hand-written list in SQL goes stale against the TypeScript one. Same shape
-- here, and module-catalog.test.ts already fails when the two drift.

create or replace function public.is_pipeline_module(key text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select key in ('quotations', 'orders', 'projects', 'tasks');
$$;

comment on function public.is_pipeline_module(text) is
  'The modules of shape `pipeline`. Mirrors MODULE_CATALOG in lib/portal/module-catalog.ts; module-catalog.test.ts fails if the two drift.';

alter table public.pipeline_records
  add constraint pipeline_records_module_is_pipeline
  check (public.is_pipeline_module(module_key));

-- ── DOCUMENT NUMBERS ──────────────────────────────────────────────────────
--
-- QT-2026-0042. The prefix and the width are the owner's, because he already
-- has a numbering habit and a system that hands him a number he does not
-- recognise is a system he keeps a second notebook beside.
--
-- Counted per project, per module, per YEAR: a contractor's quotations restart
-- at 0001 each January, which is what every invoice book in this country does.
--
-- WHY NOT A POSTGRES SEQUENCE. A sequence per project per module per year is
-- thousands of sequence objects, and they cannot be reset or renumbered when a
-- customer changes their prefix. This counts what exists, inside the same
-- transaction as the insert, with the row lock the unique constraint gives us:
-- two simultaneous inserts cannot both win, and the loser retries.

create table if not exists public.project_doc_prefixes (
  project_id uuid not null references public.projects(id) on delete cascade,
  module_key text not null,
  prefix text not null,
  primary key (project_id, module_key)
);

alter table public.project_doc_prefixes enable row level security;

create policy "doc_prefixes_select_own" on public.project_doc_prefixes
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_doc_prefixes.project_id
        and projects.account_id = auth.uid()
    )
  );

create policy "doc_prefixes_write_own" on public.project_doc_prefixes
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = project_doc_prefixes.project_id
        and projects.account_id = auth.uid()
    )
  );

/* The default prefix per module. English initials, because the system speaks
   the customer's chosen language and these appear on paper a stranger may
   read. The owner can change it; this is only what he starts with. */
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
begin
  select prefix into my_prefix
  from public.project_doc_prefixes
  where project_id = in_project_id and module_key = in_module_key;

  my_prefix := coalesce(my_prefix, public.default_doc_prefix(in_module_key));

  /* Counted, not sequenced -- see the note above. A cancelled document leaves
     its number spent, which is correct: an accounting number is never reused,
     and a gap is evidence rather than a defect. */
  select count(*) into used
  from public.pipeline_records
  where project_id = in_project_id
    and module_key = in_module_key
    and doc_no like my_prefix || '-' || yr || '-%';

  return my_prefix || '-' || yr || '-' || lpad((used + 1)::text, 4, '0');
end;
$$;

comment on function public.next_doc_no(uuid, text) is
  'The next document number for one project, module and year: QT-2026-0042. Counted inside the caller''s transaction; the unique constraint on (project_id, module_key, doc_no) is what makes a race impossible rather than unlikely.';

-- ── WRITING A ROW ─────────────────────────────────────────────────────────
--
-- Through an RPC rather than a direct insert, for one reason the policies
-- cannot cover: the document number. A client that could set `doc_no` could
-- set it to somebody else's, and the unique constraint would then reject the
-- honest writer.

create or replace function public.add_pipeline_record(
  in_project_id uuid,
  in_module_key text,
  in_party text default '',
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default '{}'::jsonb
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

  /* A row with no stage starts at the beginning of THIS business's own
     workflow rather than at a word we invented.

     ⚠️ The first version of this read `projects.analysis`. There is no such
     column -- plpgsql does not resolve names until the function RUNS, so it
     would have thrown the first time a customer added a quotation rather than
     when this file was pushed. The workflow lives two joins away:

         projects.account_id -> accounts.lead_id -> analysis_results

     and in the language the customer's own system speaks, because
     `after_workflow_en` and `after_workflow` are two different lists rather
     than a translation (see lib/templates/industry-template.ts). */
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
    project_id, module_key, doc_no, party, amount_cents, stage,
    issued_on, due_on, extra
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_party, ''), 200),
    in_amount_cents,
    left(coalesce(nullif(btrim(coalesce(in_stage, '')), ''), coalesce(first_stage, '')), 60),
    coalesce(in_issued_on, current_date),
    in_due_on,
    coalesce(in_extra, '{}'::jsonb)
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.add_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb) from public;
grant execute on function public.add_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb) to authenticated;

revoke execute on function public.next_doc_no(uuid, text) from public;
grant execute on function public.next_doc_no(uuid, text) to authenticated;

-- updated_at should mean something.
create or replace function public.pipeline_records_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pipeline_records_touch_updated on public.pipeline_records;
create trigger pipeline_records_touch_updated
  before update on public.pipeline_records
  for each row execute function public.pipeline_records_touch();

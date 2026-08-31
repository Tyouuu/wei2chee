-- supabase/migrations/20260831080000_a_quotation_belongs_to_somebody.sql
--
-- The promise both earlier shapes wrote down, kept.
--
--   20260830040000 (pipeline): 「It becomes a foreign key when `directory`
--     lands, and the text stays as what was written at the time -- a renamed
--     customer must not silently rewrite last year's quotation.」
--   20260831020000 (ledger):  the same sentence, for the same reason.
--
-- `directory` landed on 20260831070000, and that migration deliberately did NOT
-- add this column: by the rule this repo uses for `branch_id`, a column is
-- added early only when retrofitting means deciding something nobody can
-- answer afterwards, and this one is answerable exactly -- `party` holds the
-- same text the form writes. The backfill at the bottom is that answer, run
-- once, here.
--
-- ── TWO COLUMNS FOR ONE FACT, ON PURPOSE ──────────────────────────────────
--
--   party      WHAT WAS WRITTEN AT THE TIME. Never updated again.
--   party_id   WHO IT IS, if we know.
--
-- A document is a record of something that happened. When 陈先生 becomes
-- 陈氏建材有限公司 next year, last year's quotation still says 陈先生 -- that
-- is not stale data, it is what the paper says, and an accounting record that
-- rewrites itself when a name changes cannot be used as evidence.
--
-- So the text is the snapshot and the link is the relationship. Every mature
-- system in this space does the same thing and for the same reason; ERPNext
-- keeps `customer_name` on the Sales Invoice beside the `customer` link.
--
-- ── WHY `on delete restrict` ──────────────────────────────────────────────
--
-- From the founder's own vibe-dealer, migration 0011, which is the only place
-- in that database where deleting anything is allowed at all:
--
--     「let master delete a dealer, but only one that's a pure onboarding
--      mistake -- zero transactions ever recorded against it ... Enforced here
--      at the RLS layer (not just in app code) so the same rule holds even for
--      a direct API call.」
--
-- Ours is the database's own constraint rather than a policy, which is
-- stronger in the way that matters: a policy that finds no rows deletes
-- nothing SILENTLY, and the front end then says 「couldn't delete」 with no
-- reason. A foreign key raises, and the reason is in the error.
--
-- The rule underneath is the same one, and it is worth saying plainly: a party
-- with history is not deletable, ever, by anybody. An onboarding mistake with
-- nothing against it still is -- and that is the case 0011 was written for.
--
-- ⚠️ Archiving is the answer for everything else (`archived_at`), which is why
-- the shelf already hides a party without losing them.

alter table public.pipeline_records
  add column if not exists party_id uuid references public.directory_entries(id) on delete restrict;

alter table public.ledger_entries
  add column if not exists party_id uuid references public.directory_entries(id) on delete restrict;

comment on column public.pipeline_records.party_id is
  'Who this is with, when we know. `party` stays as the text written at the time -- a renamed customer must not rewrite last year''s quotation. on delete restrict: a party with history cannot be deleted, only archived.';
comment on column public.ledger_entries.party_id is
  'Who the money is with, when we know. Same pair as pipeline_records: the text is the snapshot, this is the relationship.';

-- 「这个客户的全部单」 and 「这个客户的全部钱」 -- the two questions a party's
-- own page asks, and the reason this column exists at all.
create index if not exists pipeline_records_party_idx
  on public.pipeline_records (project_id, party_id)
  where party_id is not null;

create index if not exists ledger_entries_party_idx
  on public.ledger_entries (project_id, party_id)
  where party_id is not null;

-- ── RESOLVING A NAME TO A PARTY ───────────────────────────────────────────
--
-- The form and the assistant both hand over a NAME, because that is what an
-- owner says: 「陈先生的订金三千」. This is the one place that turns it into a
-- link, and it refuses to guess:
--
--   · exactly one party of this project with that name  ->  that party
--   · none, or more than one                            ->  null
--
-- Two 陈先生 is a real situation (20260831070000 declines to make the name
-- unique for exactly that reason). Picking the first would attach a payment to
-- the wrong person's account, silently, and the owner would find out at
-- month end. Null is the honest answer, and the row still carries the text.

create or replace function public.party_by_name(in_project_id uuid, in_name text)
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
       and lower(btrim(d.name)) = lower(btrim(coalesce(in_name, '')))
     limit 2
  )
  select id from hits where (select count(*) from hits) = 1;
$$;

comment on function public.party_by_name(uuid, text) is
  'One party of this project with exactly this name, or null. Refuses to choose between two people who share a name -- attaching money to the wrong account silently is worse than leaving it unlinked.';

revoke execute on function public.party_by_name(uuid, text) from public;
grant execute on function public.party_by_name(uuid, text) to authenticated;

-- ── THE TWO WRITERS LEARN THE LINK ────────────────────────────────────────
--
-- Both take `in_party_id` for a caller that already knows (a picker), and both
-- fall back to resolving the name when it does not. The fallback is what makes
-- the assistant's 「加一单，陈先生」 land on the right person without the model
-- ever being asked to know an id.
--
-- ⚠️ Re-declared in full rather than patched: plpgsql resolves names when it
-- RUNS, so a function body that references a column that does not exist pushes
-- successfully and fails in front of a customer. Every one of these is called
-- for real by npm run check:records.

drop function if exists public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid);
drop function if exists public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid);

create function public.add_pipeline_record(
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

  /* A party the caller named has to be one of THIS project's. Checked rather
     than trusted: the id arrives from a browser. */
  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id and project_id = in_project_id;
    if not found then
      raise exception 'that party is not in this project';
    end if;
    the_party := in_party_id;
  else
    the_party := public.party_by_name(in_project_id, in_party);
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
end;
$$;

revoke execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid) from public;
grant execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid) to authenticated;

drop function if exists public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid);
drop function if exists public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid);

create function public.add_ledger_entry(
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

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id and project_id = in_project_id;
    if not found then
      raise exception 'that party is not in this project';
    end if;
    the_party := in_party_id;
  else
    /* Money against a document belongs to whoever that document belongs to --
       a deposit for 陈先生's job is 陈先生's money even when the owner typed
       nothing in the name box. Falls through to the name only when there is no
       document to inherit from. */
    if in_against_id is not null then
      select party_id into the_party from public.pipeline_records where id = in_against_id;
    end if;
    the_party := coalesce(the_party, public.party_by_name(in_project_id, in_party));
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
end;
$$;

revoke execute on function public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid) from public;
grant execute on function public.add_ledger_entry(uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid) to authenticated;

-- ── THE BACKFILL ──────────────────────────────────────────────────────────
--
-- Rows written between 20260831070000 and today carry a name and no link. The
-- name is exactly the text the form wrote, so the join is exact -- and it uses
-- the same 「only when there is exactly one」 rule as party_by_name, because a
-- backfill that guesses is worse than one that leaves a gap: nobody would ever
-- look at it again.

update public.pipeline_records r
   set party_id = public.party_by_name(r.project_id, r.party)
 where r.party_id is null
   and coalesce(btrim(r.party), '') <> '';

update public.ledger_entries e
   set party_id = public.party_by_name(e.project_id, e.party)
 where e.party_id is null
   and coalesce(btrim(e.party), '') <> '';

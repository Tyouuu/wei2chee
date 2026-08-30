-- supabase/migrations/20260830060000_what_the_row_is_about_and_when_it_stopped.sql
--
-- Two columns the first version of pipeline_records did not have, both found by
-- finally reading the schema of a project this repo had recorded as usable and
-- never opened: marmelab/atomic-crm (MIT, and React + shadcn/ui + Supabase --
-- the same stack as ours). Task 63 listed it in August and nothing was taken
-- from it until today, which is research that may as well not have happened.
--
-- ── title: THE COLUMN EVERY PIPELINE PAGE LEADS WITH ──────────────────────
--
-- Their `deals` table carries `name` and `description` beside the company and
-- the amount. Ours carried `party` and nothing else -- so
--
--     Taman Desa 三房翻新 · 陈先生 · RM 48,500 · 已确认
--
-- had nowhere to put the first and most important column. It would have gone
-- into `extra`, where it cannot be indexed, searched or sorted, and where the
-- one thing the owner scans the page for would have been the one thing the
-- database could not find.
--
-- The four modules name it differently and mean the same thing: a quotation's
-- scope, an order's contents, a project's site, a task's instruction. So it is
-- one column, and the module's own vocabulary supplies the heading.
--
-- ── archived_at: A LOST QUOTATION IS HISTORY, NOT RUBBISH ─────────────────
--
-- atomic-crm archives a deal (`archived_at timestamp default null`) rather than
-- deleting it, and that is right for a reason this market makes sharper: a
-- contractor who quoted RM96,000 and lost it needs that quotation next year
-- when the customer comes back, and needs it out of today's list either way.
-- Deleting is how you lose the answer to 「上次我们报多少?」.
--
-- Nothing archives rows yet -- the control comes with the page. The column is
-- here now because adding it later means a migration over every customer's
-- data, which is the same argument that put branch_id in on day one.

alter table public.pipeline_records
  add column if not exists title text not null default '',
  add column if not exists archived_at timestamptz;

comment on column public.pipeline_records.title is
  'What the row is about: a quotation''s scope, an order''s contents, a project''s site, a task''s instruction. The first column of every pipeline page; the module supplies the heading.';
comment on column public.pipeline_records.archived_at is
  'Set when the owner puts a row away. A lost quotation is still the answer to "what did we quote last time" -- it leaves the list, not the database. Null means live.';

-- Every question this table gets asked is about live rows, so the index that
-- serves the page should not be walking archived ones.
drop index if exists pipeline_records_page_idx;
create index pipeline_records_live_idx
  on public.pipeline_records (project_id, module_key, created_at desc)
  where archived_at is null;

-- Let the RPC set it, since the RPC is the only writer.
create or replace function public.add_pipeline_record(
  in_project_id uuid,
  in_module_key text,
  in_title text default '',
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

  /* The first stage of THIS business's own workflow. See 20260830040000 for
     why it is two joins away and not on the project. */
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
    issued_on, due_on, extra
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
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

/* The eight-argument shape is gone: Postgres keeps overloads side by side, and
   two functions with the same name where one silently drops the title is how a
   caller ends up writing rows with no subject. */
drop function if exists public.add_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb);

revoke execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb) from public;
grant execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb) to authenticated;

-- supabase/migrations/20260822060000_the_system_speaks_english.sql
--
-- The system a customer designs is now built in ENGLISH by default, and the
-- language is theirs to change.
--
-- WHY THIS IS A CORRECTION AND NOT A FEATURE
--
-- Everything Formae shows the OWNER is in Chinese, because the owner is a
-- Malaysian-Chinese SME owner. From that, the whole product quietly assumed
-- the system built FOR them should be Chinese too. That assumption was never
-- examined, and it is wrong about the readership.
--
-- The owner is not the only reader of their own system. The 师傅 on site may
-- read Malay. The quotation goes to a property manager who reads English. The
-- purchase order goes to a supplier's clerk. The invoice goes to LHDN, which
-- takes English. Business paperwork in Malaysia is English -- not as a
-- preference, as the format everyone downstream already accepts. A quotation
-- headed 「报价单」 with columns 「报价内容 / 报价金额」 is a document that has to
-- be retyped before it can leave the building.
--
-- So: `projects.system_language`, default 'en'. Formae still speaks to the
-- owner in Chinese ABOUT a system that speaks English to everyone else. An
-- owner whose customers are all Chinese-speaking flips it, and gets a fully
-- Chinese system -- the copy tables in lib/templates/copy/ carry both, in
-- full, and lib/templates/copy/copy-parity.test.ts is what keeps them level.
--
-- WHY EXISTING PROJECTS ARE NOT MIGRATED TO ENGLISH
--
-- The column defaults to 'en' for new rows and is backfilled to 'zh' for every
-- row that already exists. That looks inconsistent and is deliberate: the
-- pages of an existing project are already GENERATED, in Chinese, and sitting
-- in `project_pages.layout_json`. Flipping their language column would change
-- nothing they can see except the chrome, producing a page half in each
-- language -- the one outcome worse than either language on its own. They keep
-- what they have and can switch, which regenerates only the pages they have
-- never edited.
--
-- THE ANALYSIS ALSO GAINS AN ENGLISH SIDE
--
-- The model tailors a workflow and a summary line to THIS business, and those
-- are the two things that make a first screen read as "it understood my
-- business". They come back in the language the visitor answered in. With the
-- system now built in English while the owner reads Chinese -- the DEFAULT
-- pairing -- either the analysis is thrown away or the model returns both.
-- It returns both: two short fields, and see lib/openai/analysis-schema.ts for
-- the prompt rules that keep them from drifting apart.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists system_language text not null default 'en';

-- Backfill before the constraint. Every row that exists AT THIS MOMENT is a
-- project provisioned before English was the default, so its pages are already
-- generated in Chinese; the `default 'en'` above applies from here on. See the
-- note above for why they are not flipped.
update public.projects
set system_language = 'zh';

alter table public.projects
  drop constraint if exists projects_system_language_check;

alter table public.projects
  add constraint projects_system_language_check
  check (system_language in ('en', 'zh'));

comment on column public.projects.system_language is
  'The language the BUILT SYSTEM speaks. Not the locale the owner reads Formae in -- see lib/system-lang.ts.';

-- ---------------------------------------------------------------------------
-- 2. The analysis gains its English twin
-- ---------------------------------------------------------------------------

alter table public.analysis_results
  add column if not exists summary_en text;

alter table public.analysis_results
  add column if not exists after_workflow_en jsonb;

comment on column public.analysis_results.after_workflow_en is
  'The same tailored workflow in English, for a system built in English while the owner reads their analysis in Chinese. Null on every row written before 2026-08-22.';

-- ---------------------------------------------------------------------------
-- 3. The context the template builder reads
-- ---------------------------------------------------------------------------
--
-- Mirrors 20260820180000 exactly, with three additions: the two analysis
-- fields, and `system_language` off the project row. The whole function is
-- restated rather than patched because `create or replace` takes the whole
-- body -- and because one place to read is one place to get wrong.

create or replace function public.get_my_business_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  my_lead_id uuid;
  my_identity jsonb;
  my_language text;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select lead_id into my_lead_id
  from public.accounts
  where id = auth.uid();

  select jsonb_build_object(
    'business_name', p.business_name,
    'owner_name', p.owner_name
  ), p.system_language
  into my_identity, my_language
  from public.projects p
  where p.account_id = auth.uid();

  if my_lead_id is null then
    return jsonb_build_object(
      'industry', null,
      'language', null,
      'analysis', null,
      'lang', coalesce(my_language, 'en'),
      'identity', coalesce(my_identity, jsonb_build_object('business_name', null, 'owner_name', null))
    );
  end if;

  select jsonb_build_object(
    'industry', case when i.id is null then null else jsonb_build_object(
      'slug', i.slug,
      'name_zh', i.name_zh,
      'name_en', i.name_en,
      'labels', i.labels,
      'default_workflow', i.default_workflow,
      'suggested_modules', i.suggested_modules,
      'style_recommendation', i.style_recommendation
    ) end,
    'language', l.language,
    'analysis', case when a.id is null then null else jsonb_build_object(
      'summary', a.summary,
      'summary_en', a.summary_en,
      'before_workflow', a.before_workflow,
      'after_workflow', a.after_workflow,
      'after_workflow_en', a.after_workflow_en,
      'bottlenecks', a.bottlenecks
    ) end,
    'lang', coalesce(my_language, 'en'),
    'identity', coalesce(my_identity, jsonb_build_object('business_name', null, 'owner_name', null))
  )
  into result
  from public.leads l
  left join public.industries i on i.id = l.industry_id
  left join lateral (
    select ar.*
    from public.analysis_results ar
    where ar.lead_id = l.id
    order by ar.generated_at desc
    limit 1
  ) a on true
  where l.id = my_lead_id;

  return result;
end;
$$;

revoke execute on function public.get_my_business_context() from anon;
grant execute on function public.get_my_business_context() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The switch
-- ---------------------------------------------------------------------------
--
-- Returns the keys of the pages that were NEVER edited, so the caller can
-- regenerate exactly those and leave the customer's own work alone. A page
-- with a `content` key has been saved at least once; see `isUngeneratedLayout`
-- in lib/templates/industry-template.ts, which this mirrors. Doing the
-- selection here rather than in the client is what stops a race between the
-- language write and the regeneration deciding differently.

create or replace function public.update_project_system_language(new_language text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  untouched text[];
begin
  if new_language not in ('en', 'zh') then
    raise exception 'invalid system language: %', new_language;
  end if;

  update public.projects
  set system_language = new_language, updated_at = now()
  where account_id = auth.uid();

  if not found then
    raise exception 'project not found';
  end if;

  select coalesce(array_agg(pp.page_key), '{}')
  into untouched
  from public.project_pages pp
  join public.projects p on p.id = pp.project_id
  where p.account_id = auth.uid()
    and not (pp.layout_json ? 'content');

  return untouched;
end;
$$;

revoke execute on function public.update_project_system_language(text) from public;
grant execute on function public.update_project_system_language(text) to authenticated;

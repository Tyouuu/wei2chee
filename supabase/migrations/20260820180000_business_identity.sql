-- supabase/migrations/20260820180000_business_identity.sql
--
-- Lets a customer tell the product what their business is actually called.
--
-- WHY THIS WAS MISSING AND WHY IT MATTERS: nothing in the schema has ever held
-- a business name. The questionnaire never asks for one, `industries` only has
-- a trade name, and so every generated system labelled itself from whatever was
-- to hand -- first the local part of the signup email ("tianyou.demo"), then a
-- per-trade placeholder ("我的装修公司"). Both are visible in the rail, on the
-- home screen, in the specification document and in the WhatsApp handoff.
--
-- A business owner looking at a system that cannot say their company's name is
-- looking at a demo, not at their system. This is the smallest schema change
-- that turns the whole product from "a template with your trade in it" into
-- "yours".
--
-- `owner_name` is separate and equally load-bearing: the account chip in the
-- rail answers "who am I signed in as", which is a person, not a company. It
-- also gives the handoff message a human to address.

alter table public.projects
  add column if not exists business_name text,
  add column if not exists owner_name text;

-- Bounded at the database, not only in the form. These strings are rendered
-- into the rail, the page previews on the home screen and the specification
-- document; an unbounded value would break every one of those layouts, and a
-- client-side maxlength is a suggestion, not a constraint.
alter table public.projects
  drop constraint if exists projects_business_name_len;
alter table public.projects
  add constraint projects_business_name_len
  check (business_name is null or char_length(business_name) between 1 and 60);

alter table public.projects
  drop constraint if exists projects_owner_name_len;
alter table public.projects
  add constraint projects_owner_name_len
  check (owner_name is null or char_length(owner_name) between 1 and 40);

-- Same shape as update_project_style (20260820140000): security definer, no id
-- parameter, resolves the caller's own project from auth.uid() internally.
-- There is deliberately no UPDATE policy on public.projects, so this function
-- is the only path that can write these columns and a caller cannot name
-- somebody else's row.
create or replace function public.update_business_identity(
  new_business_name text,
  new_owner_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business text;
  v_owner text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Empty and whitespace-only both mean "clear it", so a customer who deletes
  -- the field gets the generated placeholder back rather than a system whose
  -- name is a single space.
  v_business := nullif(btrim(coalesce(new_business_name, '')), '');
  v_owner := nullif(btrim(coalesce(new_owner_name, '')), '');

  -- Truncated rather than rejected. The check constraints above are the real
  -- boundary; this keeps a paste of something over-long from failing the whole
  -- save, which for a customer looks like the product being broken.
  v_business := left(v_business, 60);
  v_owner := left(v_owner, 40);

  update public.projects
     set business_name = v_business,
         owner_name = v_owner,
         updated_at = now()
   where account_id = auth.uid();

  if not found then
    raise exception 'no project for this account';
  end if;
end;
$$;

revoke execute on function public.update_business_identity(text, text) from anon;
grant execute on function public.update_business_identity(text, text) to authenticated;

-- Extend the existing business-context RPC (20260820120000) so one call still
-- answers everything the layout builder and the home screen need. A second
-- round trip for two strings would be the worse trade.
--
-- CAREFULLY PRESERVED FROM THE ORIGINAL, because each of these is a decision
-- that was already made and getting any of them wrong here would be a silent
-- regression rather than a visible one:
--   * the `lateral` join taking the NEWEST analysis_results row. A lead
--     accumulates one row per questionnaire resubmission; a plain join would
--     make "which analysis" arbitrary.
--   * `language`, `before_workflow` and `style_recommendation`, which are read
--     elsewhere.
--
-- WHAT CHANGES, besides adding identity: the original returned NULL outright
-- when the account had no lead. Identity is not lead-derived -- somebody who
-- signed up directly still has a business with a name -- so the no-lead case
-- now returns identity with null industry/analysis instead of nothing.
-- industry-template.ts already treats both of those as optional and builds a
-- complete generic system from them, so this widens what callers get without
-- changing what they must handle.
create or replace function public.get_my_business_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  my_lead_id uuid;
  my_identity jsonb;
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
  )
  into my_identity
  from public.projects p
  where p.account_id = auth.uid();

  if my_lead_id is null then
    return jsonb_build_object(
      'industry', null,
      'language', null,
      'analysis', null,
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
      'before_workflow', a.before_workflow,
      'after_workflow', a.after_workflow,
      'bottlenecks', a.bottlenecks
    ) end,
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

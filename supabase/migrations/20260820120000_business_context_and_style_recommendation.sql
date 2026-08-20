-- supabase/migrations/20260820120000_business_context_and_style_recommendation.sql
--
-- Two fixes to the same underlying break: everything the product learned about
-- a visitor's business during acquisition was unreachable once they became a
-- customer.
--
-- 1. `get_my_business_context()` -- lets the portal read the caller's OWN lead,
--    industry and analysis, so lib/templates/industry-template.ts can build the
--    customer's five starting pages from their real answers instead of handing
--    them a blank canvas.
--
-- 2. `industries.style_recommendation` pointed at six style names
--    ('industrial', 'modern', 'warm-professional', 'professional', 'playful',
--    'minimal') that do not exist anywhere in this system. The only three real
--    styles are 'ledger', 'hearth' and 'blueprint' (projects.style's own check
--    constraint). The column was therefore dead data -- nothing could consume
--    it. Remapped onto the real three so the style-selection step can actually
--    recommend one.

-- ---------------------------------------------------------------------------
-- 1. Business context for the caller's own account
-- ---------------------------------------------------------------------------
--
-- `leads` and `analysis_results` deliberately carry NO RLS policies (see
-- 20260816204034_init_schema.sql: "All writes/reads happen server-side via the
-- service role key in API routes"). That was right while only /api/analyze
-- touched them. The portal now needs to read them too, and it must not do so
-- with the service-role key: that key can read EVERY lead, so a filter typo in
-- app code becomes a cross-customer data leak.
--
-- security definer + a lookup rooted at auth.uid() is the same discipline this
-- schema already uses for every write path (set_project_style,
-- save_project_page): the function, not the caller, decides which rows are
-- reachable, and the caller cannot pass in an id to widen that.
create or replace function public.get_my_business_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  my_lead_id uuid;
  result jsonb;
begin
  -- The ONLY input. Not a parameter, on purpose: a function that took a
  -- lead_id would be one missing check away from serving any lead to any
  -- caller.
  select lead_id into my_lead_id
  from public.accounts
  where id = auth.uid();

  -- Signed up without ever answering the questionnaire (or signed out).
  -- Not an error: industry-template.ts builds a complete generic system from
  -- null context, which is the whole reason it takes every field as optional.
  if my_lead_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'industry', case when i.id is null then null else jsonb_build_object(
      'slug', i.slug,
      'name_zh', i.name_zh,
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
    ) end
  )
  into result
  from public.leads l
  left join public.industries i on i.id = l.industry_id
  -- A lead can accumulate more than one analysis if the visitor resubmitted
  -- the questionnaire. The newest one is the one that reflects what they
  -- actually told us, so the join is to that row specifically rather than to
  -- "any analysis for this lead" (which would make the result arbitrary).
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

revoke execute on function public.get_my_business_context() from public;
grant execute on function public.get_my_business_context() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Point style_recommendation at styles that exist
-- ---------------------------------------------------------------------------
--
-- The mapping is the same one design-system/tokens/*.css now documents in its
-- own header comments, so a business's recommended style and the register that
-- style was designed for cannot drift apart:
--
--   ledger    industrial / precision -- renovation, wholesale, services
--   hearth    warm / people-facing   -- beauty, education, F&B
--   blueprint modern / neutral       -- retail, and the default for "other"
update public.industries set style_recommendation = 'ledger'
  where slug in ('renovation', 'wholesale', 'services');

update public.industries set style_recommendation = 'hearth'
  where slug in ('beauty', 'education', 'fnb');

update public.industries set style_recommendation = 'blueprint'
  where slug in ('retail', 'other');

-- Anything seeded later that misses the three lists above still lands on a
-- real style rather than a dangling name.
update public.industries set style_recommendation = 'blueprint'
  where style_recommendation is null
     or style_recommendation not in ('ledger', 'hearth', 'blueprint');

-- Enforced from here on, so the column cannot go back to naming styles that do
-- not exist. Deliberately NOT a foreign key: the three style names live in
-- CSS files and in projects.style's own check constraint, not in a table.
alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint'));

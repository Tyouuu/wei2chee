-- Where a website enquiry lands, and what it asks, decided per business.
--
-- WHY. The founder, told that a form on his customer's website becomes a
-- 报价单: 「你应该想到更多方面就是可能别的行业是不用这个报价单的呢？我不是只做一
-- 个行业呢？」. He was right about more than he said. Three things were wrong at
-- once, all of them in lib/templates/industry-template.ts:
--
--   1. WHICH PAGE was decided by the ORDER of a hard-coded array:
--      `["quotations","bookings","orders","projects"].find(...)`. A wholesaler
--      has both quotations and orders, so it always landed in quotations --
--      but a wholesaler taking repeat business off its own site is taking
--      ORDERS. An array's order was answering a question about a business.
--
--   2. SOME TRADES TAKE NO ENQUIRIES AT ALL. A kopitiam, a grocery, a car
--      wash: customers walk in. Promising them 「你的询价会变成一张单」 buys an
--      inbox that stays empty for a month, and an empty inbox does not read as
--      "no enquiries yet", it reads as software that is broken.
--
--   3. WHAT THE FORM ASKED was one shared list across all eight industries,
--      under a placeholder reading "3-room renovation, roughly how much?" --
--      shown to salons, clinics and workshops. That one is the most damaging,
--      because it contradicts the single thing this product claims: that the
--      system was built for THIS business.
--
-- The model is the only thing in the pipeline that can answer: it has already
-- read the business and already chosen its modules. It picks from a closed list
-- exactly as it does for `modules` -- this product never lets an LLM invent a
-- key. See lib/openai/analysis-schema.ts for the enum and for the three
-- corrections applied to its answer before anything is built from it.
--
-- NULLABLE, like `modules` before it, and for the same reason: every analysis
-- written before today has none, and back-filling one would be inventing a
-- decision that nothing made. The builder falls back to the old array order
-- when this is absent, so no existing system changes shape on deploy.

alter table public.analysis_results
  add column if not exists enquiry jsonb;

comment on column public.analysis_results.enquiry is
  'What a website enquiry becomes for THIS business: {lands_in, fields:[{label,label_en,kind}]}. '
  'lands_in is a module key this analysis chose, or "none" for a trade whose customers walk in '
  'rather than write. NULL for analyses generated before 2026-08-25.';

-- ---------------------------------------------------------------------------
-- The context RPC has to hand it over, or nothing downstream can read it.
-- ---------------------------------------------------------------------------
-- Copied verbatim from migration 20260822060000 with one field added.
-- `create or replace` matches on the argument list, so a partial redefinition
-- would leave the old body in place -- the column would fill and the page
-- builder would never see it, which is precisely how 315 register preferences
-- reached nothing before 2026-08-23.

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
      'bottlenecks', a.bottlenecks,
      -- Added 2026-08-25. Without it the column exists, the model fills it and
      -- the page builder never sees it -- which is the same silent gap that
      -- left 315 register preferences unreachable. NULL for every analysis
      -- written before that date, and the builder falls back.
      'enquiry', a.enquiry
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

-- supabase/migrations/20260828010000_the_console_counts_shapes.sql
--
-- Two things the founder's console could not answer, and one state it let the
-- database sit in.
--
-- ── 1. WHICH SHAPE TO BUILD FIRST ────────────────────────────────────────────
--
-- The module catalogue is a CLOSED list of 17 modules, and those 17 collapse
-- into 10 `shape` values -- pipeline covers four of them (quotations, orders,
-- projects, tasks), ledger three, directory three. That collapse is the whole
-- basis of the templating plan: making `pipeline` genuinely run is four modules
-- at once, not one.
--
-- Which means the single most load-bearing number in the business is "across
-- every customer, which shapes actually got used". `console_overview` counted
-- leads, customers, dev fees, monthly fees and stages -- money and funnel. It
-- did not count a single module. The founder could see one customer's modules
-- by opening that customer; there was no way to see them across customers, and
-- that cross-customer number is the one that decides what to build next.
--
-- WHY TWO COUNTS AND NOT ONE. There are two honest answers to "which modules
-- matter", and they disagree in a way worth seeing:
--
--   * `modules_proposed` -- what the AI chose from the questionnaire. It is the
--     demand signal at its earliest point, but only 2 of 10 analyses currently
--     carry it: the column was added in 20260821040000 and the eight rows older
--     than that are NULL. So this count ships with its own denominator
--     (`analyses_with_modules` / `analyses_total`) and must never be drawn
--     without it. A bar chart over 2 of 10 rows that does not say "2 of 10" is
--     a chart that lies confidently.
--
--   * `modules_built` -- what is actually in the customer's system now, after
--     provisioning and after they edited it. Complete: every project has its
--     pages. This is the stronger signal and the one to lead with.
--
-- Deliberately NOT backfilling the eight NULL `modules` rows from the
-- industry defaults. `defaultRecommendations(slug)` would fill them instantly
-- and the aggregate would then be measuring OUR OWN DEFAULTS reflected back at
-- us -- a number that always agrees with whatever we already decided. Same rule
-- the English backfill followed: fill from what was really recorded, or leave
-- it empty and show the coverage.
--
-- WHY page_key COUNTS COME BACK RAW AND UNMAPPED. `shape` lives in
-- lib/portal/module-catalog.ts and nowhere else. Teaching this function the
-- module -> shape mapping would make a second copy of it in SQL, and the two
-- would drift the first time a module is added. SQL counts page keys; the
-- console maps keys to shapes through the catalogue it already imports.
--
-- WHY count(distinct project_id) AND NOT count(*). A module is a page a system
-- either has or does not have. Counting rows would let one customer with two
-- pages of the same key outvote two customers who each have one.
--
-- WHY THE FOUNDER'S OWN PROJECT IS EXCLUDED. `role = 'customer'` on every
-- branch, matching every other count in this function. The founder's test
-- system is a renovation project; counting it would put a thumb on exactly the
-- trade we have the most of.
--
-- ── 2. A GATE AND A LABEL THAT WERE ALLOWED TO DISAGREE ──────────────────────
--
-- 20260821020000 documented the invariant in prose: `paid` is the gate
-- save_project_page reads, `stage` is where the customer is in the business,
-- and console_set_stage derives one from the other "so the two can never
-- disagree". They can. The RPC is one write path; the founder editing rows in
-- Supabase Studio is the other, and 20260818120000 says outright that flipping
-- `paid` by hand is how it was meant to work before the console existed.
--
-- One row is in that state right now: a customer project sitting at
-- stage = 'paid' with paid = false. The console shows it as paid, revenue_dev
-- counts it, and that customer CANNOT SAVE THEIR OWN PAGES, because the gate
-- reads the other column. Nothing surfaces the contradiction.
--
-- A prose invariant that only one of two write paths honours is not an
-- invariant. This makes it a constraint, so the by-hand path fails loudly
-- instead of producing a customer who is paid and locked out at the same time.

-- Repair before constraining: derive the gate from the stage, which is the same
-- direction console_set_stage has always derived it.
update public.projects
set paid = (stage in ('paid', 'building', 'live'))
where paid is distinct from (stage in ('paid', 'building', 'live'));

alter table public.projects drop constraint if exists projects_paid_matches_stage;
alter table public.projects add constraint projects_paid_matches_stage
  check (paid = (stage in ('paid', 'building', 'live')));

/**
 * The operating picture: one row, every number the console's header shows.
 *
 * Re-declared to add the module and shape counts. Every pre-existing key keeps
 * its exact meaning and query -- the console reads them by name.
 */
create or replace function public.console_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  select jsonb_build_object(
    'leads_total', (select count(*) from public.leads),
    'leads_analyzed', (select count(distinct lead_id) from public.analysis_results),
    'leads_converted', (select count(*) from public.accounts where lead_id is not null),
    -- The founder's own account is not a customer. Counting it would make the
    -- console's very first number wrong.
    'customers_total', (select count(*) from public.accounts where role = 'customer'),
    'customers_paid', (
      select count(*) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer' and p.paid
    ),
    -- Booked, not invoiced: the dev fee counts once a customer has paid, the
    -- monthly fee only once their system is actually running.
    'revenue_dev', coalesce((
      select sum(p.dev_fee_myr) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer' and p.stage in ('paid', 'building', 'live')
    ), 0),
    'revenue_monthly', coalesce((
      select sum(p.monthly_fee_myr) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer' and p.stage in ('building', 'live')
    ), 0),
    'by_stage', coalesce((
      select jsonb_object_agg(stage, n) from (
        select p.stage, count(*) as n
        from public.projects p
        join public.accounts a on a.id = p.account_id
        where a.role = 'customer'
        group by p.stage
      ) s
    ), '{}'::jsonb),

    -- What customers actually have. The strong signal: complete, and measured
    -- after they edited rather than at the moment the AI guessed.
    'modules_built', coalesce((
      select jsonb_object_agg(k, n) from (
        select pp.page_key as k, count(distinct pp.project_id)::int as n
        from public.project_pages pp
        join public.projects p on p.id = pp.project_id
        join public.accounts a on a.id = p.account_id
        where a.role = 'customer'
        group by pp.page_key
      ) s
    ), '{}'::jsonb),
    -- The denominator for modules_built: how many systems those counts are out
    -- of. Without it "payments: 3" is a number with no scale.
    'systems_counted', (
      select count(*) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer'
    ),

    -- What the AI proposed, and honestly how much of it we have. Never render
    -- the first of these three without the other two.
    'modules_proposed', coalesce((
      select jsonb_object_agg(k, n) from (
        select m->>'key' as k, count(*)::int as n
        from public.analysis_results ar,
             lateral jsonb_array_elements(ar.modules) m
        where ar.modules is not null
        group by m->>'key'
      ) s
    ), '{}'::jsonb),
    'analyses_total', (select count(*) from public.analysis_results),
    'analyses_with_modules', (
      select count(*) from public.analysis_results
      where modules is not null and jsonb_array_length(modules) > 0
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.console_overview() from anon;
grant execute on function public.console_overview() to authenticated;

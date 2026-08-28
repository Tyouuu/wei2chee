-- supabase/migrations/20260828040000_the_customer_can_see_the_stage.sql
--
-- 「客户要如何看到交互状态 就是我们在帮客户做他们的system的时候 客户是否要看到交付状态」
--
-- `stage` has existed since 20260821020000, with five values and an RPC that
-- moves a project along them. It has only ever been read by the founder's
-- console: `is_founder()` guards console_overview, console_customers and
-- console_project, and the customer's own home screen selects
-- `id, style, palette, paid, site_slug, site_published, layout` -- `paid`, the
-- GATE, and not `stage`, the answer to "where is my system".
--
-- So between paying and going live the customer has been looking at a screen
-- that knows the answer and does not say it. And the people this is being sold
-- to are renovation contractors, aircon installers, carpenters: the trades
-- whose own customers phone them every week asking exactly this question. They
-- know better than anyone what silence in that window means.
--
-- No RLS change is needed. `projects_select_own` is row-level; a customer
-- reading their own row already reads every column on it, `stage` included.
-- The only reason it was invisible is that nothing selected it.
--
-- ── WHY A TIMESTAMP, AND WHY NOT THE ONE ALREADY HERE ──────────────────────
--
-- A milestone with no date is a milestone that could have been set six weeks
-- ago, and reading one is worse than reading nothing: it looks like progress
-- while proving none. `updated_at` cannot answer it -- save_project_page
-- touches it every time the customer edits a block, so "BUILDING, updated two
-- minutes ago" would mean the customer typed something, not that anything was
-- built.
--
-- WHY NOT AN EXPECTED-COMPLETION DATE, which is the thing a customer actually
-- wants: because it would be a promise, and a promise nobody updates is a lie
-- with a date on it. The founder has no habit of maintaining one yet and there
-- is exactly one of him. "In this step since 27 Aug" is true without anyone
-- maintaining it, and it still answers the real question -- a date three weeks
-- old says more about a stalled build than any status word does.
--
-- Backfilled from `updated_at` rather than left null: null would render as an
-- em dash on every existing project, and "no date" reads as broken rather than
-- as unknown. It is the honest approximation -- for a project that has not
-- moved stage since it was created, the two are the same instant.

alter table public.projects
  add column if not exists stage_changed_at timestamptz;

update public.projects
set stage_changed_at = coalesce(updated_at, created_at)
where stage_changed_at is null;

/**
 * Moves a customer along the pipeline, and keeps `paid` in step.
 *
 * ONE CONTROL, NOT TWO. The founder should not have to remember that marking
 * someone "building" also means ticking a separate box before they can save
 * their own work. `paid` is derived here so the two can never disagree -- which
 * is the failure mode of every admin screen that exposes both, and which
 * 20260828010000 had to turn into a check constraint because prose was not
 * enough to stop the by-hand write path.
 *
 * Re-declared to stamp `stage_changed_at`. Only when the stage actually
 * CHANGES: re-selecting the same value in the console's dropdown is not an
 * event, and letting it reset the clock would quietly turn a three-week-old
 * stall into something that looks like it moved today.
 */
create or replace function public.console_set_stage(target_project_id uuid, new_stage text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  if new_stage not in ('designing', 'quoted', 'paid', 'building', 'live') then
    raise exception 'unknown stage: %', new_stage;
  end if;

  update public.projects
  set stage = new_stage,
      paid = (new_stage in ('paid', 'building', 'live')),
      stage_changed_at = case when stage is distinct from new_stage then now() else stage_changed_at end,
      updated_at = now()
  where id = target_project_id;

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.console_set_stage(uuid, text) from anon;
grant execute on function public.console_set_stage(uuid, text) to authenticated;

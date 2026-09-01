-- supabase/migrations/20260901020000_a_page_is_still_read_only.sql
--
-- 🔴 20260901010000 widened project_pages from read-only to `for all`, and
-- check:isolation caught it on the next run: 「A cannot write its own page
-- rows directly」 went red.
--
-- WHY THAT MATTERS, since a customer writing their OWN page sounds harmless.
-- It is not: project_pages is the one table in this schema that has never had
-- a write policy, because every write to it goes through save_project_page(),
-- and that function is where four rules live --
--
--   · an unpaid customer cannot save at all
--   · the previous version is copied into page_versions first
--   · the layout is validated before it lands
--   · the save is rate limited
--
-- A direct PostgREST write skips all four silently. The customer would still
-- be writing only their own row, and would still have destroyed their own
-- undo history doing it.
--
-- ⚠️ THE LESSON, written down because the same hand made the same move on six
-- tables at once: a policy rewrite must ask each table what its OLD policy
-- allowed, not give them all the widest one that fits the new predicate.
-- The other five were already insert/update/delete before today, so `for all`
-- matched them. This one never was.
--
-- Staff keep the read -- seeing the job list is the entire point of the role.
-- Saving a layout stays with the owner, because save_project_page() still asks
-- for `account_id = auth.uid()` and that is the right answer: a site
-- supervisor adding a customer is the feature; a site supervisor redesigning
-- the business's website is not.

drop policy if exists "project_pages_members" on public.project_pages;

create policy "project_pages_select_member" on public.project_pages
  for select using (public.works_here(project_id));

comment on table public.project_pages is
  'Read by anyone who works here; written ONLY through save_project_page(). There is deliberately no write policy -- see 20260901020000.';

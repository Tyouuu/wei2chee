-- supabase/migrations/20260830020000_a_lead_has_to_stay_deletable.sql
--
-- 20260830010000, an hour old, made a lead undeletable.
--
-- It added `lead_id ... on delete set null` and, separately, a constraint that
-- every row name an owner:
--
--     check (account_id is not null or lead_id is not null)
--
-- Both are right on their own and they fight. Deleting a lead tries to null
-- the ledger's `lead_id`, the row then has neither owner, and Postgres refuses
-- the whole delete:
--
--     new row for relation "ai_usage" violates check constraint
--     "ai_usage_has_an_owner"
--
-- Found by trying it, not by reading it -- the two clauses are eleven lines
-- apart in that file and I wrote both.
--
-- WHERE IT WOULD HAVE SURFACED: the founder tidying a test questionnaire out
-- of Supabase Studio, getting a constraint error naming a table he was not
-- touching. `check:isolation` and the console both delete rows too.
--
-- ── WHY CASCADE IS THE ANSWER AND NOT A CLIMBDOWN ─────────────────────────
--
-- The row means 「this questionnaire cost this much」. With the questionnaire
-- gone, what is left says 「somebody, once, spent 2,136 tokens」 -- which is
-- precisely the unattributable number `ai_usage_has_an_owner` exists to keep
-- out. Nulling the link does not preserve the fact, it destroys the fact and
-- keeps the row.
--
-- It is also what `account_id` has always done: `references auth.users(id) on
-- delete cascade`, since the table was created. A ledger where one owner
-- cascades and the other nulls has two rules for the same idea.
--
-- The cost history that matters -- what a MONTH of questionnaires cost -- is a
-- sum over rows nobody is deleting. Nothing here is an accounting record of
-- record; the OpenAI invoice is (see the price comment in lib/portal/ai-usage.ts).

alter table public.ai_usage
  drop constraint if exists ai_usage_lead_id_fkey;

alter table public.ai_usage
  add constraint ai_usage_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete cascade;

comment on constraint ai_usage_has_an_owner on public.ai_usage is
  'Every row names an account or a lead. Both foreign keys cascade, so deleting either owner takes its rows with it rather than leaving a number nobody can place.';

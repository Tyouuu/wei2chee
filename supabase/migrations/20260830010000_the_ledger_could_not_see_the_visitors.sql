-- supabase/migrations/20260830010000_the_ledger_could_not_see_the_visitors.sql
--
-- `ai_usage` has recorded nothing, ever. Not one row, on a product that has
-- run the questionnaire seventeen times.
--
-- ── WHY ───────────────────────────────────────────────────────────────────
--
-- `record_ai_usage` opens with:
--
--     if auth.uid() is null then
--       return;
--     end if;
--
-- and `/api/analyze` has no session, because the questionnaire is answered on
-- the LANDING PAGE by somebody who has not signed up yet. That is the whole
-- point of it: two minutes of talking about your business, and then you see
-- your system. Signing up comes after.
--
-- The misreading is written down in the table's own comment, from the day it
-- was created: 「'analyze' is the questionnaire at signup」. It is not at
-- signup. It is before it, and it is the only surface a stranger can reach.
--
-- So the most-run model call in the product -- the one that spends the
-- founder's OpenAI key without anybody logging in -- has been returning early
-- and silently for every visitor. `recordAiUsage` swallows errors on purpose,
-- correctly, so nothing has ever been printed either.
--
-- ── WHY THIS IS THE WORST TABLE FOR IT TO HAPPEN TO ───────────────────────
--
-- 20260827050000 added `outcome` for one stated reason: 「一本只记成功的帐，
-- 答不了『它是不是坏了』」. A ledger built to answer whether the AI still works
-- reported zero rows -- which reads as a quiet week, not as a broken wire.
-- It was the instrument, and the instrument was the thing that was broken.
--
-- ── THE FIX, AND WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────
--
-- The tempting one-liner is `grant execute ... to anon`. That is a spam hole
-- and this file will not do it. The function's own per-account ceiling reads
--
--     where account_id = auth.uid()
--
-- which counts nothing when there is no account, so granting it to anon would
-- hand the internet an unmetered writer into the founder's cost ledger.
--
-- Instead the anonymous call is written SERVER-SIDE with the service role,
-- from the route that already made it -- see lib/portal/ai-usage.ts. That path
-- is not reachable from a browser at all, so it needs no grant and adds no
-- surface. `/api/analyze` is already rate limited (checkRateLimit, line 128),
-- which is what protects the spending itself.
--
-- All this migration has to do is let the table hold a row that has no owner.
--
-- ── WHY lead_id AND NOT JUST A NULL ACCOUNT ───────────────────────────────
--
-- A row saying 「somebody, somewhere, spent 4,000 tokens」 is worth much less
-- than the same row naming WHICH questionnaire it was. The lead exists before
-- the model is called (route line 143), so the id costs nothing to carry, and
-- it is what makes 「一个线索花我们多少钱」 answerable later -- a question the
-- founder has already asked in another form.
--
-- One of the two must be present. A row attributable to neither an account nor
-- a lead is a number with no story, and this table has just spent three days
-- teaching us what unattributable silence is worth.

alter table public.ai_usage
  alter column account_id drop not null;

alter table public.ai_usage
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

comment on column public.ai_usage.account_id is
  'The signed-in customer, when there is one. Null for the questionnaire, which is answered before signup.';
comment on column public.ai_usage.lead_id is
  'The questionnaire this call belongs to. Set on anonymous analyze calls, where there is no account yet.';

-- Correcting the sentence that caused this. Comments are not decoration here;
-- this one described a fact about the system that was not true, and the guard
-- was written to match the comment rather than the product.
comment on column public.ai_usage.surface is
  '''analyze'' is the questionnaire on the landing page, answered BEFORE signup and therefore without a session. ''edit'' is a sentence typed into the editor. ''spec'' is the requirements document.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_usage_has_an_owner'
  ) then
    alter table public.ai_usage
      add constraint ai_usage_has_an_owner
      check (account_id is not null or lead_id is not null);
  end if;
end;
$$;

-- Asked as 「这个线索花了多少」, which scans by lead.
create index if not exists ai_usage_lead_idx
  on public.ai_usage (lead_id)
  where lead_id is not null;

-- A THIRD SURFACE SPENDS THE FOUNDER'S KEY, AND THE LEDGER HAD NEVER HEARD OF IT.
--
-- `ai_usage.surface` allows 'analyze' and 'edit'. Those were the two AI calls
-- anybody remembered. The system specification page (/portal/spec) makes a
-- third: it asks the model to write the prose around the customer's structure,
-- at the same reasoning effort as the other two, behind its own rate limit --
-- and it records nothing, because nobody adding the ledger went looking for a
-- caller outside app/api.
--
-- So the answer to 「这个功能花我多少钱」 was quietly missing a whole feature,
-- and would have stayed missing: a surface that is not in the check constraint
-- cannot even be recorded by mistake.

alter table public.ai_usage drop constraint if exists ai_usage_surface_check;
alter table public.ai_usage add constraint ai_usage_surface_check
  check (surface in ('analyze', 'edit', 'spec'));

comment on column public.ai_usage.surface is
  'analyze = the questionnaire at signup. edit = a sentence typed into the editor. spec = the prose on the build specification. Three different shapes of spending; a single total would hide which one is the expensive one.';

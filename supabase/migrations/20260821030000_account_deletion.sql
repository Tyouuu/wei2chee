-- supabase/migrations/20260821030000_account_deletion.sql
--
-- Lets a customer delete their own account.
--
-- WHY THIS IS NOT OPTIONAL. Malaysia's PDPA gives a data subject rights over
-- their personal data, every comparable product ships this, and a product that
-- can only be left by emailing the founder is a product people do not sign up
-- to in the first place. It was missing entirely: there was no delete path at
-- any layer.
--
-- WHY IT CASCADES RATHER THAN ANONYMISES. Everything this product holds about a
-- customer IS their personal data or their own work -- the questionnaire
-- answers, the AI analysis of their business, the pages they designed. There is
-- no analytics value left after stripping that, so "delete" means delete.
--
-- The auth.users row goes too, which is what actually revokes the ability to
-- sign in. `accounts.id` references it on delete cascade (migration
-- 20260818120000), so removing the auth row removes the account, the project,
-- its pages and its version history in one statement.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  -- The founder deleting their own account would remove the only route into
  -- the console and leave the business with no operator. Refused here rather
  -- than hidden in the UI, so it holds however the function is reached.
  select role into caller_role from public.accounts where id = caller;
  if caller_role = 'founder' then
    raise exception 'the founder account cannot be deleted from here';
  end if;

  -- The lead is deliberately KEPT. It carries no account identity once the
  -- account is gone (accounts.lead_id is the only link and it disappears with
  -- the row), and it is the record of a questionnaire answered by someone who
  -- may not have been this person -- a shared device, a colleague. Deleting it
  -- would also silently rewrite the founder's own conversion history.
  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

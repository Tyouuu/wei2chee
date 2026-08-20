-- supabase/migrations/20260821010000_founder_role.sql
--
-- Gives the product a concept of "the person who runs it".
--
-- WHY THIS DID NOT EXIST, AND WHY THAT WAS A REAL GAP. The v1 spec said a
-- Supabase table edit was sufficient for marking a project paid, and it was
-- taken literally: there is no `role`, no `admin`, no `is_founder` anywhere in
-- the schema. The consequence was never written down anywhere the founder could
-- see it — he runs the business out of Supabase Studio. Concretely, today:
--
--   * ten questionnaire leads and five AI analyses sit in this database and
--     there is no screen in the product that shows any of them
--   * when a customer messages "build my system", the founder CANNOT SEE
--     WHAT THEY DESIGNED — /portal/spec resolves the project from auth.uid()
--     and RLS restricts project_pages to its owner, so the only view is raw
--     layout_json in a table editor
--   * marking a customer paid means finding a row by email and editing a cell
--
-- That last one is a documented v1 tradeoff. The middle one is a broken step in
-- the core revenue flow (the RM5,000 handoff), not a convenience gap.
--
-- WHY A COLUMN ON accounts AND NOT A SEPARATE TABLE. There is exactly one
-- founder and there will be exactly one; a join table would be ceremony. The
-- check constraint keeps the value from drifting into free text.
--
-- WHY `is_founder()` IS security definer. RLS policies and the console's own
-- RPCs need to ask "is the caller the founder" while reading a table whose RLS
-- would otherwise be the thing being decided. Resolving auth.uid() inside the
-- function means no caller ever passes an identity in — the same discipline
-- every other RPC in this schema follows.

alter table public.accounts
  add column if not exists role text not null default 'customer';

alter table public.accounts
  drop constraint if exists accounts_role_check;
alter table public.accounts
  add constraint accounts_role_check check (role in ('customer', 'founder'));

/**
 * True when the caller is the founder.
 *
 * NOT a security boundary on its own — it is the boundary that every console
 * policy and RPC is written against. A client can call it and learn a boolean
 * about itself, which is exactly what the shell needs to decide whether to draw
 * a link, and is not information worth hiding.
 */
create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid() and role = 'founder'
  );
$$;

revoke execute on function public.is_founder() from anon;
grant execute on function public.is_founder() to authenticated;

-- The founder can read every account. Additive: `accounts_select_own` (or
-- whatever the original policy is named) still governs customers, and Postgres
-- ORs permissive policies together, so this widens the founder's view without
-- touching anyone else's.
drop policy if exists accounts_select_founder on public.accounts;
create policy accounts_select_founder on public.accounts
  for select using (public.is_founder());

-- supabase/migrations/20260829010000_a_built_in_page_cannot_freeze_its_name.sql
--
-- 20260826030000 fixed this and the fix has never run.
--
-- That migration's header says it "re-declares the provisioning trigger from
-- 20260822040000 with ONE line changed", and the logic in it is right: a
-- built-in page stores NO title, so the catalogue supplies its word in the
-- system's own language. But it wrote that logic into a NEW function,
-- `provision_project_pages()`, which inserts only into project_pages -- it
-- creates neither the account nor the project -- and nothing was ever attached
-- to it. The trigger that actually runs is still `on_auth_user_created` on
-- `auth.users`, executing `handle_new_account()`, with the old body.
--
-- So since 2026-08-26 every signup has frozen the analysis's label into
-- `project_pages.title` for built-ins as well.
--
-- WHAT IT LOOKS LIKE FROM THE OUTSIDE, because this is not abstract: a salon
-- signs up in English and its navigation reads
--
--     Dashboard · Clients · Payments · Bookings · Commission · Stylists · 官网
--
-- Six English words the analysis produced, and one Chinese one -- because
-- `website` is a built-in whose word the catalogue holds in both languages, and
-- a stored title always beats the catalogue. The customer's system speaks
-- English (`projects.system_language = 'en'`); one item in their own sidebar
-- does not.
--
-- WHY NOBODY SAW IT. A title is written once, at provisioning, so it can only
-- be wrong on an account created after the break -- and both seeded demo
-- accounts predate it. Theirs are null, correctly. The first account created
-- since was made today, by scripts/preview-for.mjs, which is what surfaced it.
--
-- ── WHY A TABLE TRIGGER AND NOT A FIX TO THE CALLER ────────────────────────
--
-- The obvious repair is to re-point `on_auth_user_created` at the fixed
-- function. It cannot be done: that trigger is on `auth.users` and its function
-- creates the account and the project as well; `provision_project_pages()` does
-- neither, so pointing at it would break signup outright. The other obvious
-- repair is to re-declare `handle_new_account()` with the one line changed --
-- which is what was attempted three days ago, into the wrong name.
--
-- So the rule goes on the TABLE. Whoever writes a page -- today's function,
-- the one that was meant to replace it, `add_project_page`, a console tool, a
-- future import -- a built-in cannot carry a stored name. It is the same shape
-- as the paid/stage trigger added yesterday, and for the same reason: an
-- invariant that lives in one of several writers is not an invariant.
--
-- A page the catalogue has NO word for -- 「员工排班」, something the analysis
-- invented -- keeps its title, which is the whole point of the column. And a
-- customer renaming a page for themselves is an UPDATE, untouched here: this
-- only stops provisioning from writing a name nobody chose.

create or replace function public.built_in_pages_keep_no_title()
returns trigger
language plpgsql
as $$
begin
  if new.page_key in (
    'dashboard', 'customers', 'payments',
    'quotations', 'orders', 'bookings', 'projects', 'tasks',
    'reconciliation', 'commission', 'expenses', 'reports',
    'ranking', 'suppliers', 'staff', 'inventory',
    'website'
  ) then
    new.title := null;
  end if;
  return new;
end;
$$;

drop trigger if exists project_pages_built_in_title on public.project_pages;
create trigger project_pages_built_in_title
  before insert on public.project_pages
  for each row execute function public.built_in_pages_keep_no_title();

-- Repair what was provisioned while the fix was sitting in an unused function.
update public.project_pages
set title = null
where title is not null
  and page_key in (
    'dashboard', 'customers', 'payments',
    'quotations', 'orders', 'bookings', 'projects', 'tasks',
    'reconciliation', 'commission', 'expenses', 'reports',
    'ranking', 'suppliers', 'staff', 'inventory',
    'website'
  );

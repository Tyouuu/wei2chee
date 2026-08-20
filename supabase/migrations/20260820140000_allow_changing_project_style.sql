-- supabase/migrations/20260820140000_allow_changing_project_style.sql
--
-- Lets a customer change their system's visual style after picking it.
--
-- WHY: `set_project_style` deliberately enforces one-time-only -- it updates
-- only `where style is null` and raises otherwise. That was a defensible rule
-- while the three styles differed by hue alone: picking "wrong" cost almost
-- nothing, because they all looked the same.
--
-- That is no longer true. As of 2026-08-20 the three styles differ in font
-- family, corner radius, row density, accent, background temperature and
-- border/shadow language (design-system/tokens/*.css). Getting locked into the
-- wrong one now means running a business system that looks nothing like what
-- the owner wanted, chosen irreversibly from three unfamiliar names before they
-- had ever seen their own data in any of them.
--
-- `set_project_style` is left EXACTLY as it was. It is the onboarding step's
-- function and its "already set" error is what /portal/style-select maps to a
-- real message; changing its semantics would quietly change that page's
-- behaviour. This is a second, separate function for a genuinely different
-- action -- first choice versus later change -- rather than a loosened version
-- of the first.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Same three-value guard set_project_style uses, and the same one
  -- projects.style's own check constraint enforces. Duplicated on purpose: a
  -- caller should get a clear "invalid style" rather than a constraint
  -- violation from three layers down.
  if new_style not in ('ledger', 'hearth', 'blueprint') then
    raise exception 'invalid style: %', new_style;
  end if;

  -- No `style is null` clause -- that is the whole difference. Still scoped to
  -- the caller's own project via auth.uid(), with no project id accepted from
  -- the caller, so this cannot restyle anyone else's system.
  --
  -- Deliberately does NOT require style to be already set: a caller who
  -- somehow reaches this before the onboarding step still ends up with a valid
  -- style rather than an error, which is the better outcome of the two.
  update public.projects
  set style = new_style, updated_at = now()
  where account_id = auth.uid();

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.update_project_style(text) from public;
grant execute on function public.update_project_style(text) to authenticated;

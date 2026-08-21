-- supabase/migrations/20260821060000_update_project_palette.sql
--
-- The palette setter for the change-later path.
--
-- Split out of 20260821050000 rather than appended to it, because that file was
-- already applied: the migration runner tracks by filename, so editing an
-- applied file changes the repo and not the database -- a difference that shows
-- up as a working local build and a 404 RPC in production.

-- ---------------------------------------------------------------------------
-- Changing it later
-- ---------------------------------------------------------------------------
-- The sibling of update_project_style (20260820140000), for the same reason
-- that one exists separately from set_project_style: choosing during onboarding
-- and changing afterwards are different actions with different preconditions,
-- and collapsing them means the stricter one loses its guard.
--
-- NULL is a legitimate argument here and means 「用这个版式自己的颜色」 --
-- the native pairing Ledger, Hearth and Blueprint were each designed with. It
-- is a choice a customer makes, not an absence, which is why there is no
-- separate "clear" flag on this one: the styles page has a real card for it.
create or replace function public.update_project_palette(new_palette text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_palette is not null and new_palette not in (
    'supabase', 'vercel', 'claude', 'amber-minimal', 'nature',
    'ocean-breeze', 'vintage-paper', 'clean-slate', 'mocha-mousse', 'graphite'
  ) then
    raise exception 'invalid palette: %', new_palette;
  end if;

  -- Scoped to the caller's own project via auth.uid(), with no project id
  -- accepted from the caller, so this cannot recolour anyone else's system.
  update public.projects
  set palette = new_palette, updated_at = now()
  where account_id = auth.uid();

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.update_project_palette(text) from public;
grant execute on function public.update_project_palette(text) to authenticated;

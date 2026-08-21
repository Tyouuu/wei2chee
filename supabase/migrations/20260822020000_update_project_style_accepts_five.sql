-- supabase/migrations/20260822020000_update_project_style_accepts_five.sql
--
-- The previous migration widened `projects.style`'s constraint, the industries
-- constraint and `set_project_style` to five 版式 -- and missed the one the
-- product actually calls.
--
-- There are TWO functions that change a style. `set_project_style`
-- (20260821050000) takes a palette too and was the obvious one to patch.
-- `update_project_style` (20260820140000) is the older, style-only sibling, and
-- it is the one `style-switcher.tsx` and the styles page call. Pressing 「换成
-- 这个」 on Docket therefore returned 400 `invalid style: docket` while the UI,
-- which updates optimistically, showed it as 使用中. The system stayed Blueprint.
--
-- Caught by watching the network while clicking the real button, not by
-- reading the code -- both functions look correct in isolation, and the
-- migration that renamed the caller is a different file from either of them.
--
-- The duplicated list is deliberate for the reason the original file gives: a
-- caller should get "invalid style" rather than a constraint violation from
-- three layers down. The cost of that choice is exactly this bug, so the list
-- now lives in one migration per release rather than being edited in place.

create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket') then
    raise exception 'invalid style: %', new_style;
  end if;

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

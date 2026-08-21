-- supabase/migrations/20260822030000_three_more_styles.sql
--
-- 版式 five to eight: `large`, `stamp`, `contract`.
--
-- All three sit on axes the first five do not use, which is the whole reason
-- they are registers and not another notch on the density slider:
--
--   large     TYPE SCALE. 17px body, 56px rows, 1.75 leading, nothing under
--             13px anywhere. Not "roomier" -- a different intended reader. An
--             owner in their sixties reading on a phone in a van is the most
--             common user in this market and nothing else is designed for him.
--   stamp     HEADER TREATMENT. A solid accent band across every table head
--             with white type in it, the way the POS and accounting packages
--             this market already runs all draw a list of records.
--   contract  SERIF BODY, Latin and Chinese alike, wide leading, 2px radius.
--             Reads as a printed agreement rather than as software.
--
-- FOUR PLACES, and the count is the point. 20260822020000 exists only because
-- the release before it widened three of them and missed `update_project_style`
-- -- the one 「换成这个」 actually calls -- so Docket returned 400 while the
-- optimistic UI showed 使用中. Both functions are updated here, in one file, so
-- there is one place to read and one place to get wrong.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract') then
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

-- The style-and-palette sibling. Signature copied verbatim from
-- 20260822010000 -- three arguments, not two: `create or replace` matches on
-- the argument list, so a two-argument version would be a NEW overload sitting
-- beside the real one with no palette validation and no clear_palette. The
-- body is unchanged apart from the style list.
create or replace function public.set_project_style(
  new_style text,
  new_palette text default null,
  clear_palette boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract') then
    raise exception 'invalid style: %', new_style;
  end if;

  if new_palette is not null and new_palette not in (
    'supabase', 'vercel', 'claude', 'amber-minimal', 'nature',
    'ocean-breeze', 'vintage-paper', 'clean-slate', 'mocha-mousse', 'graphite'
  ) then
    raise exception 'invalid palette: %', new_palette;
  end if;

  update public.projects
  set style = new_style,
      palette = case
        when clear_palette then null
        when new_palette is not null then new_palette
        else palette
      end,
      updated_at = now()
  where account_id = auth.uid();
end;
$$;

revoke execute on function public.set_project_style(text, text, boolean) from anon;
grant execute on function public.set_project_style(text, text, boolean) to authenticated;

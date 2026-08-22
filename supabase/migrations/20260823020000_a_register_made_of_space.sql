-- supabase/migrations/20260823020000_a_register_made_of_space.sql
--
-- Adds 墨 (Ink) -- the second register added because a MEASUREMENT said the set
-- was missing something. 粗野 was the WEIGHT axis; this is the SPACE axis.
--
-- WHAT THE MEASUREMENT WAS, 2026-08-23, over all eleven token files:
--
--     --pad-card    14 16 18 18 20 20 22 24 24        (nothing above 24)
--     --row-h       32 32 36 40 42 46 48 50 52 54 56  (nothing above 56)
--     --text-base   13 13 13 14 15 15 15 15 15 15 17
--
-- Colour, radius, border width and elevation were all well spread by then.
-- Every register was still a normal-density business tool -- there was no
-- spacious one, the way there had been no heavy one. This is pad-card 40 and
-- row-h 76: half again looser than the loosest thing already here.
--
-- IT IS ALSO THE FIRST REGISTER IN THE SET DRAWN FROM A CHINESE BRIEF. The
-- other eleven are Swiss, Bauhaus, blueprint, docket, contract, Neo-Brutalism
-- -- all Western. This product's customers are Malaysian-Chinese SME owners,
-- and 水墨 is the one brief out of seventy-three that is theirs. See
-- design-system/tokens/ink.css for the whole argument.
--
-- Structure copied from 20260822070000 rather than edited into it: the runner
-- tracks by filename, so editing an applied file changes the repo and not the
-- database. One value appended to every list, and all three places updated in
-- one file -- the release before 粗野 widened the constraint and missed
-- `update_project_style`, so the UI showed 使用中 over a 400.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink') then
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

-- The style-and-palette sibling. Signature copied verbatim -- three arguments,
-- not two: `create or replace` matches on the argument list, so a two-argument
-- version would be a NEW overload sitting beside the real one with no palette
-- validation and no clear_palette.
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink') then
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

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.set_project_style(text, text, boolean) from public;
grant execute on function public.set_project_style(text, text, boolean) to authenticated;

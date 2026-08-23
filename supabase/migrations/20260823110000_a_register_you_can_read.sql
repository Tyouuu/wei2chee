-- supabase/migrations/20260823110000_a_register_you_can_read.sql
--
-- Adds 清 (Clear), and fixes a real accessibility fault found in the same
-- audit.
--
-- THREE ENDS OF THREE AXES, ALL EMPTY, across the twenty registers:
--
--   --text-base       13 x4  14  15 x10  17 x2      nothing above 17
--   --pad-control-y   5 x6  8 x5  10 x5  12 x2      no target taller than ~41px
--   dim text on card  3.89 5.15 5.26 ... 7.73       only 4 of 20 reach 7:1
--
-- Every register in this set was designed by somebody who can read 13px grey
-- on white. A Malaysian SME is very often run by a person in their fifties or
-- sixties, on a phone, in a shop with the light behind them.
--
-- IT IS NOT ANOTHER 大字. That register and 墨 are about AIR. This is about
-- being able to read it, and its row height is deliberately SHORTER than 墨's:
-- a page that shows four rows instead of eight helps nobody who is squinting.
--
-- AND THE SAME AUDIT FOUND 柔和's SECONDARY TEXT AT 3.89:1 against its own
-- card -- below AA, the worst of the twenty, and shipped since the register was
-- written. Moved to #5b6478 at 5.11:1, which keeps its cool cast.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile', 'clear'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile', 'clear'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile', 'clear') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile', 'clear') then
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

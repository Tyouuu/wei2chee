-- supabase/migrations/20260823080000_a_register_whose_ground_is_a_colour.sql
--
-- Adds 漆 (Lacquer), the first register that puts colour anywhere other than a
-- button.
--
-- WHAT THE MEASUREMENT SAID, saturation as (max-min)/max across all seventeen:
--
--     accent   0.11 .. 1.00     the whole range is used
--     canvas   0.00 .. 0.19     (夜 reads 0.435 but at 0.005 luminance, which
--     card     0.00 .. 0.16      is a near-black blue grey, not a colour)
--
-- Seventeen registers and every one a NEUTRAL PAGE WITH A COLOURED BUTTON.
-- Colour had only ever been allowed on the smallest thing on screen, and that
-- is the first thing a customer names when they say a system looks like theirs.
--
-- THE GROUND, NOT THE CARD. A saturated card is a saturated reading surface,
-- and this is a system somebody sits in front of all day. The panels stay
-- ivory; the page they sit on carries the colour. The contrast where the text
-- is never changes.
--
-- For restaurants, tea houses, bakeries, gold and jewellery, wedding and temple
-- supply -- businesses whose own shopfront is already a colour, and for whom a
-- white page with a coloured button looks like somebody else's software.
--
-- Ground and panels are @structural. The ACCENT still follows the palette, so
-- 漆 + 青绿 is a jade lacquer rather than an oxblood one -- which is exactly
-- the variation this register should have.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer') then
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

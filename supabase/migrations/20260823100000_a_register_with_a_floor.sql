-- supabase/migrations/20260823100000_a_register_with_a_floor.sql
--
-- Adds 砖 (Tile), the first register whose ground is a repeating FIGURE.
--
-- --canvas-image has been on every register since the surface vocabulary was
-- built and exactly two have ever set it: 玻璃 with three radial fields and 夜
-- with one low pool of light. Both are WASHES. A wash is atmosphere; a pattern
-- is a material with a history, and nothing had one.
--
-- The other measurement: sixteen of nineteen registers sit above 0.82
-- luminance. The near-white end is where everything already is, so a twentieth
-- near-white page needs a reason that is not colour. A floor is one.
--
-- The figure is a 48px SVG tile -- a four-petal shape with a diamond at each
-- corner, the bones of the Peranakan floor tiles in every old kopitiam and
-- shophouse in Malacca and Penang. Drawn rather than photographed: it repeats
-- seamlessly, costs a few hundred bytes, and needs no network request.
--
-- THE PANELS STAY PLAIN, which is the rule 漆 established. A pattern under
-- text is the fastest way to make a system unreadable, so the figure is on the
-- ground and every card is flat cream.
--
-- For kopitiam, bakeries, kaya toast, heritage cafes, herbal shops and tea
-- merchants -- businesses whose premises already have this floor.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code', 'tile') then
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

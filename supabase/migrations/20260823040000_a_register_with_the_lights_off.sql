-- supabase/migrations/20260823040000_a_register_with_the_lights_off.sql
--
-- Adds 夜 (Night) -- the register that fills the last axis with nothing on one
-- end of it.
--
-- WHAT THE MEASUREMENT WAS, 2026-08-23, canvas luminance across all thirteen:
--
--     0.823 0.855 0.856 0.880 0.881 0.900 0.903 0.904 0.905 0.925 0.927
--     0.949 0.965
--
-- Thirteen registers between 0.82 and 0.97. Every page this product could
-- build was a white page with different furniture on it. Same shape of gap the
-- weight audit found before 粗野 and the space audit found before 墨.
--
-- It is also an answer to 「各行各业」. A car workshop, a photo studio, a gym, a
-- bar, an events company, a print shop -- trades whose customers judge them on
-- how things LOOK -- had no register here that looked like them.
--
-- Derived from ledger.css rather than from a soft one on purpose: this has to
-- survive eight hours of somebody entering quotations, so it is a console, not
-- a dark marketing page. Density, radius, type and row height are Ledger's
-- exactly; the one move is the ground.
--
-- Every surface and every ink is @structural. The 配色 layer repaints colour
-- after the register, which is right for thirteen light registers -- here a
-- palette that repaints the ground light does not restyle 夜, it deletes it,
-- and repaints the ground without repainting the white text. The ACCENT still
-- follows the palette.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night') then
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

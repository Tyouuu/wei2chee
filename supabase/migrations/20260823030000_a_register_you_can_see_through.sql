-- supabase/migrations/20260823030000_a_register_you_can_see_through.sql
--
-- Adds 玻璃 (Glass) -- the third register added because a MEASUREMENT said the
-- set was missing something, and the first one that needed the TOKEN LAYER to
-- learn a new word before it could exist.
--
-- 粗野 was the WEIGHT axis. 墨 was the SPACE axis. This is not an axis at all:
-- it is a whole vocabulary the twelve did not have.
--
-- WHAT THE MEASUREMENT WAS, 2026-08-23, across all twelve token files:
--
--     backdrop-filter 0   radial/conic gradient 0   noise 0   animation 0
--     text-shadow 0   mix-blend 0   dashed border 0   outline 0
--
-- Meanwhile --radius-md already had ten distinct values and --row-h eleven. The
-- numbers were spread wide; the vocabulary was four words -- a colour, a
-- radius, a border width, a typeface. Twelve registers said in four words read
-- as twelve variations of one thing, which is what the founder meant by
-- 「我不要很大同小异」. A thirteenth in the same four words would have been a
-- thirteenth variation.
--
-- So app/globals.css grew four surface classes and every register grew four
-- tokens -- --surface-image, --surface-blur, --surface-border-style,
-- --canvas-image -- all inert by default. 玻璃 is the first register that says
-- something the old four words could not: cards at 55% white that genuinely
-- blur what is behind them, over a ground of three soft colour fields.
--
-- See design-system/tokens/glass.css for the whole argument, including why
-- three of its tokens are @structural and outrank the palette.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass') then
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

-- supabase/migrations/20260823050000_a_register_you_can_feel.sql
--
-- Adds 粒 (Grain) -- the register that says the one word in the surface
-- vocabulary nothing had said yet.
--
-- After 玻璃 the set had three surface kinds available and two in use: thirteen
-- registers FLAT, one GLASS, and --surface-image with no register using it at
-- all. This is the textured one: real feTurbulence noise on the ground and
-- slightly more of it on every card, so a card reads as a separate sheet laid
-- on the page rather than a hole cut in it.
--
-- IT IS THE THIRD PAPER REGISTER AND THE ONLY SANS ONE. 印 is a carbon-copy
-- invoice book (Song serif, 2px rules, 13px on 32px rows -- a FORM). 墨 is a
-- sheet of Xuan paper (serif, 40px padding, 17px on 76px rows -- a PAGE). 粒 is
-- a risograph print: humanist sans, 1px rules, one flat blue, and a surface you
-- can see. Derived from 瑞士 for exactly that reason, not from either paper
-- register.
--
-- Both textures are @structural. The 配色 layer repaints COLOUR, which is
-- right, and grain is not colour -- without this, choosing any palette would
-- silently return this register to 瑞士. Ground, ink and accent still follow
-- the palette, so 粒 + 青绿 is a green risograph rather than a blue one.
--
-- The noise is an inline feTurbulence data URI: a few hundred bytes rather
-- than a few hundred kilobytes, tiles seamlessly at any size, and costs no
-- network request on a page a Malaysian customer opens over mobile data.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain') then
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

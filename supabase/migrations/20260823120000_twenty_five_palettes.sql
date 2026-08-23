-- The 配色 layer goes from ten to twenty-five, and four of the ten leave.
--
-- WHY THE FOUR LEAVE. scripts/build-palettes.mjs now reports the pairwise hue
-- spread of everything it ships, and the first run of that report found four
-- palettes that were another palette under a different name:
--
--     sunset-horizon  H 35 C 0.164   against tangerine       H 36 C 0.172
--     solar-dusk      H 49 C 0.145   against claude          H 39 C 0.138
--     ocean-breeze    H150 C 0.192   against northern-lights H150 C 0.154
--     midnight-bloom  H283 C 0.202   against clean-slate     H277 C 0.204
--
-- and that two of the ten names were false. tweakcn's ocean-breeze has a GREEN
-- primary at hue 150 and shipped here as 海蓝, sea blue -- so a boat or seafood
-- business choosing it by name got a green system. clean-slate is a saturated
-- indigo at chroma 0.204, not the 石板灰 it was called; it stays, renamed 群青.
--
-- WHAT REPLACES THEM. Sixteen more from tweakcn, chosen off a gap map of the
-- hue wheel -- the old ten had NO red at all, which for a set aimed at
-- Chinese-Malaysian businesses is not restraint but an oversight nothing was
-- measuring -- and three written by hand (gold-grain, turquoise-stone,
-- rosewood) for the bands none of tweakcn's forty themes occupies.
--
-- Mirrors the filenames in design-system/palettes/ and lib/portal/
-- palettes.generated.ts. All three must agree: a value here with no CSS class
-- renders as the layout's native colours with no error, which is a silently
-- wrong system rather than a broken one.

-- ---------------------------------------------------------------------------
-- The rows move first
-- ---------------------------------------------------------------------------
-- add constraint validates what is already in the table, so a project still
-- sitting on one of the four that left would block the whole migration. They
-- are cleared to NULL, which renders the register's own native colours -- a
-- deliberate fallback rather than a silent remap to "the nearest colour",
-- because nobody chose the nearest colour.
update public.projects
   set palette = null
 where palette in ('sunset-horizon', 'solar-dusk', 'ocean-breeze', 'midnight-bloom');

update public.industries
   set palette_recommendation = null
 where palette_recommendation in ('sunset-horizon', 'solar-dusk', 'ocean-breeze', 'midnight-bloom');

-- ---------------------------------------------------------------------------
-- The constraints
-- ---------------------------------------------------------------------------
alter table public.projects
  drop constraint if exists projects_palette_check;

alter table public.projects
  add constraint projects_palette_check
  check (
    palette is null
    or palette in (
      'elegant-luxury', 'neo-brutalism', 't3-chat', 'bubblegum',
      'tangerine', 'claude', 'mocha-mousse', 'caffeine',
      'amber-minimal', 'vintage-paper', 'gold-grain', 'kodama-grove',
      'nature', 'northern-lights', 'supabase', 'turquoise-stone',
      'perpetuity', 'twitter', 'modern-minimal', 'starry-night',
      'clean-slate', 'amethyst-haze', 'rosewood', 'vercel', 'graphite'
    )
  );

alter table public.industries
  drop constraint if exists industries_palette_recommendation_is_real;

alter table public.industries
  add constraint industries_palette_recommendation_is_real
  check (
    palette_recommendation is null
    or palette_recommendation in (
      'elegant-luxury', 'neo-brutalism', 't3-chat', 'bubblegum',
      'tangerine', 'claude', 'mocha-mousse', 'caffeine',
      'amber-minimal', 'vintage-paper', 'gold-grain', 'kodama-grove',
      'nature', 'northern-lights', 'supabase', 'turquoise-stone',
      'perpetuity', 'twitter', 'modern-minimal', 'starry-night',
      'clean-slate', 'amethyst-haze', 'rosewood', 'vercel', 'graphite'
    )
  );

-- ---------------------------------------------------------------------------
-- The two setters
-- ---------------------------------------------------------------------------
-- Both carry the list in their own body. create or replace matches on the
-- argument list, so each signature is copied verbatim from the migration that
-- last defined it -- a changed argument list creates a NEW overload sitting
-- beside the real one, with the old shorter allow-list still in it.
create or replace function public.update_project_palette(new_palette text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_palette is not null and new_palette not in (
    'elegant-luxury', 'neo-brutalism', 't3-chat', 'bubblegum',
    'tangerine', 'claude', 'mocha-mousse', 'caffeine',
    'amber-minimal', 'vintage-paper', 'gold-grain', 'kodama-grove',
    'nature', 'northern-lights', 'supabase', 'turquoise-stone',
    'perpetuity', 'twitter', 'modern-minimal', 'starry-night',
    'clean-slate', 'amethyst-haze', 'rosewood', 'vercel', 'graphite'
  ) then
    raise exception 'invalid palette: %', new_palette;
  end if;

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
    'elegant-luxury', 'neo-brutalism', 't3-chat', 'bubblegum',
    'tangerine', 'claude', 'mocha-mousse', 'caffeine',
    'amber-minimal', 'vintage-paper', 'gold-grain', 'kodama-grove',
    'nature', 'northern-lights', 'supabase', 'turquoise-stone',
    'perpetuity', 'twitter', 'modern-minimal', 'starry-night',
    'clean-slate', 'amethyst-haze', 'rosewood', 'vercel', 'graphite'
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

-- ---------------------------------------------------------------------------
-- What each trade opens with
-- ---------------------------------------------------------------------------
-- A default removes work; it does not remove choice. Every one of these is one
-- click from any of the twenty-five, and the picker shows all of them.
--
-- With ten palettes these were seven picks out of a set that had no red at all,
-- so 装修 opened on a cold indigo and 餐饮 on a terracotta because those were
-- the warmest things available. With twenty-five, each trade can open on the
-- colour the trade actually uses on its own signboard.
update public.industries set palette_recommendation = 'caffeine'        where slug = 'renovation';
update public.industries set palette_recommendation = 'graphite'        where slug = 'wholesale';
update public.industries set palette_recommendation = 'modern-minimal'  where slug = 'services';
update public.industries set palette_recommendation = 'rosewood'        where slug = 'beauty';
update public.industries set palette_recommendation = 'turquoise-stone' where slug = 'education';
update public.industries set palette_recommendation = 'elegant-luxury'  where slug = 'fnb';
update public.industries set palette_recommendation = 'tangerine'       where slug = 'retail';
-- 'other' deliberately stays NULL: with no trade to reason from, the layout's
-- own colours are a better default than a guess.

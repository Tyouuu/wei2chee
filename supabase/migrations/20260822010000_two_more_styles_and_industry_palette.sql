-- supabase/migrations/20260822010000_two_more_styles_and_industry_palette.sql
--
-- TWO THINGS, both answers to the same complaint: 「就是一套的设计token 只是他
-- 们可能要细改跟换颜色而已」.
--
-- 1. TWO MORE 版式, and they are not another position on the density slider.
--    Ledger, Hearth and Blueprint differ on 46 structural tokens and every one
--    of those differences sits on one axis -- how tight and how round a card
--    is -- with Blueprint landing on the arithmetic midpoint of the other two
--    for text size, radius, cell padding and control height. Three styles, one
--    idea. `bare` drops the card entirely (no border, no shadow, card surface
--    equals the page) and `docket` makes it a printed form (zero radius
--    everywhere, 2px rules, uppercase tracked labels, stamp red). Those are
--    different sentences, not different volumes.
--
-- 2. `industries.palette_recommendation`, the fourth layer of "the ready-made
--    design for this trade" -- and the only one that did not exist. Vocabulary
--    is per-industry, pages are per-industry, and `style_recommendation` has
--    been per-industry since 20260820120000. The palette never was:
--    `projects.palette` is always NULL at provisioning, so a renovation
--    contractor and a wholesaler open their systems in the same colours.
--
--    A customer who does not want to design anything should get their trade's
--    ready-made answer. That is not taking the choice away -- they can still
--    change all of it -- it is not making them make it.
--
-- The style lists are duplicated in three places by design (this constraint,
-- industries' own constraint, and set_project_style's guard) because a check
-- constraint cannot reference a function. app/[locale]/style-picker/
-- style-scope.module.css is generated from design-system/tokens/*.css and
-- guarded by style-scope.sync.test.ts, so the CSS side cannot drift; these
-- three are the SQL side of the same contract.

-- 1 ---------------------------------------------------------------- 版式

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket'));

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
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket') then
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

-- 2 ---------------------------------------------------------------- 配色

alter table public.industries
  add column if not exists palette_recommendation text;

comment on column public.industries.palette_recommendation is
  'The 配色 a business in this trade opens with. NULL means the recommended layout''s own native colours. Mirrors lib/portal/palettes.ts and the projects_palette_check constraint.';

alter table public.industries
  drop constraint if exists industries_palette_recommendation_is_real;

alter table public.industries
  add constraint industries_palette_recommendation_is_real
  check (
    palette_recommendation is null
    or palette_recommendation in (
      'supabase', 'vercel', 'claude', 'amber-minimal', 'nature',
      'ocean-breeze', 'vintage-paper', 'clean-slate', 'mocha-mousse', 'graphite'
    )
  );

-- Paired with each trade's recommended layout, not chosen independently: a
-- palette only changes hue, so it has to sit on a layout that already suits the
-- work. Renovation and wholesale keep Ledger and take the two most neutral
-- palettes, because their screens are money and dates. Beauty and education
-- keep Hearth and take the warm ones. Retail keeps Blueprint.
update public.industries set palette_recommendation = 'clean-slate' where slug = 'renovation';
update public.industries set palette_recommendation = 'vercel'      where slug = 'wholesale';
update public.industries set palette_recommendation = 'supabase'    where slug = 'services';
update public.industries set palette_recommendation = 'claude'      where slug = 'beauty';
update public.industries set palette_recommendation = 'nature'      where slug = 'education';
update public.industries set palette_recommendation = 'claude'      where slug = 'fnb';
update public.industries set palette_recommendation = 'ocean-breeze' where slug = 'retail';
-- 'other' deliberately stays NULL: with no trade to reason from, the layout's
-- own colours are a better default than a guess.

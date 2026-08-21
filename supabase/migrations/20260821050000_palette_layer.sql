-- supabase/migrations/20260821050000_palette_layer.sql
--
-- Splits "style" into the two decisions it has always been.
--
-- WHY: a customer could pick from three styles, and the founder has asked in
-- several rounds how to reach 21st.dev's sense of variety without running a
-- marketplace. Measured on the three token files, 52 of ~125 tokens are
-- STRUCTURE -- type scale, weights, tracking, radii, padding, row heights,
-- shadows -- and 75 are COLOUR. Structure is what took the design work.
-- Colour is data.
--
-- So `style` keeps its meaning and becomes the 版式 (Ledger is tight and sharp,
-- Hearth loose and round, Blueprint precise), and `palette` is a new, optional
-- 配色 layer generated from tweakcn (Apache-2.0) by scripts/build-palettes.mjs.
-- Three layouts times ten palettes is thirty looks from ten data files.
--
-- The mechanism is CSS source order, verified in a real browser before this
-- migration was written: a palette class and a layout class have identical
-- specificity, so the palette -- emitted after the layouts in
-- style-scope.module.css -- wins the colour tokens, while every structural
-- token stays with the layout. Measured on the same element:
--
--   ledger    + supabase   primary green   radius 3px  text 12px  row 32px
--   blueprint + supabase   primary green   radius 8px  text 13px  row 42px
--   blueprint + mocha      primary brown   radius 8px  text 13px  row 42px
--
-- NULL means "this layout's own native palette", which is what every existing
-- project has and what Ledger/Hearth/Blueprint were designed with. It is not a
-- missing value to be backfilled -- the native pairing is a real choice and the
-- one most customers should keep.

alter table public.projects
  add column if not exists palette text;

comment on column public.projects.palette is
  'Optional 配色 layer over the style''s own colours. NULL = the layout''s native palette. Generated set lives in design-system/palettes/, see scripts/build-palettes.mjs.';

-- Mirrors the filenames in design-system/palettes/. The two must agree: a value
-- here that has no CSS class renders as the layout''s native colours with no
-- error, which is a silently wrong system rather than a broken one -- so
-- style-scope.sync.test.ts checks the list against the directory.
alter table public.projects
  drop constraint if exists projects_palette_check;

alter table public.projects
  add constraint projects_palette_check
  check (
    palette is null
    or palette in (
      'supabase', 'vercel', 'claude', 'amber-minimal', 'nature',
      'ocean-breeze', 'vintage-paper', 'clean-slate', 'mocha-mousse', 'graphite'
    )
  );

-- ---------------------------------------------------------------------------
-- Setting it
-- ---------------------------------------------------------------------------
-- Replaces 20260818120000's set_project_style, keeping its shape and its
-- security-definer/auth.uid() resolution exactly and adding one optional
-- argument. Optional so every existing caller keeps working unchanged: passing
-- only a style leaves the palette alone rather than silently clearing it, which
-- would make changing 版式 quietly discard the customer's 配色.
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
  if new_style not in ('ledger', 'hearth', 'blueprint') then
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
      -- Three cases, and the third is why `clear_palette` exists rather than
      -- being inferred from a NULL: "go back to this layout's own colours" and
      -- "leave the palette as it is" are different intentions that both arrive
      -- as new_palette IS NULL.
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

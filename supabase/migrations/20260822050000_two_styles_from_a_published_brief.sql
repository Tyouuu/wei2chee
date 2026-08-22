-- supabase/migrations/20260822050000_two_styles_from_a_published_brief.sql
--
-- Adds 瑞士 (Swiss) and 柔和 (Soft) -- the first two registers in this product
-- that were not designed here.
--
-- WHERE THEY CAME FROM. uiprompt.site publishes a written design brief for
-- each of 73 named UI styles, free, with a copy button, for exactly this use.
-- Two of them were rendered into design-system/tokens/{swiss,soft}.css: Swiss
-- Design (International Typographic Style) and Soft UI (neumorphism). Each
-- token file's header carries the brief's own words and the argument for why
-- it is a register rather than a repaint of one we already had.
--
-- WHY THAT MATTERS HERE. The founder's standing objection to the style set was
-- 「看起来真的没什么区别」, and the answer to it is not more careful tinting of
-- the same idea -- it is registers that came from somewhere else. This
-- migration is the SQL half of proving that path works: adding a style is a
-- token file plus one mirrored list, and this file is the mirrored list.
--
-- Mirrors 20260822030000 exactly, with two values appended to every list. Both
-- functions are updated in one file for the same reason that migration says:
-- one place to read, one place to get wrong. The release before it widened the
-- constraint and missed `update_project_style`, so the UI showed 使用中 over a
-- 400.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft') then
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

-- The style-and-palette sibling. Signature copied verbatim from
-- 20260822010000 -- three arguments, not two: `create or replace` matches on
-- the argument list, so a two-argument version would be a NEW overload sitting
-- beside the real one with no palette validation and no clear_palette. The
-- body is unchanged apart from the style list.
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
                       'large', 'stamp', 'contract', 'swiss', 'soft') then
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

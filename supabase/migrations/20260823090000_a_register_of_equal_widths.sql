-- supabase/migrations/20260823090000_a_register_of_equal_widths.sql
--
-- Adds 码 (Code), the register where every character is the same width.
--
-- WHAT THE MEASUREMENT SAID. Body faces across the eighteen registers:
-- bare, brut, docket x2, industrial x3, rounded x2, sans x2, serif x2,
-- soft x2, swiss x3. Nine families, every one PROPORTIONAL. --font-numeric has
-- been monospace on all of them from the start, so the product already knew
-- the difference mattered -- it just never let a register make that difference
-- the whole page.
--
-- NOT A DEVELOPER THEME. Spare parts and part numbers, phone and IT repair,
-- printing with job numbers, courier with tracking codes: set a column of
-- those in a proportional face and it is ragged, set it in monospace and the
-- digits line up without anybody asking. Density stays 台账's, 13px on 32px
-- rows, because this is a register for many short strings rather than prose.
--
-- The CJK half needs no second font: 黑体 is already fixed-width for Han
-- characters, so a Chinese line comes out aligned whatever face it is in.
-- Shipping a Han "mono" webfont would cost megabytes to solve a problem that
-- does not exist.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                   'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code'));

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                                  'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code'));

-- The one the styles page and the editor's switcher call.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain', 'kraft', 'signboard', 'lacquer', 'code') then
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

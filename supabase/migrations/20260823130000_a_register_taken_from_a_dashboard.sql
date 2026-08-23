-- 波普 (pop) — the twenty-second register, and the first taken from somebody
-- else's project rather than written from a brief.
--
-- SOURCE. arhamkhnz/next-shadcn-admin-dashboard (MIT, Next.js 16, Tailwind v4,
-- shadcn on Radix — the same stack as this project) ships three theme presets,
-- and the founder said of its 「soft pop」 one: 「这种才能被称为一种风格」.
-- The colours are tweakcn's soft-pop (Apache-2.0), the same source as the
-- twenty-five 配色; the structure is this project's own.
--
-- WHY IT IS NOT ANOTHER 柔和 OR 粗野, measured across the twenty-one:
--
--   1. THREE SATURATED COLOURS. Every other register has ONE accent, and the
--      status tones are reserved for meaning. Secondary chroma across the
--      twenty-one runs 0.00 to 0.05; this one carries an indigo, a teal and an
--      amber, all above 0.12, used as decoration.
--   2. BIG RADIUS AND A HARD BLACK EDGE TOGETHER. The set had
--      rounded-and-borderless (柔和: radius 18px, border 0px) and
--      square-and-bordered (粗野: radius 12px, border 3px). Nothing had both.
--      26px corners with a 2px black outline reads as a sticker.
--   3. A GROUND THAT IS NEITHER PAPER NOR DARK. #f3f8ee, a pale mint. Sixteen
--      of the twenty-one grounds are near-white at chroma under 0.02.
--
-- Mirrors design-system/tokens/pop.css and the StyleName union in
-- app/[locale]/style-picker/style-column.tsx.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style in (
      'ledger', 'hearth', 'blueprint', 'bare', 'docket', 'large', 'stamp',
      'contract', 'swiss', 'soft', 'brut', 'ink', 'glass', 'night', 'grain',
      'kraft', 'signboard', 'lacquer', 'code', 'tile', 'clear', 'pop'
    )
  );

-- Both setters carry the list in their own body. Each signature is copied
-- verbatim from the migration that last defined it: `create or replace` matches
-- on the argument list, so a changed one would leave the real function in place
-- with the old, shorter list still in it.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'bare', 'docket',
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut',
                       'ink', 'glass', 'night', 'grain', 'kraft', 'signboard',
                       'lacquer', 'code', 'tile', 'clear', 'pop') then
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
                       'large', 'stamp', 'contract', 'swiss', 'soft', 'brut',
                       'ink', 'glass', 'night', 'grain', 'kraft', 'signboard',
                       'lacquer', 'code', 'tile', 'clear', 'pop') then
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

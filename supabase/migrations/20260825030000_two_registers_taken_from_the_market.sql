-- Sixteen registers become eighteen: 仪表盘 and 中台.
--
-- WHY THESE TWO AND NOT ANY OTHER TWO. They are the first registers in this set
-- chosen from a MEASUREMENT of the market rather than from a written brief.
-- Eleven competitors' dashboards were photographed at 1440x950 on 2026-08-25
-- and put beside our own sixteen. Two whole families had no answer here:
--
--   仪表盘 (console)  Tabler (41.5k, MIT), AdminLTE (45.6k, MIT), ngx-admin
--                    (25.7k, MIT) draw one object between them -- a WHITE
--                    sidebar, a slate ground, 4px corners, a shadow visible
--                    only at a card's edge, small-caps labels, and colour spent
--                    entirely on the figures. Of our sixteen, nine put a dark
--                    column on the left, four a bar across the top, and the
--                    three that stay light are typographic registers with no
--                    fill anywhere. A light sidebar with a tinted active row --
--                    the shape every dense console in this market actually uses
--                    -- appeared nowhere.
--
--   中台 (counter)    Ant Design Pro (38.7k, MIT) and vue-element-admin (90.2k,
--                    MIT). Deep navy chrome at #001529, the active row FILLED
--                    solid blue, 2px corners, no shadow anywhere, and the
--                    densest body in the set at 34px rows and 13px base. This
--                    matters here more than its star count: it is what most
--                    Chinese-speaking Malaysian SMEs have ALREADY used, because
--                    every 进销存 and every 车行系统 sold into this market is
--                    built on it. A dealer who has run Autocount recognises the
--                    page before reading it, which is worth more than novelty.
--
-- The founder's standard for all of this, set the same day: 「要迎合市场 这个才
-- 是关键」. Neither of these is a repaint -- see each token file's header for the
-- measurement against the other sixteen, and scripts/derive-console.mjs /
-- derive-counter.mjs for every value that moved and why.
--
-- ADDITIVE ONLY. Nothing changes for an existing account; these two simply
-- become choosable. Both setters are rewritten in full because `create or
-- replace` matches on the argument list -- a partial redefinition would leave
-- the old body in place and no customer could ever pick either one, which is
-- exactly how 瑞士 and 柔和 shipped unpickable in August.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style in (
      'ledger', 'hearth', 'blueprint', 'large', 'stamp', 'swiss', 'soft',
      'brut', 'ink', 'glass', 'night', 'signboard', 'lacquer', 'code',
      'tile', 'pop', 'console', 'counter'
    )
  );

create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'large', 'stamp',
                       'swiss', 'soft', 'brut', 'ink', 'glass', 'night',
                       'signboard', 'lacquer', 'code', 'tile', 'pop',
                       'console', 'counter') then
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
  if new_style not in ('ledger', 'hearth', 'blueprint', 'large', 'stamp',
                       'swiss', 'soft', 'brut', 'ink', 'glass', 'night',
                       'signboard', 'lacquer', 'code', 'tile', 'pop',
                       'console', 'counter') then
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

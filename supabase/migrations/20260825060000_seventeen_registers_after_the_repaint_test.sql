-- 墨 goes. Eighteen registers become seventeen.
--
-- WHY, AND WHY THIS TEST. The founder, 2026-08-25, looking at the library:
-- 「你那些什么牛皮 什么啊 什么啊 只是你再调那个颜色而已？那为什么不要放在配色？」
-- and 「就是至少是没有重复性的」. That is a criterion, not a complaint, and it is
-- the right one: a register that survives a repaint is a register; one that
-- does not is a palette wearing a register's name.
--
-- Measured rather than argued. Ten axes a palette cannot touch -- the shell,
-- the rail, the table's lines, the table's rows, the stat tiles, the sections,
-- the trend chart, the share chart, the ranking, the page header -- across all
-- one hundred and fifty-three pairs:
--
--   瑞士 / 墨   8 of 10 identical, and FIVE of those eight are locked on both
--              sides: side-light shell, text-only rail, unruled table, no-box
--              stat row, frameless sections. Neither can move off any of them
--              without ceasing to be itself. What is left between them is a
--              serif and a red.
--
-- No other pair is irreducible. The rest were separated by giving them
-- different objects rather than different paint -- three new axes landed the
-- same day (排行的形状, 占比图, 表格行), each one a component with genuinely
-- different shapes rather than a fourth colour for an existing one.
--
-- WHY 墨 IS THE ONE THAT GOES, AND NOT 瑞士. The founder's most load-bearing
-- rule is 「第一屏就是产品」 -- the first screen is the only chance an owner has
-- to judge with their eyes before paying. 墨's whole argument was one figure and
-- a great deal of air: its dashboard was three blocks, and an owner opening it
-- saw an empty page. 瑞士 makes the same case for restraint with a stat row, a
-- chart, a table and the workflow on the screen.
--
-- NOBODY LOSES THEIR SYSTEM. 墨 → 瑞士: both are frameless, both rule rather
-- than fill, both put a single accent on near-white. The update runs BEFORE the
-- constraint narrows, because narrowing first would reject the update that
-- makes it safe.

update public.projects set style = 'swiss', updated_at = now() where style = 'ink';

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style in (
      'ledger', 'hearth', 'blueprint', 'large', 'stamp', 'swiss', 'soft',
      'brut', 'glass', 'night', 'signboard', 'lacquer', 'code',
      'tile', 'pop', 'console', 'counter'
    )
  );

-- Both setters carry the list in their own body, and each signature below is
-- copied verbatim from the migration that last defined it: `create or replace`
-- matches on the argument list, so a changed one would leave the real function
-- in place with the old list still inside it -- and a customer could still set
-- a register whose token file no longer exists.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'large', 'stamp',
                       'swiss', 'soft', 'brut', 'glass', 'night',
                       'signboard', 'lacquer', 'code', 'tile', 'pop',
                       'console', 'counter') then
    raise exception 'invalid style: %', new_style;
  end if;

  update public.projects
  set style = new_style, updated_at = now()
  where account_id = auth.uid();
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
                       'swiss', 'soft', 'brut', 'glass', 'night',
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

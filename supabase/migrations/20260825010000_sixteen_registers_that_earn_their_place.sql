-- Twenty-two registers become sixteen.
--
-- WHY. The founder, after looking at eleven competitors' dashboards and then at
-- our own twenty-two side by side: 「帮我拿掉一些你觉得不好看的风格 我只要质量
-- 之有好看的 有代表性的才可以放在我的风格库」, and the standard he set for the
-- judgement in the same conversation: 「要迎合市场 这个才是关键」. So the test is
-- not whether a register is interesting, it is whether a Malaysian SME owner
-- would pick it.
--
-- SIX FAIL THAT TEST, each for a reason that is about the market and not taste:
--
--   素 bare      No cards, no borders, no shadows. On a system full of records
--                that reads as a page that failed to finish loading.
--   清 clear     Does the same job as 大字 -- "make it readable" -- only more
--                extremely (20px body vs 17px). Two registers for one job is
--                one too many; 大字 carries the better market story (「老板五六
--                十岁、在车上用手机看」). Clear's real contribution, its 7.4:1
--                secondary text and ~52px touch targets, moves INTO 大字 rather
--                than being lost -- see tokens/large.css.
--   契约 contract All-serif with the accent almost withdrawn. On screen it is
--                the faintest of the twenty-two. It was built for paper, and
--                paper already has its own layer (scripts/check-print.mjs); a
--                business does not buy a system so that it can look like a
--                document.
--   单据 docket   The same family as 台账 (dense, square, ruled). Of the three in
--                that family 印 has the strongest market story -- it looks like
--                the POS and accounting software these owners already use -- so
--                台账 and 印 stay and this one goes.
--   麻 grain     A twin of 牛皮 with noise instead of board, and the noise is
--                invisible at the sizes anything is actually read at.
--   牛皮 kraft    The only one of the six with a MEASURED defect rather than a
--                judgement: card-to-ground luminance ratio 1.23, recorded in
--                this repo on 2026-08-23 as 「整页像一大块牛皮纸，看不出层次」.
--
-- NOBODY LOSES THEIR SYSTEM. Every account on a withdrawn register is moved to
-- the nearest survivor BEFORE the constraint narrows, so a customer who picked
-- 牛皮 opens tomorrow on 招牌 rather than on a page the renderer cannot resolve.
-- The pairs are chosen on what the token files share, not alphabetically:
--
--   素 → 瑞士      flat, unshadowed, uppercase labels, minimal
--   清 → 大字      the same job, and 大字 now carries clear's contrast floor
--   契约 → 墨      serif body, generous leading, no shadow
--   单据 → 台账    dense ruled records
--   麻 → 蓝图      neutral ground, one flat blue
--   牛皮 → 招牌    warm ground, uppercase labels, zero radius, no shadow
--
-- The order matters: update first, then narrow. Narrowing first would reject
-- the update it is meant to make safe.

update public.projects set style = 'swiss',     updated_at = now() where style = 'bare';
update public.projects set style = 'large',     updated_at = now() where style = 'clear';
update public.projects set style = 'ink',       updated_at = now() where style = 'contract';
update public.projects set style = 'ledger',    updated_at = now() where style = 'docket';
update public.projects set style = 'blueprint', updated_at = now() where style = 'grain';
update public.projects set style = 'signboard', updated_at = now() where style = 'kraft';

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style in (
      'ledger', 'hearth', 'blueprint', 'large', 'stamp', 'swiss', 'soft',
      'brut', 'ink', 'glass', 'night', 'signboard', 'lacquer', 'code',
      'tile', 'pop'
    )
  );

-- Both setters carry the list in their own body. Each signature is copied
-- verbatim from the migration that last defined it: `create or replace` matches
-- on the argument list, so a changed one would leave the real function in place
-- with the old, longer list still in it -- and a customer could still set a
-- register whose token file no longer exists.
create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint', 'large', 'stamp',
                       'swiss', 'soft', 'brut', 'ink', 'glass', 'night',
                       'signboard', 'lacquer', 'code', 'tile', 'pop') then
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
                       'signboard', 'lacquer', 'code', 'tile', 'pop') then
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

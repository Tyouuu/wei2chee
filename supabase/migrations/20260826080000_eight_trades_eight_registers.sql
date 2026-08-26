-- Eight trades were being sent to three registers. Now they are sent to eight.
--
-- MEASURED 2026-08-26, straight out of the table:
--
--   hearth     美容/沙龙 · 教育/补习 · 餐饮/F&B
--   ledger     装修/承包商 · 批发/分销 · 服务型公司
--   blueprint  其他 · 零售/门店
--
-- Fourteen registers, and eleven of them are never the opening guess for
-- anybody. That is not a small thing. 判准 12: 「风格库是在省他的时间…风格够好
-- ＝客户自己挑，不用一单一单谈设计」. The gallery is the fallback; the
-- recommendation is what an owner actually meets, two minutes after describing
-- their business, on the screen the whole product is sold on (重点 11).
-- Three answers to eight questions is the recommendation not really answering.
--
-- WHAT EACH TRADE GETS AND WHY. Each one is the register whose own thesis is
-- about that trade -- not the one whose colour suits it.
--
--   装修/承包商  → 台账   dozens of live jobs a day; density is the point
--   批发/分销    → 中台   twenty orders a day, and it is literally the shape of
--                        the software this trade already runs (Autocount,
--                        进销存, Ant Design Pro)
--   服务型公司   → 工作室 a system opened to CHECK a state, not to key records;
--                        52px rows and no pairs
--   美容/沙龙    → 炉     a front counter, and the page a customer may see
--   教育/补习    → 柔和   soft, shadow-separated, a top bar rather than a rail
--   餐饮/F&B     → 瓷     Peranakan floor tile. A kopitiam or a nyonya
--                        restaurant recognises this before reading a word --
--                        the one register in the set whose identity is local
--   零售/门店    → 招牌   a shop with a sign. The only register that sets its
--                        display face differently from its body face, which is
--                        exactly what a signboard does
--   其他        → 图纸   the neutral one, which is the honest answer when the
--                        trade is unknown
--
-- The remaining six -- 仪表盘, 瑞士, 粗野, 漆, 码, 夜 -- stay browse-only, and
-- that is fine and deliberate: 漆 is for a TCM hall or a wedding business, 粗野
-- for a gym or a barber, and none of those is one of the eight buckets yet.
-- A register nobody is POINTED at is different from a register nobody can
-- reach: all fourteen are one click away on /portal/styles, rendered with the
-- owner's own pages.

-- ── FIRST: ONE LIST OF REGISTER NAMES, IN ONE PLACE ──────────────────────
--
-- This migration failed on its first run against a CHECK constraint on
-- `industries.style_recommendation` that was three days stale: it still allowed
-- bare, docket, large, contract, ink, grain, kraft and clear -- all cut on
-- 2026-08-23 and 2026-08-25 -- and had never heard of 仪表盘, 中台 or 工作室.
--
-- That was the FOURTH copy of the register list. The other three were
-- `projects_style_check` and the two RPCs, and 20260826060000 already collapsed
-- those into one. A list kept in two places is a list that will disagree, and
-- the way it disagrees is that adding a register silently works everywhere
-- except the one screen where a trade gets its opening guess.
--
-- So the names live in an IMMUTABLE function and both tables check against it.
-- The eighteenth register is then one edit, in one file, and the migration that
-- adds it cannot half-land.

create or replace function public.is_known_register(name text)
returns boolean
language sql
immutable
parallel safe
as $$
  select name in (
    'ledger', 'hearth', 'blueprint', 'swiss', 'soft', 'brut',
    'night', 'signboard', 'lacquer', 'code', 'tile',
    'console', 'counter', 'studio'
  );
$$;

alter table public.industries
  drop constraint if exists industries_style_recommendation_is_real;

alter table public.industries
  add constraint industries_style_recommendation_is_real
  check (style_recommendation is null or public.is_known_register(style_recommendation));

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (style is null or public.is_known_register(style));

update public.industries set style_recommendation = 'ledger'    where slug = 'renovation';
update public.industries set style_recommendation = 'counter'   where slug = 'wholesale';
update public.industries set style_recommendation = 'studio'    where slug = 'services';
update public.industries set style_recommendation = 'hearth'    where slug = 'beauty';
update public.industries set style_recommendation = 'soft'      where slug = 'education';
update public.industries set style_recommendation = 'tile'      where slug = 'fnb';
update public.industries set style_recommendation = 'signboard' where slug = 'retail';
update public.industries set style_recommendation = 'blueprint' where slug = 'other';

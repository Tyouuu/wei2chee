-- Twenty-five 配色 become eight.
--
-- The founder, 2026-08-26: 「风格配色的部分我反而觉得不会有人会选很花哨的颜色 你看
-- 大多数的system都是白色跟黑色居多 不会出现红色啊 绿色啊 然后主题配色的选择也是要选
-- 几套多人会选的 就好了」.
--
-- The rule that settles it is his own point 12 -- the library exists to SAVE
-- HIM TIME. A palette nobody picks is not one more choice, it is one more thing
-- to scroll past, twenty-five times, on the screen where an owner decides
-- whether to pay.
--
-- MEASURED FIRST, on nine real business systems opened with a browser the same
-- day (.screenshots/colours/, and the full table is in scripts/build-palettes.mjs):
--
--   Linear #5E6AD2 · Stripe #533AFD · Xero #1F65D6 · Notion #0075DE ·
--   monday #6161FF · SQL Account #6632FF · AutoCount #00A8E6 ·
--   FreshBooks #038A06 · Zoho Books #F5BA31
--
-- NINE OF NINE grounds are neutral. Not one is tinted, and our set already
-- agreed -- 24 of 25 sat at oklch L 0.880-1.000, C 0.000-0.053.
-- NINE OF NINE accents are a saturated colour. Not one is grey.
-- SEVEN OF NINE fall in hue 230-290, blue through violet, INCLUDING BOTH
-- MALAYSIAN SYSTEMS. Ours were spread evenly around the whole hue circle: a
-- paint chart, not a set of system palettes. That is the actual defect.
--
-- NOBODY OPENS A BLANK PAGE, and nobody is remapped to a colour they did not
-- choose in spirit. Every dropped palette goes to the nearest survivor by hue
-- and by TRADE, not by hue alone -- 咖啡 is closer to 陶土 in hue and closer to
-- 琥珀 in what it is for, and the trade wins. The rows move BEFORE the
-- constraint narrows, because narrowing first would reject the update that
-- makes it safe.
--
-- This differs on purpose from the 2026-08-23 cull, which set the four leaving
-- palettes to NULL. That was right then: they had been live for one day and
-- 「the nearest colour」 was a guess about people who had barely chosen. These
-- have been live long enough to be someone's answer, and NULL would silently
-- repaint a chosen system in the register's own colours. A neighbour keeps the
-- decision; NULL discards it.

-- ---------------------------------------------------------------------------
-- The rows move first
-- ---------------------------------------------------------------------------
create temporary table _palette_moves (old text primary key, new text) on commit drop;
insert into _palette_moves (old, new) values
  ('graphite',        'vercel'),          -- a second neutral beside 极简黑
  ('neo-brutalism',   'elegant-luxury'),  -- 2 degrees apart
  ('t3-chat',         'rosewood'),        -- 服饰·写真·花店
  ('bubblegum',       'rosewood'),        -- 美甲·蛋糕·童装
  ('amethyst-haze',   'rosewood'),        -- 美容·花店·婚纱
  ('claude',          'tangerine'),       -- 3 degrees apart
  ('mocha-mousse',    'amber-minimal'),   -- 咖啡·甜品·家具, a ledger warmth
  ('caffeine',        'amber-minimal'),   -- 书店·文具·会计
  ('vintage-paper',   'elegant-luxury'),  -- 茶行·药材·古董: the 老字号 red
  ('gold-grain',      'amber-minimal'),   -- 金行·当铺·米粮
  ('kodama-grove',    'nature'),          -- 农产·园艺·有机
  ('northern-lights', 'nature'),          -- 诊所·健康·健身
  ('supabase',        'modern-minimal'),  -- 科技·软件·电商
  ('turquoise-stone', 'modern-minimal'),  -- 冷气·水电·泳池·洗车
  ('perpetuity',      'modern-minimal'),  -- same trades, 17 degrees apart
  ('twitter',         'modern-minimal'),  -- 一般服务·教育·中介
  ('starry-night',    'clean-slate');     -- 律师·会计·保险·公证

update public.projects p
   set palette = m.new, updated_at = now()
  from _palette_moves m
 where p.palette = m.old;

update public.industries i
   set palette_recommendation = m.new
  from _palette_moves m
 where i.palette_recommendation = m.old;

-- ---------------------------------------------------------------------------
-- The constraints
-- ---------------------------------------------------------------------------
-- Mirrors the filenames in design-system/palettes/ and lib/portal/
-- palettes.generated.ts. All three must agree: a value here with no CSS class
-- renders as the register's native colours with no error at all, which is a
-- silently wrong system rather than a broken one. style-scope.sync.test.ts
-- checks the pair; this is the third leg.
alter table public.projects
  drop constraint if exists projects_palette_check;

alter table public.projects
  add constraint projects_palette_check
  check (
    palette is null
    or palette in (
      'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
      'tangerine', 'amber-minimal', 'nature', 'rosewood'
    )
  );

alter table public.industries
  drop constraint if exists industries_palette_recommendation_is_real;

alter table public.industries
  add constraint industries_palette_recommendation_is_real
  check (
    palette_recommendation is null
    or palette_recommendation in (
      'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
      'tangerine', 'amber-minimal', 'nature', 'rosewood'
    )
  );

-- ---------------------------------------------------------------------------
-- What each trade OPENS with
-- ---------------------------------------------------------------------------
-- The map above is right for a customer who already CHOSE: it keeps their
-- decision by moving it to the nearest survivor. It is the wrong instrument for
-- the per-trade default, which is a design decision and has to be made rather
-- than inherited -- the nearest survivor to 咖啡 is 琥珀, and 「a renovation
-- contractor opens in amber」 is not something anyone decided.
--
-- So these are stated, and they agree with the `who` line each palette now
-- carries in scripts/build-palettes.mjs. If the two ever disagree, the who line
-- is what the customer reads and this is what he gets: they must not drift.
update public.industries set palette_recommendation = 'tangerine'      where slug = 'renovation';
update public.industries set palette_recommendation = 'vercel'         where slug = 'wholesale';
update public.industries set palette_recommendation = 'modern-minimal' where slug = 'services';
update public.industries set palette_recommendation = 'rosewood'       where slug = 'beauty';
update public.industries set palette_recommendation = 'modern-minimal' where slug = 'education';
update public.industries set palette_recommendation = 'elegant-luxury' where slug = 'fnb';
update public.industries set palette_recommendation = 'elegant-luxury' where slug = 'retail';

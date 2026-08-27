-- 十四套风格砍到六套
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
--
-- The founder, after seeing eight of them rendered side by side with the same
-- photographs and the same words: 「有点一样的」「只是颜色不一样罢了」「可是这两套
-- 也没有什么很特别的记忆点啊」. Then, having read the case: 「砍吧」.
--
-- The measurement behind it is the one that mattered: eight industries reached
-- only eight registers, so SIX OF THE FOURTEEN COULD NOT BE REACHED BY ANY
-- OWNER -- they existed only in the gallery. And 「不重复」 was never the bar;
-- 重点 7f asks whether a register has a thesis you can say out loud.
--
-- ── WHY NOT PER-INDUSTRY INSTEAD ────────────────────────────────────────────
--
-- Because the market says industry does not change the skeleton. The 19
-- trading Malaysian SME sites photographed on 2026-08-27 -- aircon, dental,
-- renovation, F&B, beauty -- open the same way: a top strip, a photograph, a
-- WhatsApp button, a claim. And Wix's several hundred 「industry templates」
-- are a few dozen skeletons relabelled: their Painting Company and their Home
-- Remodeling Company are one skeleton with different photographs. An industry
-- label is a filing system, not a design system.
--
-- What industry DOES decide, and already did before this migration: which
-- sections exist, what the photo library searches for, and what the enquiry
-- form asks.
--
-- ── HOW EACH ONE WAS ROUTED ─────────────────────────────────────────────────
--
-- By USE, not by colour -- the precedent is the palette cull of 2026-08-26,
-- where 咖啡's nearest hue was 陶土 and its nearest USE was 琥珀, and use won.
--
--   仪表盘 console  -> 图纸 blueprint   the neutral admin shape, to the neutral one
--   柔和   soft     -> 图纸 blueprint   it served 教育, which moves to 图纸
--   粗野   brut     -> 招牌 signboard   both are the loud colour-block ones
--   瓷     tile     -> 满图 hearth      it served 餐饮, and food sells on photographs
--   码     code     -> 中台 counter     both are the dense catalogues
--   漆     lacquer  -> 满图 hearth      warm ivory, to the warm one
--   夜     night    -> 招牌 signboard   darkness is a PALETTE now (深夜), not a register
--   工作室 studio   -> 瑞士 swiss       it served 服务型, and neither will paint a band
--
-- Three projects existed at the time of writing (1 on 瓷, 2 on 仪表盘), all of
-- them ours. This is the cheapest week this will ever be.

-- ── projects ───────────────────────────────────────────────────────────────
update public.projects set style = 'blueprint', updated_at = now() where style = 'console';
update public.projects set style = 'blueprint', updated_at = now() where style = 'soft';
update public.projects set style = 'signboard', updated_at = now() where style = 'brut';
update public.projects set style = 'hearth', updated_at = now() where style = 'tile';
update public.projects set style = 'counter', updated_at = now() where style = 'code';
update public.projects set style = 'hearth', updated_at = now() where style = 'lacquer';
update public.projects set style = 'signboard', updated_at = now() where style = 'night';
update public.projects set style = 'swiss', updated_at = now() where style = 'studio';

-- ── the one list, in one place ─────────────────────────────────────────────
--
-- Two tables and one RPC all ask this function, which is why the 2026-08-26
-- register cull could leave `industries` three days stale while `projects` was
-- correct. See 20260826080000.

create or replace function public.is_known_register(name text)
returns boolean
language sql
immutable
as $$
  select name in ('ledger', 'hearth', 'blueprint', 'swiss', 'signboard', 'counter');
$$;

-- ── 八个行业，六套风格，每一套至少被一个行业带到 ──────────────────────────
update public.industries set style_recommendation = 'ledger' where slug = 'renovation';
update public.industries set style_recommendation = 'counter' where slug = 'wholesale';
update public.industries set style_recommendation = 'signboard' where slug = 'retail';
update public.industries set style_recommendation = 'hearth' where slug = 'beauty';
update public.industries set style_recommendation = 'blueprint' where slug = 'other';
update public.industries set style_recommendation = 'swiss' where slug = 'services';
update public.industries set style_recommendation = 'blueprint' where slug = 'education';
update public.industries set style_recommendation = 'hearth' where slug = 'fnb';

-- ── 两个没有主人的排法 ──────────────────────────────────────────────────────
--
-- 排法 names a REGISTER's shape (LAYOUT_SETS: table->台账, hero->招牌,
-- today->炉). 仪表盘 and 看板 named 仪表盘 and 粗野, both culled above. Left in
-- place they become buttons that light up, write this column and change
-- nothing -- the exact defect the AI side of this product spent 2026-08-27
-- removing. NULL means 「follow the register」, which is what most accounts
-- have and what these two should go back to.

update public.projects set layout = null, updated_at = now()
where layout in ('console', 'board');

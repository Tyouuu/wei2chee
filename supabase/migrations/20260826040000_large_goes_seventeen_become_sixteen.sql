-- 大字 goes. Seventeen registers become sixteen.
--
-- 「要做的有深度 有設計感 就是好像真的有人再用一樣順暢 一樣好看 才可以過關」
-- 「要很嚴厲」 「就是你要當作這是最後一輪的大洗牌」 -- 2026-08-26.
--
-- All seventeen were shot on the same page with the same data and looked at
-- side by side (.screenshots/registers/00-all.png). Four looked weak in the
-- contact sheet; three of them were fine at full size and the thumbnail was
-- lying -- 粗野's "empty grey box" was its active nav pill at 32% scale, 玻璃 is
-- an icon-only top bar over a lilac gradient with frosted cards, 招牌 is a
-- shopfront: black bar, pink band, one enormous number. Being strict cuts both
-- ways, and none of those three is cut.
--
-- 大字 IS. It is the one register whose design is defined by what it does NOT
-- have: Panel "plain" (no card), StatRow "rule" (no box), no chart on the
-- dashboard at all. On screen that is two figures floating on bare grey with
-- 500px of nothing between them, a list, and a table starting at the bottom
-- edge. It does not read as restraint. It reads as a page whose stylesheet
-- failed to load.
--
-- ITS ARGUMENT DOES NOT SURVIVE EITHER. The brief says 「大字 · 给看不清楚的人」,
-- big type for someone who cannot see well -- and its labels are 16px and its
-- figures 30px, the same as 蓝图's. It never actually was big type. A real
-- answer to that need is a SIZE setting, which belongs beside the corner
-- slider where every register can have it, not a seventeenth register that
-- only one customer in a hundred would pick.
--
-- 瑞士 makes the case for restraint on a full page, with a rail, a chart, a
-- table and the workflow all present. That is what restraint looks like when
-- it is designed rather than subtracted, and it is where 大字 goes.

update public.projects set style = 'swiss', updated_at = now() where style = 'large';
update public.industries set style_recommendation = 'swiss' where style_recommendation = 'large';

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style is null
    or style in (
      'ledger', 'hearth', 'blueprint', 'stamp', 'swiss', 'soft', 'brut',
      'glass', 'night', 'signboard', 'lacquer', 'code', 'tile', 'pop',
      'console', 'counter'
    )
  );

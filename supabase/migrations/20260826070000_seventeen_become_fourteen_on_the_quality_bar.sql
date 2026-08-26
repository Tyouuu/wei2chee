-- 17 → 14. 印, 玻璃 and 波普 go.
--
-- 「已经优化了吗 不达标的就不要了 注重质量」 (2026-08-26)
--
-- The test is his, written down as 重点 7c and 7f: a register has to have a
-- thesis you can say out loud -- who it is for, when it gets opened, what it
-- gives up to get what it gives -- and it has to still be another DESIGN after
-- you repaint it. Not being a duplicate is only the pass mark, not the grade.
--
-- Every register was re-shot and looked at one by one on 2026-08-26. Three
-- could not earn the sentence.
--
-- 印 (stamp) → 中台 (counter)
--   Its brief says 「像他们本来就在用的 POS / 会计软件」. That is 中台's claim,
--   word for word, and 中台 is the one measured off what Malaysian
--   Chinese-speaking SMEs have actually been using -- Ant Design Pro,
--   vue-element-admin, Autocount. Two registers cannot both be the one that
--   looks like the software they already own.
--   It is also the register that prints the same figure twice in one row: a
--   68% progress bar labelled 「Confirmed jobs this month」 sitting immediately
--   left of a tile labelled 「CONFIRMED JOBS THIS MONTH · RM 71,300」. That
--   exact failure is why the Basecamp-style board skeleton was killed twice
--   (founder-tasks 17), and it was shipping here.
--   What was good in it survives: the solid filled table head is a RecordTable
--   shape, not a register, and 中台 keeps its own dense navy chrome.
--
-- 玻璃 (glass) → 柔和 (soft)
--   Frosted translucent panels over three soft colour clouds. It is a
--   well-executed effect and nobody in this market picks it. 判准 1:
--   「一切以市场为准…马来西亚中小企业老板会不会选」. A renovation contractor,
--   a workshop, a TCM shop -- none of them opens a glassmorphism dashboard.
--   判准 12 finishes it: a style nobody chooses is not one more choice, it is
--   one more thing to scroll past. 柔和 is where it goes because that is the
--   other soft, shadow-separated, light register.
--
-- 波普 (pop) → 粗野 (brut)
--   One family, two entries. Both lead their dashboard with a kanban board,
--   both separate with a hard un-blurred offset shadow, both put a heavy edge
--   on every card. What is left to tell them apart is 26px versus 3px and
--   three saturated colours -- and 波普's own brief says it out loud:
--   「颜色是装饰,不只是意思」. 重点 7c: if the colour is the identity, it
--   belongs in the palette layer. 粗野 keeps the slot because its identity is
--   the frame, which is structure.
--
-- WHY THE ROWS MOVE RATHER THAN GOING NULL. Same reason as migration
-- 20260826010000 for the palettes: these three have been live for days and
-- somebody's answer may be sitting in them. NULL would silently take a
-- customer's design away. The nearest surviving register is not the nearest
-- COLOUR -- it is the nearest argument.

update public.projects set style = 'counter', updated_at = now() where style = 'stamp';
update public.projects set style = 'soft',    updated_at = now() where style = 'glass';
update public.projects set style = 'brut',    updated_at = now() where style = 'pop';

update public.industries set style_recommendation = 'counter' where style_recommendation = 'stamp';
update public.industries set style_recommendation = 'soft'    where style_recommendation = 'glass';
update public.industries set style_recommendation = 'brut'    where style_recommendation = 'pop';

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style is null
    or style in (
      'ledger', 'hearth', 'blueprint', 'swiss', 'soft', 'brut',
      'night', 'signboard', 'lacquer', 'code', 'tile',
      'console', 'counter', 'studio'
    )
  );

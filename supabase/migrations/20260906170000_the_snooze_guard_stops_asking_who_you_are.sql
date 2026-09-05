-- 那个帐号还是删不掉，而资料库的原话指着我自己刚写的那一支:
--
--     P0001 | that project is not yours
--
-- 🔴 20260906150000 那一段放行救不了它，理由值得写下来:
-- **删使用者的时候，`by_who` 被设成 null 那一刻，公司还在。**
-- 顺序是「先把那几栏设成 null，再 cascade 删掉 project」，所以
-- 「公司没了就放行」那一句在这一刻是 false。
--
-- 真正的差别在**那一支守卫在问什么**:
--   · 其余九支问的是**结构**（这一行的上一层是不是同一个 project）——
--     cascade 改 `created_by` 不会改变那件事，所以它们答得出来
--   · 🔴 我这一支问的是**身分**（`works_here`）—— 而 cascade 那一刻
--     `auth.uid()` 是 null，所以它答「不是你的」，然后把整句删除挡下来
--
-- → **一个在触发器里问「你是谁」的守卫，会挡住每一次没有身分的清理。**
--
-- 修法照 20260905810000 给 `follow_ups` 用的那一半：**只在
-- `project_id` 真的被写的时候才跑**。`by_who` 被设成 null 不会碰它。
-- （这张表没有 `updated_at` 要顺手更新，所以收窄触发的栏没有代价 ——
-- 那正是 20260906150000 里其余九张不能这样做的理由。）
--
-- ⚠️ 而拿掉这一层不等於没有人管:
--   · 写进去只有 `snooze_nudge` 那一支（security definer，第一句就是 works_here）
--   · 那张表**没有 insert / update 政策**，所以直接写进不去
--   · 读只有 `works_here` 那一条 select 政策
-- 守卫挡的是「绕过那支函式、直接插一行到别人家」，而那一件
-- 插入的时候照旧会被挡 —— 触发器还是 `before insert`。

drop trigger if exists nudge_snoozes_guard on public.nudge_snoozes;
create trigger nudge_snoozes_guard
  before insert or update of project_id on public.nudge_snoozes
  for each row execute function public.nudge_snoozes_own_project();

comment on function public.nudge_snoozes_own_project() is
  'Only fires when project_id is actually written. It asks who you are, and a cascade cleanup has nobody -- so firing it on every column would block deleting an account. See 20260906170000.';

drop function if exists public.probe_delete_user_4(uuid);

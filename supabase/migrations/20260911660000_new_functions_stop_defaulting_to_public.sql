-- 🔴 20260911640000 补的是过去 353 支的洞。这一条补的是**以后**——
-- Postgres 的默认行为是「建一支函式，EXECUTE 自动送给 public 伪角色」，
-- 这个仓库靠人记得每次手写 `grant execute ... to authenticated` 之后
-- 还要另外记得 `revoke ... from public`，而 353 支里有 77 支就是
-- 忘了那一步。**靠人记得的规矩，迟早会有人忘记**——这正是[重点 31]
-- 「先做『加』最安全」反过来的例子：Postgres 那条隐藏的默认「加」，
-- 加的是一个从来没有人要过的权限。

-- 改掉这个专案往后建函式的默认值：以后每一支新函式，Postgres 一开始
-- 就不给 public 任何执行权，要嘛显式 `grant ... to authenticated`，
-- 要嘛显式 `grant ... to anon`——跟这个仓库一直在做的事一模一样，
-- 只是从「记得撤销」换成「不给就是不给，想给要自己写」。
-- 只影响以后新建的函式，今天已经存在的 353 支一个字不受影响
-- （它们的权限是各自 migration 里已经跑过的 grant/revoke 决定的）。
alter default privileges in schema public revoke execute on functions from public;

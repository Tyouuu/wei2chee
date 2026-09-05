-- 🔴 档案写着有，资料库里没有。
--
-- `check:closable` 量到：删掉那个员工之后，`follow_ups.created_by`
-- **还留着他的 id**。而 20260905800000 的建表语句白纸黑字写着
--
--     created_by uuid references auth.users(id) on delete set null,
--     done_by    uuid references auth.users(id) on delete set null,
--
-- 去问资料库（临时探针 `probe_user_fks`，逐条读 pg_constraint）：
-- 二十六个指向 auth.users 的外键里，**`follow_ups` 一个都没有**。
-- 其余十张表全部在。
--
-- 🔴 这是 [重点 26] 那一句最纯粹的一次：**`db push` 成功证明不了任何事。**
-- 那一支推上去回报成功、测试全绿、四十条真呼叫全过 ——
-- 而那两个约束从来没有真的存在过。看得出来的唯一方法是**去问资料库**。
--
-- 后果不是「少一个约束」，是**那一栏会永远握着一个已经不存在的人的 id**：
-- 「这一条是谁写的」从此答不出来，而画面上跟一个正常的 id 长得一模一样。
--
-- ⚠️ 补之前要先把已经断掉的洗成 null，不然新约束验证不过。

update public.follow_ups f
   set created_by = null
 where f.created_by is not null
   and not exists (select 1 from auth.users u where u.id = f.created_by);

update public.follow_ups f
   set done_by = null
 where f.done_by is not null
   and not exists (select 1 from auth.users u where u.id = f.done_by);

alter table public.follow_ups
  drop constraint if exists follow_ups_created_by_fkey,
  add constraint follow_ups_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.follow_ups
  drop constraint if exists follow_ups_done_by_fkey,
  add constraint follow_ups_done_by_fkey
    foreign key (done_by) references auth.users(id) on delete set null;

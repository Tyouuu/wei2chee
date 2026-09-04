-- 🔴 `sees_money` 对一个陌生人回的是 **null**，不是 false。
--
-- ── 这是一个已经上线的洞，而它不是这一轮才写的 ─────────────────────────────
--
--     select public.my_role(in_project_id) = 'owner';
--
-- 一个不属於这个专案的人，`my_role` 回 null，而 **`null = 'owner'` 是 null**，
-- 不是 false。所以：
--
--     if not public.sees_money(pid) then
--       raise exception 'not your project';
--     end if;
--
-- `not null` 是 null，而 plpgsql 的 `if null then` **什么都不做** ——
-- 那一句 raise 从来没有机会讲话。**守卫是开着的。**
--
-- 实测（2026-09-04，两个真的登入身分）：
--     stranger my_role:     null
--     stranger sees_money:  null        ← 不是 false
--     STRANGER set -> error: undefined  ← 他改掉了别人师傅的薪水
--     row now: rate_cents 999900, epf_part null
--
-- 他不只改了金额 —— `on conflict do update` 把那个人的**公积金类别清成 null**，
-- 也就是下一次发薪那个人一分公积金都不会被扣，而画面上完全正常。
--
-- ── 为什么 `works_here` 没事，而这是这件事里最要紧的一句 ────────────────────
--
--     works_here  = my_role(...) **is not null**   → 真正的布林，永远不是 null
--     sees_money  = my_role(...) **= 'owner'**     → 陌生人拿到 null
--
-- 所以十四个 `if not works_here(...)` 的守卫全部是好的，
-- 而 `sees_money` 那几个是开的。**一个字的差别，两种失败方向。**
--
-- ── 而 policy 那一边是安全的，理由值得写下来 ──────────────────────────────
--
-- RLS 的 `using (...)` 把 null 当成「不给」——**失败方向是关的**。
-- plpgsql 的 `if not ... then raise` 把 null 当成「不用挡」——**失败方向是开的**。
-- 同一支函式，同一个 null，两个相反的结果。
-- 所以这个洞在**每一条 policy 上都不存在**，只在**函式里的守卫上**存在。
--
-- ── 修在源头，一行 ────────────────────────────────────────────────────────
--
-- 20260901010000 的档头自己写着为什么这个问题只问一个地方：
-- 「A third role that also sees it costs one line here and nothing anywhere
--  else, which is the reason the question is asked in one place.」
-- 那句话今天兑现了 —— 一行，十九个呼叫点一起好。

create or replace function public.sees_money(in_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  /* 🔴 `coalesce(..., false)`：不属於这个专案的人拿到的是 **false**，不是 null。
     少了它，`if not sees_money(...) then raise` 那一句永远不会执行 ——
     因为 `not null` 是 null，而 `if null then` 什么都不做。 */
  select coalesce(public.my_role(in_project_id) = 'owner', false);
$$;

comment on function public.sees_money(uuid) is
  '只有老板看得到钱。⚠️ 一定要 coalesce 成 false —— 回 null 的话，函式里那些 `if not sees_money(...) then raise` 的守卫会静静地放行（2026-09-04 实测：一个陌生人改掉了别人师傅的薪水跟公积金类别）。';

/* `works_here` 本来就是 `is not null`，永远回真正的布林。
   照样明写一次 —— 下一个人复制这两支的时候，两支长得一样比较不会挑错。 */
create or replace function public.works_here(in_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role(in_project_id) is not null, false);
$$;

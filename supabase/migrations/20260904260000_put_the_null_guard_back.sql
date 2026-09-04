-- 修回去。20260904250000 是故意弄坏的，为了看那几条守卫红 —— 看到了：
--   FAIL  陌生人问 sees_money，拿到的是 false，不是 null
--   FAIL  陌生人开不了我的分店
-- 而「陌生人设不了我师傅的抽成」**没有红**，理由值得写下来（见 20260904240000
-- 的档头补充）：那一支用的是 `select exists (... where sees_money(...))`，
-- 而 WHERE 里的 null 是「不符合」—— 失败方向是关的。
-- 只有 `if not sees_money(...) then raise` 那个形状会开。
create or replace function public.sees_money(in_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.my_role(in_project_id) = 'owner', false);
$$;

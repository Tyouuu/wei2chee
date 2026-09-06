-- 一间补习中心开箱开不了一张学费单。
--
-- `walk:tuition`（[任务 239](#239)）走的第一趟就撞到：
--   🔴 开一张学费单 — 开不了：not a pipeline module: bookings
--
-- 教育那一组的开局是 总览 · 客户 · 预约 · 收款 · 官网 ——
-- **一页会开单的都没有**。而「这个月谁还没交」是从走单那张表
-- 减掉分摊算出来的（`party_debts`），所以那不是一个难答的问题，
-- 是一个**永远答不出来**的问题 —— 而它正是一间补习中心的老板
-- 每个月在问的那一句。
--
-- `orders` 而不是 `quotations`：**没有人跟家长报价**。目录自己写着
-- 订单是「适合成交量大、不用逐单报价的生意」，每个月一样的学费
-- 正好是那个形状。
--
-- ⚠️ 沙龙那一行**故意不动**：`walk:salon` 整条钱那一半走的是套票
-- 跟柜台收款，而一页她从来不开的单，是一页她每天要滑过去的东西。
--
-- ⚠️ 这一支跟 `lib/portal/module-catalog.ts` 的 `DEFAULT_MODULES_FOR_INDUSTRY`
-- 是**同一份名单的两种语言**，而没有任何东西逼它们一致 ——
-- 逼它们一致的是 `industry-template.test.ts` 那条「SQL 那一份要对得上」，
-- 而它**在这一支写出来之前就红了**，红的正好是 education 这一行。
--
-- ⚠️ 从 20260822040000 —— 最后一次定义它的那个档案 —— 原样抽出来改那一行。

create or replace function public.pages_for_industry(industry_slug text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case industry_slug
    when 'beauty' then array['dashboard', 'customers', 'bookings', 'payments', 'website']
    when 'education' then array['dashboard', 'customers', 'bookings', 'orders', 'payments', 'website']
    when 'fnb' then array['dashboard', 'customers', 'orders', 'payments', 'website']
    when 'retail' then array['dashboard', 'customers', 'orders', 'inventory', 'payments', 'website']
    when 'wholesale' then array['dashboard', 'customers', 'quotations', 'orders', 'inventory', 'payments', 'website']
    else array['dashboard', 'customers', 'quotations', 'projects', 'payments', 'website']
  end;
$$;

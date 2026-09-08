-- 八个行业，八个开局都记不了一笔花出去的钱。
--
-- 2026-09-09 量的：`expenses` 跟 `commission` 在
-- `lib/portal/module-catalog.ts` 里只出现过一次 —— 在目录的定义上，
-- **没有一个行业的开局清单带过它们**。
--
-- 而收款那一页记不了出去的钱：`new-record-form` 的
-- `spendsMoney = isLedger && moduleKey !== "payments"`，也就是收款那一页
-- 的方向永远是「进来」，那个方向的下拉只画给对帐。
--
-- 后果两件，两件都是「永远答不出来」而不是「难答」：
--
--   🔴 「这个月赚多少」= 进来的 − 花出去的（`lib/portal/profit.ts`）。
--      一笔开销都记不了，那一格永远不画 —— 而那是它自己的规矩
--      （一笔开销都没有的时候「赚」等於「收到」，画出来是宣称一件
--      我们不知道的事）。所以画面上连一句「为什么没有」都没有。
--
--   🔴 拍一张收据自动变一笔开销（[任务 271](../../docs/founder-tasks.md)，
--      22 条真的浏览器断言全过，而三家最大的记帐软件把它放在商店页
--      前两屏）—— 那颗相机只画在 `spendsMoney` 的表单上，**所以没有一个
--      客户的开箱系统到得了它**。
--
-- 跟 20260906740000 那次「教育开不了单」是同一个形状：一个不难答的问题，
-- 因为少一页而变成一个不可能答的问题，而没有任何东西会讲。
--
-- ── 沙龙另外多两页 ────────────────────────────────────────────────────
--
-- 他 2026-09-09 问「就是 commission 对吗 没有 stock management 吗」。
-- 逐项对了五家沙龙软件的功能表，他问的两句正好是空的：
--
--   🔴 抽成 —— Amy 这个月做了多少、该抽多少
--   🔴 库存 —— 洗发水、面膜还剩几盒
--
-- 两样我们都建好了（阶梯佣金是分段算的、不是整笔跳档；库存有补货线、
-- 盘点、一箱几罐、分店、批号效期），而美容开局那五页两样都没有。
-- 而这个市场比全球那一批更需要它们：Aoikumo 讲它有二十多种佣金算法、
-- 还有产品库存跟批号效期，Tunai 的头条就是阶梯佣金（[任务 67]）。
--
-- `staff` 而不是 `commission`：她问的是「Amy 抽多少」不是「这个月一共抽了
-- 多少」—— 前者住在师傅那一页上，后者是第三张跟收款、开销长得一模一样的
-- 钱页（[任务 301] 量过那三页共用同一支骨架）。
--
-- ⚠️ 沙龙照旧没有一页开得了单 —— 那一条是故意的（`walk:salon` 整条钱
-- 那一半走的是套票跟柜台收款），理由写在 `module-catalog.test.ts`
-- 的 BILLS_NOTHING 上。
--
-- ⚠️ 这一支跟 `lib/portal/module-catalog.ts` 的 `DEFAULT_MODULES_FOR_INDUSTRY`
-- 是同一份名单的两种语言，而没有任何东西逼它们一致 —— 逼它们一致的是
-- `industry-template.test.ts` 那条「SQL 那一份要对得上」。
--
-- ⚠️ 从 20260906740000 —— 最后一次定义它的那个档案 —— 原样抽出来改那几行。

create or replace function public.pages_for_industry(industry_slug text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case industry_slug
    when 'beauty' then array['dashboard', 'customers', 'bookings', 'payments', 'expenses', 'staff', 'inventory', 'website']
    when 'education' then array['dashboard', 'customers', 'bookings', 'orders', 'payments', 'expenses', 'website']
    when 'fnb' then array['dashboard', 'customers', 'orders', 'payments', 'expenses', 'website']
    when 'retail' then array['dashboard', 'customers', 'orders', 'inventory', 'payments', 'expenses', 'website']
    when 'wholesale' then array['dashboard', 'customers', 'quotations', 'orders', 'inventory', 'payments', 'expenses', 'website']
    else array['dashboard', 'customers', 'quotations', 'projects', 'payments', 'expenses', 'website']
  end;
$$;

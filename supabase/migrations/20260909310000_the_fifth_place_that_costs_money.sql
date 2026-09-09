-- ── 第五个花钱的地方：把他讲的话变成字 ──────────────────────────────────
--
-- 20260905010000 那一支的注解自己写着：「加第五个的时候，
-- `lib/portal/ai-usage.ts` 的 UsageSurface 要一起加 —— 那是手写的第二份名单。」
-- 这就是第五个。
--
-- 🔴 为什么现在有第五个（2026-09-09）
--
-- 老板交办去读国外的新概念，读回来数字最硬的那一个是**用讲的**：
-- Gartner 说 2026 年 75% 的外勤公司会用语音；ServiceTitan 的行业报告说
-- 12% 已经在用、34% 在试。而这个仓库量出来是**零个语音输入** ——
-- 一个戴着手套、手上带油的师傅打不了字。
--
-- `/api/portal/hear` 是那一条：一段声音进来，几个字出去，**转完就丢**。
--
-- ⚠️ 这是一条**放宽**（[重点 31]：多一个允许的值），不是收紧 ——
-- 今天在跑的四个 surface 一个字都不会变。
--
-- ⚠️ 而它的**单价没有进 `PRICE_PER_MTOK`**：那张表算的是 token，
-- 转录计价的单位跟它不同，而我没有查到可靠的单价（[重点 15]：
-- 查不到就写查不到）。用量照样记，`check:ai-cost` 会对它印「价格未知」——
-- 那是实话，不是漏做。

alter table public.ai_usage drop constraint if exists ai_usage_surface_check;
alter table public.ai_usage add constraint ai_usage_surface_check
  check (surface in ('analyze', 'edit', 'spec', 'receipt', 'hear'));

comment on constraint ai_usage_surface_check on public.ai_usage is
  '五个花钱的地方。加第六个的时候，`lib/portal/ai-usage.ts` 的 UsageSurface 要一起加 —— 那是手写的第二份名单。';

-- ── 第六个花钱的地方：把一份作品变成一句能发的文案 ──────────────────────
--
-- `20260909310000` 那一支的注解自己写着：「加第六个的时候，
-- `lib/portal/ai-usage.ts` 的 UsageSurface 要一起加 —— 那是手写的第二份名单。」
-- 这就是第六个。
--
-- 起因：GlossGenius 2026-07 把整个产品重牌成「Genius AI」，卖点就是自动帮
-- 沙龙写社群文案。我们的 Lookbook（20260925040000）已经存着一份做出来的
-- 名字、色阶、配方、标签——文案能从这几栏直接算出来，不用她自己想。
--
-- ⚠️ 这是一条**放宽**（[重点 31]：多一个允许的值），不是收紧——
-- 今天在跑的五个 surface 一个字都不会变。

alter table public.ai_usage drop constraint if exists ai_usage_surface_check;
alter table public.ai_usage add constraint ai_usage_surface_check
  check (surface in ('analyze', 'edit', 'spec', 'receipt', 'hear', 'caption'));

comment on constraint ai_usage_surface_check on public.ai_usage is
  '六个花钱的地方。加第七个的时候，`lib/portal/ai-usage.ts` 的 UsageSurface 要一起加 —— 那是手写的第二份名单。';

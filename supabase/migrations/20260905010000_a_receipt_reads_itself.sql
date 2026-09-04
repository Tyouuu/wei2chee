-- 拍一张收据，它自己变成一笔开销。
--
-- ── 为什么这一件排在所有行业包前面 ───────────────────────────────────────
--
-- 老板 2026-09-04 顶了我两次，两次都对：我一直在拿装修当全部（八个行业里
-- **五个连报价单那一页都没有**），而他要的是 **八个行业全部要的东西**。
--
-- 这一件是八分之八：沙龙买洗发水 · 餐厅买菜 · 补习班交租 · 车厂入零件 ·
-- 批发付运费 · 装修买水泥。**每一个老板每天都在做，而没有一个老板喜欢打字。**
--
-- 而它还解一件比功能更要紧的事（[重点 9c] 留客四根柱第 ②）：
-- **要靠人天天打字的系统，三个月后是空的。** 一张相机是这本帐唯一
-- 不用他打字就会长大的入口。
--
-- 实拍过的旁证（任务 106，2026-09-02）：Xero「Receipts in a snap」·
-- QuickBooks「Send invoices from anywhere」· Zoho —— **三家记帐 app
-- 都把它放在商店页前两屏**。三个已经上线的产品各自替它背书。
--
-- ── 🔴 这个桶不是 job-photos，而这是这一支最要紧的一句 ──────────────────
--
-- 20260904010000 建的 `job-photos` 问的是 `works_here()` —— **师傅传得进去、
-- 也看得到**，而那是对的：拍工地照的本来就是他。
--
-- 一张收据不是。它是**这门生意花了多少钱**：进货价 · 供应商给他的折扣 ·
-- 他一个月的租金。而钱这一层从 20260901010000 起只有一个人看得到
-- （收款 · 开销 · 佣金三页师傅连网址打进去都打不开）。
--
-- **把收据放进 job-photos，等於让每一个师傅读得到老板的进货价。**
-- 所以：另一个桶，问的是 `sees_money()`。
-- **桶的界线跟钱的界线对齐** —— 跟 job-photos 当初不肯放进 site-photos
-- 是同一种判断，只是那一次分的是「陌生人 / 自己人」，这一次分的是
-- 「自己人 / 老板」。
--
-- ⚠️ **所以师傅今天报不了帐**（他在工地买了三包水泥、拍了收据）。
-- 那是**另一件事**（报销：他提交 → 老板批 → 才变成一笔开销），
-- 而它需要一张自己的表跟一个自己的状态。**写下来，不要以后当成漏做。**

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  /* 🔴 false。见档头。 */
  false,
  8388608,
  /* 只收图。PDF 读得了的话这里要多一格 —— 而供应商寄 PDF 发票是真的会发生
     （e-Invoice 之后更多）。**今天不收，因为模型这一端还没有喂 PDF 的路，
     而一个收得进去、读不出来的档案，比不收更糟。** */
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* 路径是 `<project_id>/<uuid>.<ext>`，所以第一段就是那一家。
   ⚠️ **不带单据 id**，而这是照流程决定的：他是**先拍照，再开单**，
   照片存进去的那一刻那一笔开销还不存在。 */
drop policy if exists "receipts are read by whoever sees the money" on storage.objects;
create policy "receipts are read by whoever sees the money"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.sees_money(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "whoever sees the money uploads a receipt" on storage.objects;
create policy "whoever sees the money uploads a receipt"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and public.sees_money(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "whoever sees the money removes a receipt" on storage.objects;
create policy "whoever sees the money removes a receipt"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.sees_money(((storage.foldername(name))[1])::uuid)
  );

-- ── 那一栏早就在了，而三个星期没有人写过它 ───────────────────────────────
--
-- `ledger_entries.receipt_url` 从 20260831020000 建表那天就在，两支写入函式
-- **从第一版就收它**（`in_receipt_url`）—— 而 grep 全仓库：
-- **零个 TypeScript 传过它**。这是这个仓库的招牌毛病第十八次
-- （「能力有、线没接」），而这一次它正好挡在他要的那件事前面。
--
-- ── 🔴 它存的是**路径**，不是网址，而名字在骗人 ─────────────────────────
--
-- 桶是 private 的，所以能打开那张图的只有**签出来的网址**，而签名会过期。
-- 20260904010000 白纸黑字写过同一句：**存一个会过期的字串，
-- 等於存一个明天变成假的东西。**
--
-- 那为什么不改名？改名要把 `add_ledger_entry`（18 个参数）跟
-- `update_ledger_words` 整支重写一遍 —— 而这个仓库**已经在重写这两支的
-- 时候掉过一次东西**（20260831080000 抄的时候漏了 `unique_violation`
-- 那一段，090000 才补回来）。为了一个名字去动产品里最常被改的两支函式，
-- 不划算。
--
-- **所以改的是行为，不是名字**：加一条约束，让它**存不进去一个网址**。
-- 一个改不了名字的栏位，至少可以让它不能说谎。
--   ⚠️ 而名字还是会误导下一个人，所以这一条登记着：
--      哪天要动那两支函式，顺手把它改成 `receipt_path`。

comment on column public.ledger_entries.receipt_url is
  '🔴 存的是 private `receipts` 桶里的**路径**（`<project_id>/<uuid>.jpg`），不是网址 —— 签名会过期，存一个会过期的字串等於存一个明天变成假的东西。名字是历史遗留，见 20260905010000 的档头。';

do $$
begin
  /* 一个已经存着网址的旧值会让这条约束加不上去 —— 而那正是我们想知道的事。
     今天量过是零行，所以直接加；哪天真的挡下来，那一行本来就该修。 */
  if not exists (
    select 1 from pg_constraint where conname = 'ledger_entries_receipt_is_a_path'
  ) then
    alter table public.ledger_entries
      add constraint ledger_entries_receipt_is_a_path
      check (receipt_url is null or lower(receipt_url) not like 'http%');
  end if;
end $$;

-- ── 帐本要认得第四个花钱的地方 ───────────────────────────────────────────
--
-- 20260827060000 的档头写着为什么这一条必须跟着改：
-- **「一个不在这条约束里的 surface，写进去会被拒绝，而 `recordAiUsage` 是
-- 故意吞掉错误的」** —— 也就是这条线会静静地一行都不记，然后那张
-- 「AI 花了多少钱」的报表会一脸正常地少算一个花钱的地方。
--
-- ⚠️ `lib/portal/ai-usage.ts` 那个联合型别是**手写的第二份**，
-- 而它自己的注解就写着「kept in step by hand」。两边一起改，
-- 而且 `ai-usage.test.ts` 会盯着。

alter table public.ai_usage drop constraint if exists ai_usage_surface_check;
alter table public.ai_usage add constraint ai_usage_surface_check
  check (surface in ('analyze', 'edit', 'spec', 'receipt'));

comment on constraint ai_usage_surface_check on public.ai_usage is
  '四个花钱的地方。加第五个的时候，`lib/portal/ai-usage.ts` 的 UsageSurface 要一起加 —— 那是手写的第二份名单。';

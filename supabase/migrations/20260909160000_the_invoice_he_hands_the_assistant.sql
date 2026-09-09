-- ── 他递给助手的那张图，进一个私人的桶 ──────────────────────────────────
--
-- 老板 2026-09-09 自己讲的，他要用助手做什么：
--
--     `好像讀截圖啊 拍照給妳分析啊 上傳invoice啊 打字要你處理產品裡面的事情啊`
--
-- 🔴 而在这一支之前，那张 invoice 上传之后拿到的是一条 **PUBLIC READ** 的网址。
--
-- `ai-assistant.tsx` 的那颗回形针传进 `site-photos`，然后 `getPublicUrl()` ——
-- 一条**永久、不用登入、任何人打得开**的连结，指着他供应商开给他的发票：
-- 他的进货价、他的供应商是谁、他一个月的租金。
--
-- ── 🔴 而同一件事这个仓库已经做对过一次 ──────────────────────────────────
--
-- `/api/receipt`（20260905010000）走的正好是相反的一条：桶是 private 的、
-- 只有看得到钱的人打得开、**把位元组送上去而不是签一条网址**，它的档头
-- 一字不差写着为什么：
--
--     「一个签出来的网址是任何拿到那条连结的人都打得开的东西，
--       而这张图上印着他的进货价、他的供应商、他一个月的租金。」
--
-- **一件事两条路，只保护了一条** —— 这个仓库每一次「说了没做」的形状，
-- 而这一次它长在他刚讲的那个用法上。
--
-- ── 为什么是新的一个桶，不是塞进 `receipts` ─────────────────────────────
--
-- 他附给助手的那张图**不一定是收据**：可能是别人家官网的截图、可能是他用了
-- 十五年的那张手写工单、也可能是发票。塞进 `receipts` 会让开销那一页的收据
-- 里混进别人家的官网截图，而 `receipts` 挡的是 `sees_money` —— 一个师傅
-- 附一张工地的截图问助手，会被那道闸挡掉，而那件事跟钱无关。
--
-- 所以：**自己一个桶，挡 `works_here`（在这一家做事的都进得来），
-- 而且 private。**
--
-- 🔴 判「公开还是私人」的那一条，写下来给下一个人：
-- **助手收到的图是一个「问题」，不是「要贴到官网上的内容」。**
-- 要贴到官网上的那条路早就分开存在（`photo-field.tsx` → `site-photos`，
-- 那条本来就该是公开的）。一个问题永远不需要一条公开的网址。
--
-- ── 旧的那些还在 `site-photos` 里 ────────────────────────────────────────
-- ⚠️ 这一支**不搬、也不删**已经传上去的 `ask-*`。删档案是不可逆的，而这棵树
-- 上还有另外两个 session 在跑（重点 20）。登记进任务档，由老板决定。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ask-photos',
  'ask-photos',
  /* 🔴 false。这就是这一支存在的全部理由。 */
  false,
  8388608,
  /* 跟 `receipts` 同一份清单，同一个理由：PDF 收得进来而模型这一端还没有
     喂 PDF 的路，一个收得进去、读不出来的档案比不收更糟。 */
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 路径是 `<project_id>/ask-<uuid>.<ext>`，所以第一段就是那一家 ——
-- 跟 `job-photos` / `receipts` 同一个形状，那道闸才读得懂。
drop policy if exists "ask photos are read by whoever works there" on storage.objects;
create policy "ask photos are read by whoever works there"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ask-photos'
    and public.works_here(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "whoever works there uploads an ask photo" on storage.objects;
create policy "whoever works there uploads an ask photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ask-photos'
    and public.works_here(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "whoever works there removes an ask photo" on storage.objects;
create policy "whoever works there removes an ask photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ask-photos'
    and public.works_here(((storage.foldername(name))[1])::uuid)
  );

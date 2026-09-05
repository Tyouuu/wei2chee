<!-- 这一份是 `npm run brief` 产生的，不要手改 —— 改了下一次跑就没了。
     每一个数字都是从仓库自己身上量出来的；量不到的印「量不到」。 -->

# 交接单 · 2026-09-05

一张**指路的单子**，不是那本帐。规矩跟历史在另外两份档案里 ——
读完这一页再去读它们。

---

## 一 · 这是什么

**Formae** —— 马来西亚中小企业的一套系统 ＋ 一个官网。
老板讲两分钟自己的生意 → 当场看到**他自己的系统** → 自己调 → 交给我们建。
**年费 RM 1,500（月缴 RM 150）＋ 建置费 RM 1,500。**

🔴 **对外不要讲「ERP」** —— 讲那个词就自动站到 SQL Account（RM 79/月 · 含税务单据 ·
保证十年不涨价）跟 AutoCount（24 万家）对面。对内叫引擎，对外只讲
「你每天做的那几件事 ＋ 官网 ＋ 询价自动变单」。

---

## 二 · 规矩住在哪（**动手之前一定要读**）

| 档案 | 多大 | 是什么 |
|---|---|---|
| `docs/founder-points.md` | 1,042 行 · 30,019 字元 | **老板讲过的原则。** 永远适用，一条都不要跳 |
| `docs/founder-tasks.md` | 14,348 行 · 500,727 字元 | **只加不改的帐**：每一件事当初为什么这样决定 |

⚠️ 任务档太大，**贴不进多数工具**。用
`grep -n "### 156" docs/founder-tasks.md` 去读某一条，不要整份读。

**最要紧的七条**（其余去读原档）：

1. **一件没收尾，不准开下一件。** 他一天讲过三次
2. **用眼睛看，不要用量的。** 数字全绿而画面是坏的，这里发生过十几次
3. **改完自己先看那张图，再拿给他。** 眼睛看到而尺子量不到的，**当场补成一条会红的守卫**
4. **`supabase db push` 成功证明不了任何事** —— 那一层到**执行**才解析名字。
   每一支都要**用真的客户身分打一次**
5. **不准整支重写一个已经在跑的函式**，要在原来那一支上加。
   被咬过三次：漏掉防重复（按两下开两张单）· 漏掉分店守卫 · 漏掉出货数量比对
6. **AI 打人按的那一支**，不准有第二条写入路径
7. **报告里不准出现英文技术词** —— 他看不懂就等於没讲

---

## 三 · 🔴 三个 session 共用同一个工作目录

| | 管什么 |
|---|---|
| **功能地基** | 表 · 权限 · 单号 · 触发器 · 写入那几支 · 算钱那一层 · **守卫（`check:*`）** |
| **画面** | 一页由哪几块组成 · 什么顺序 · 长什么样 · 风格库 |
| **研究** | 去读别人真的表跟价目 · 市场 · 走一遍量出哪里断了 · **探针（`walk:* shoot:* align`）** · 写这两份档案 |

**三条规矩，缺一条就会打架：**

1. **永远逐个档名提交**（`git commit -F <讯息档> -- <路径>`）。
   **不准 `git add -A`** —— 那会把别人还没提交的东西扫进你的提交，发生过三次
2. **动之前先看 `git status`。** 那个档案已经被改过而不是自己改的 → **只登记不动手**
3. **任务档写编号之前先拿最大的加一**，撞到了**改自己的号，不要改别人的**

### 现在别人手上有（11 个档案，**一个都不要碰**）

- `M AGENTS.md`
- `M app/[locale]/portal/[pageKey]/[recordId]/page.tsx`
- `M app/[locale]/portal/[pageKey]/record-copy.ts`
- `M app/r/[ref]/sign-form.tsx`
- `M lib/templates/copy/chrome.ts`
- `M lib/templates/industry-template.ts`
- `M package.json`
- `M scripts/shoot-pages.mjs`
- `?? app/[locale]/portal/[pageKey]/new/delivery-panel.tsx`
- `?? lib/templates/document-pages.test.ts`
- `?? scripts/shoot-delivery.mjs`

---

## 四 · 今天站在哪里

### 十个零件

- **pipeline** —— 会写真资料
- **ledger** —— 会写真资料
- **directory** —— 会写真资料
- **catalog** —— 会写真资料
- **overview** —— 真的，但它不存东西
- **report** —— 真的，但它不存东西
- **leaderboard** —— 真的，但它不存东西
- **reconcile** —— 会写真资料
- **calendar** —— 会写真资料
- **landing** —— 还是画的

### 🔴 开出去几支 · 画面接了几支

| | 几支 |
|---|---|
| 资料库开出去的 | **162** |
| 画面在呼叫的 | **82** |
| 🔴 **只有尺子打过的** | **69** |
| 一个地方都没碰过的 | 11 |

**那 69 支每一支都用真的客户身分验过、每一支都有红过的守卫，
而一个老板从头到尾找不到那颗按钮。**
这是这个仓库的招牌毛病（「能力有、线没接」），而今天它长在最贵的地方。

### 陌生人做得了几件事（9 支）

- `answer_shared_record`
- `get_public_site`
- `party_portal`
- `public_booking_slots`
- `public_shared_record`
- `sign_delivery`
- `submit_party_request`
- `submit_site_booking`
- `submit_site_enquiry`

⚠️ **这几支里大部分画面上没有门。** 而护城河 ——「钱跟客人从那里进来」——
正好就是这几件。

### 尺

守卫 **43** 把（`npm run check:*`）· 探针 **71** 把。
⚠️ **数字只能否决，不能通过** —— 通过要用眼睛看那张图。

---

## 五 · 最近做完什么

- `ff9ff4b  Nobody buys a website they already decided against`
- `07b6422  The only conversion button on the public site finally lands somewhere`
- `c0bd6ae  The homeowner opens his own quotation, and can say yes to it`
- `9082bdf  The throwaway account that survived because finally never ran`
- `9dba1eb  Reconciliation takes half of the infrastructure screen, and says which half`
- `31c70d0  Reports and ranking take the analytics and crm screens`
- `dcfc6b1  Task 194: the last inch for all four holes`
- `d2b6e24  The dealer has a link, and what he says arrives as a row`
- `9e32a70  The money pages stop being one page drawn three times`
- `30cee87  Seventy-two functions that work, and no button for any of them`
- `8e2a83f  He can close a month now, and reopen it`
- `e7b1f7c  Eighteen pages, shot the way he actually opens them`

---

## 六 · 挡在第一个客户前面的两件

1. 🔴 **收款闸道** —— 客户付不了钱。**挡着其余全部**
2. 🔴 **公司注册** —— 挡着收款开户 · 政府补助 · 开发票 · 上架

**两件都不是技术，是老板要去办的事。**
而**付钱的客户今天是 0 个** —— 所以上面每一件功能都还没有被市场验过。

---

<!-- 产生：npm run brief · 2026-09-05 -->

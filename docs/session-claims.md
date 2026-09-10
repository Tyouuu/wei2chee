# 谁在改哪几个档案 —— 抄自 headcount 的做法

由 [任务档](./founder-tasks.md) 那一条深度研究带回来的（2026-09-10，读 `cbrock84/headcount`，MIT）。
它的做法：一份表写清楚哪个资料夹归谁，一支脚本每次检查有没有两片地重叠。
**我们不能照抄它的形状**——它是「16 个固定部门，各管一个资料夹」，
而我们是「三个 session 同一天可能改同一个档案」，边界是动态的，不是固定的资料夹。

所以这里抄的是**做法**，不是它的档案结构：
**改之前先在这里登记你要碰哪些档案；改完、提交完，把那一行划掉。**
`npm run check:claims` 会检查现在挂着的（还没划掉的）那几行有没有重叠 ——
两个 session 同时宣称同一个档案，它就报错。

⚠️ **这不是取代 `git status`**（[重点 20](./founder-points.md) 那一条还是先做），
是补上 `git status` 补不到的那一半：**别人还没动手、但已经打算动手**的那个档案。

格式：一行一个 session，`|` 分隔的档名或者 glob，用完划掉（删这一行，不要留着打勾）。

| session | 档案（逗号分隔） | 从几时 |
|---|---|---|
| 功能层（我） | scripts/check-all.mjs, scripts/check-visit.mjs, scripts/check-closable.mjs, scripts/check-nudges.mjs, scripts/check-records.mjs, scripts/check-lint*, supabase/migrations/2026091[1-2]*.sql | 2026-09-11 深夜 |

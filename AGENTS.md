# 开工之前读这三份

这个仓库是 **Formae** —— 马来西亚中小企业的一套系统加一个官网。
它有一套写下来的规矩，而那套规矩是老板一句一句讲出来的，不是惯例。
**跳过它们写出来的代码，这里退过很多次。**

| 顺序 | 档案 | 为什么 |
|---|---|---|
| 1 | `docs/handoff-brief.md` | **一张现况单，四千字，先读这一份。** 它是 `npm run brief` 从仓库自己身上量出来的 —— 今天站在哪里、别人手上有什么不要碰 |
| 2 | `docs/founder-points.md` | **老板讲过的原则。** 永远适用 |
| 3 | `docs/founder-tasks.md` | **还没做完的那几行**（一百 KB，读得完）。做完的只剩编号跟标题 |
| 4 | `docs/founder-tasks-archive.md` | 全文封存，**不自动读进来**。用 `grep -n "### 156" docs/founder-tasks-archive.md` 去读某一条 |

```bash
npm run brief   # 重新量一次，写出 docs/handoff-brief.md
```

## 🔴 三条一定不要犯的

1. **这个目录同时有好几个 session 在写。**
   永远逐个档名提交（`git commit -F <讯息档> -- <路径>`），
   **不准 `git add -A`** —— 那会把别人还没提交的东西扫进你的提交。
   动之前先 `git status`；那个档案不是你改的 → **只登记，不动手**
2. **`supabase db push` 成功证明不了任何事** —— 那一层到**执行**才解析名字。
   每一支都要**用真的客户身分打一次**
3. **不准整支重写一个已经在跑的资料库函式**，要在原来那一支上加 ——
   被咬过三次，每一次都是漏掉一段守卫，而画面上看不出来

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

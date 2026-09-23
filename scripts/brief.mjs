#!/usr/bin/env node
/**
 * npm run brief  →  docs/handoff-brief.md
 *
 * ── 这个档案为什么存在 ────────────────────────────────────────────────────
 *
 * `docs/founder-tasks.md` 到 2026-09-05 是 **50 万个字元 · 14,347 行**
 * （2026-09-09 拆了：还没做完的留在原档，全文进 `founder-tasks-archive.md`）
 * （位元组是它的两倍 —— 中文一个字三个，`wc -c` 数的是位元组）。
 * 那是一本**只加不改的帐**，对「这件事当初为什么这样决定」是对的，
 * 而它**贴不进任何一个新的工具** —— 大概二十五万个词元，比多数模型
 * 一次读得进去的还多。
 *
 * 所以交接不是「把那本帐搬过去」，是**另外出一张现况单**。
 *
 * ── 🔴 而这张单一个字都不准手写 ────────────────────────────────────────
 *
 * 这个仓库判过至少七次同一件事：**存起来的数字会说谎，算出来的不会**
 * （架上有几件是流水加起来的 · 过期是日历算的 · 帐龄是日期算的 ·
 *  保养到期日是排程算的 · 车子里程是最后一笔读数 · 批号余额 · 试算表）。
 *
 * 一张手写的现况单会在写完的第二天开始骗人，**而它看起来跟一张对的一模一样**。
 * 所以下面每一个数字都是从仓库自己身上量出来的：
 *
 *   · 十个零件的状态           ← lib/portal/shape-state.ts
 *   · 陌生人做得了几件事       ← supabase/migrations 里 `to anon` 的 grant
 *   · 开出去几支 · 画面接了几支 ← grant 清单 ∩ app|lib|components|design-system
 *   · 几把尺                   ← package.json
 *   · 最近做完什么             ← git log
 *   · 现在谁手上有什么档案     ← git status
 *
 * 量不到的一律印「量不到」，不用推的（[重点 15](../docs/founder-points.md)）。
 *
 * ⚠️ 写法上有一条：下面那段 markdown 里的反引号一律先写成 §，最后一次换回去。
 *    直接写反引号会跟样板字串的边界打架，而巢状样板一转义就整支坏掉 ——
 *    2026-09-05 就是这样炸了两次。
 *
 * ── ⚠️ 它不是什么 ──────────────────────────────────────────────────────
 *
 * 它**不取代**那两份档案。它是一张**指路的单子**：告诉新来的那一个
 * 「今天站在哪里、规矩在哪一份档案、别人手上有什么不要碰」，
 * 然后叫它自己去读那两份。
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "handoff-brief.md");
const BT = String.fromCharCode(96);

const sh = (cmd) => {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return "";
  }
};
const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch {
    return "";
  }
};
const fmt = (n) => n.toLocaleString("en-US");

/* ── 十个零件 ─────────────────────────────────────────────────────────── */
const shapeSrc = read("lib/portal/shape-state.ts");
const shapes = [...shapeSrc.matchAll(/^\s*(\w+)\s*:\s*"(live|reads|drawn)"/gm)].map((m) => ({
  key: m[1],
  state: m[2],
}));
const stateWord = { live: "会写真资料", reads: "真的，但它不存东西", drawn: "还是画的" };
const shapeLines = shapes.length
  ? shapes.map((s) => "- **" + s.key + "** —— " + (stateWord[s.state] || s.state)).join("\n")
  : "- 量不到（读不到 lib/portal/shape-state.ts）";

/* ── 每一支开出去的函式 ───────────────────────────────────────────────── */
let migs = [];
try {
  migs = readdirSync(join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql"));
} catch {
  /* 没有这个目录 → 下面每一栏都会印量不到 */
}
const allSql = migs.map((f) => read("supabase/migrations/" + f)).join("\n");

const anon = [
  ...new Set(
    [
      ...allSql.matchAll(/grant\s+execute\s+on\s+function\s+public\.(\w+)\s*\([^)]*\)\s*to\s+anon/gi),
    ].map((m) => m[1]),
  ),
].sort();

const granted = [
  ...new Set(
    [...allSql.matchAll(/grant\s+execute\s+on\s+function\s+public\.(\w+)/gi)].map((m) => m[1]),
  ),
].sort();

/* 一次抓完前端每一个出现过的名字。
   🔴 认的是 .rpc(...) 那一整包参数里的名字 —— 那才是真的呼叫，
   不是随便一个小写字串（宽松地认整份档案，会把**注解里提到的**也算成
   接上了：实测差 15 支，97 对 82。一个把「提过」读成「接上了」的数字，
   会让这张单最重要的那一栏变成安慰剂）。

   ⚠️ 2026-09-24 量到这一版本身在骗人：`grep -rhoE "[.]rpc[(][^)]*"` 是
   **单行**匹配（grep 没有 -P/-z 就没有跨行模式），
     .rpc(
       "cancel_shared_appointment",
       ...
     )
   这种写法整支抓不到 —— 而 `app/b/[ref]/cancel-form.tsx` 真的是这样写的，
   把「76 支只有尺子打过」印成了假数字（真的是 46）。
   还有一种更难认的：`op.op === "grant_credit" ? "grant_credit" : "use_credit"`
   （`lib/portal/record-ops.ts`），名字是**算出来的**，不是紧跟在 `.rpc(` 后面
   的一个字串。两种都实测抓不到过，用真的呼叫端验证过（`grant_credit`／
   `use_credit`／`cancel_shared_appointment`／`submit_appointment_review`
   全部有真的画面在用）。

   做法：先抓出每一次 `.rpc(` 到**下一个右括号**之间的那一段（惰性配对，
   在这个仓库的写法里，参数不是字串就是 `{...}`，没有裸的 `(`，
   所以第一个右括号就是那次呼叫自己的），再把那一段里**所有**引号包住的
   字串都算进去 —— 三元表达式两个分支各自的名字都在同一段参数文字里，
   一次就抓完，不用另外认三元表达式的语法。跨行的问题也一起解掉了，
   因为这里直接读整份档案的内容，不是逐行读。 */
const RPC_CALL = /\.rpc\(([\s\S]*?)\)/g;
const QUOTED_NAME = /["']([a-z_]+)["']/g;

function listFiles(dir, exts, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) listFiles(p, exts, out);
    else if (exts.some((ext) => e.name.endsWith(ext))) out.push(p);
  }
  return out;
}

const namesIn = (dirs, exts) => {
  const set = new Set();
  for (const dir of dirs) {
    for (const f of listFiles(join(ROOT, dir), exts)) {
      const s = read(f.slice(ROOT.length + 1));
      for (const call of s.matchAll(RPC_CALL)) {
        for (const q of call[1].matchAll(QUOTED_NAME)) set.add(q[1]);
      }
    }
  }
  return set;
};
const feNames = namesIn(["app", "lib", "components", "design-system"], [".ts", ".tsx"]);
const scNames = namesIn(["scripts"], [".mjs", ".ts"]);

const wired = granted.filter((g) => feNames.has(g));
const rulerOnly = granted.filter((g) => !feNames.has(g) && scNames.has(g));
const untouched = granted.filter((g) => !feNames.has(g) && !scNames.has(g));
const anonLines = anon.length ? anon.map((a) => "- §" + a + "§").join("\n") : "- 量不到";

/* ── 几把尺 ───────────────────────────────────────────────────────────── */
const pkg = JSON.parse(read("package.json") || "{}");
const scriptNames = Object.keys(pkg.scripts || {});
const guards = scriptNames.filter((s) => s.startsWith("check:")).length;
const probes = scriptNames.filter((s) =>
  /^(shoot|walk|find|align|eval|audit|zoom|pick|probe|brief)/.test(s),
).length;

/* ── 最近做完什么 ─────────────────────────────────────────────────────── */
/* ⚠️ 单引号在这台机器的壳里会被吃掉 —— 用 %x20 写空格，不要用引号包格式 */
const log = sh("git log -12 --pretty=format:%h%x20%x20%s").split("\n").filter(Boolean);
const logLines = log.length ? log.map((l) => "- §" + l + "§").join("\n") : "- 量不到";

/* ── 谁手上有什么（scratchpad 跟截图不算，那是每个 session 自己的） ────── */
const dirty = sh("git status --short")
  .split("\n")
  .filter(
    (l) =>
      l &&
      !l.includes("scratchpad/") &&
      !l.includes(".screenshots/") &&
      /* 它自己不算「别人手上的」 */
      !l.includes("scripts/brief.mjs") &&
      !l.includes("docs/handoff-brief.md"),
  )
  .map((l) => l.trim());
const dirtyLines = dirty.length ? dirty.map((d) => "- §" + d + "§").join("\n") : "- 干净";

/* ── 两份规矩档有多大 ─────────────────────────────────────────────────── */
const sizeOf = (p) => {
  const s = read(p);
  return s ? fmt(s.split("\n").length) + " 行 · " + fmt(s.length) + " 字元" : "量不到";
};

const today = new Date().toISOString().slice(0, 10);

/* ── 写出来 ───────────────────────────────────────────────────────────── */
const md = `<!-- 这一份是 §npm run brief§ 产生的，不要手改 —— 改了下一次跑就没了。
     每一个数字都是从仓库自己身上量出来的；量不到的印「量不到」。 -->

# 交接单 · ${today}

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
| §docs/founder-points.md§ | ${sizeOf("docs/founder-points.md")} | **老板讲过的原则。** 永远适用，一条都不要跳 |
| §docs/founder-tasks.md§ | ${sizeOf("docs/founder-tasks.md")} | **还没做完的那几行** ＋ 做完的编号清单 |
| §docs/founder-tasks-archive.md§ | ${sizeOf("docs/founder-tasks-archive.md")} | **只加不改的帐**：每一件事当初为什么这样决定。**不自动读进来** |

⚠️ 封存档太大，**贴不进多数工具**。用
§grep -n "### 156" docs/founder-tasks-archive.md§ 去读某一条，不要整份读。

**最要紧的七条**（其余去读原档）：

1. **一件没收尾，不准开下一件。** 他一天讲过三次
2. **用眼睛看，不要用量的。** 数字全绿而画面是坏的，这里发生过十几次
3. **改完自己先看那张图，再拿给他。** 眼睛看到而尺子量不到的，**当场补成一条会红的守卫**
4. **§supabase db push§ 成功证明不了任何事** —— 那一层到**执行**才解析名字。
   每一支都要**用真的客户身分打一次**
5. **不准整支重写一个已经在跑的函式**，要在原来那一支上加。
   被咬过三次：漏掉防重复（按两下开两张单）· 漏掉分店守卫 · 漏掉出货数量比对
6. **AI 打人按的那一支**，不准有第二条写入路径
7. **报告里不准出现英文技术词** —— 他看不懂就等於没讲

---

## 三 · 🔴 三个 session 共用同一个工作目录

| | 管什么 |
|---|---|
| **功能地基** | 表 · 权限 · 单号 · 触发器 · 写入那几支 · 算钱那一层 · **守卫（§check:*§）** |
| **画面** | 一页由哪几块组成 · 什么顺序 · 长什么样 · 风格库 |
| **研究** | 去读别人真的表跟价目 · 市场 · 走一遍量出哪里断了 · **探针（§walk:* shoot:* align§）** · 写这两份档案 |

**三条规矩，缺一条就会打架：**

1. **永远逐个档名提交**（§git commit -F <讯息档> -- <路径>§）。
   **不准 §git add -A§** —— 那会把别人还没提交的东西扫进你的提交，发生过三次
2. **动之前先看 §git status§。** 那个档案已经被改过而不是自己改的 → **只登记不动手**
3. **任务档写编号之前先拿最大的加一**，撞到了**改自己的号，不要改别人的**

### 现在别人手上有（${dirty.length} 个档案，**一个都不要碰**）

${dirtyLines}

---

## 四 · 今天站在哪里

### 十个零件

${shapeLines}

### 🔴 开出去几支 · 画面接了几支

| | 几支 |
|---|---|
| 资料库开出去的 | **${granted.length}** |
| 画面在呼叫的 | **${wired.length}** |
| 🔴 **只有尺子打过的** | **${rulerOnly.length}** |
| 一个地方都没碰过的 | ${untouched.length} |

**那 ${rulerOnly.length} 支每一支都用真的客户身分验过、每一支都有红过的守卫，
而一个老板从头到尾找不到那颗按钮。**
这是这个仓库的招牌毛病（「能力有、线没接」），而今天它长在最贵的地方。

### 陌生人做得了几件事（${anon.length} 支）

${anonLines}

⚠️ **这几支里大部分画面上没有门。** 而护城河 ——「钱跟客人从那里进来」——
正好就是这几件。

### 尺

守卫 **${guards}** 把（§npm run check:*§）· 探针 **${probes}** 把。
⚠️ **数字只能否决，不能通过** —— 通过要用眼睛看那张图。

---

## 五 · 最近做完什么

${logLines}

---

## 六 · 挡在第一个客户前面的两件

1. 🔴 **收款闸道** —— 客户付不了钱。**挡着其余全部**
2. 🔴 **公司注册** —— 挡着收款开户 · 政府补助 · 开发票 · 上架

**两件都不是技术，是老板要去办的事。**
而**付钱的客户今天是 0 个** —— 所以上面每一件功能都还没有被市场验过。

---

<!-- 产生：npm run brief · ${today} -->
`;

const out = md.split("§").join(BT);
writeFileSync(OUT, out, "utf8");

console.log("交接单写好了 → docs/handoff-brief.md");
console.log("  " + fmt(out.length) + " 字元 —— 贴得进去");
console.log(
  "  零件 " +
    shapes.length +
    " · 开出去 " +
    granted.length +
    " · 画面接了 " +
    wired.length +
    " · 只有尺子打过 " +
    rulerOnly.length,
);
console.log("  给陌生人的 " + anon.length + " 支 · 守卫 " + guards + " 把 · 探针 " + probes + " 把");

if (!shapes.length || !granted.length) {
  console.log("");
  console.log("⚠️ 有读不到的东西 —— 印「量不到」的那几栏不要当读数用");
  process.exit(1);
}

/**
 * 谁在改哪几个档案 —— 有没有两个 session 同时宣称同一个档案。
 *
 * ── 为什么（2026-09-10 深度研究，headcount 的 `agent-guard.mjs`）─────────────
 *
 * 那份研究读的是 `cbrock84/headcount`（MIT）：16 个固定部门，一份表写清楚
 * 谁管哪个资料夹，一支不到 400 行、零依赖的脚本每次检查有没有两片地重叠。
 *
 * 🔴 **我们不能照抄它的形状** —— 它假设资料夹是固定的（16 个部门，
 * 边界一开始就画好）。我们是三个 session 同一晚可能改同一个档案，
 * 边界是**动态的**：谁先宣称谁先动。所以这里抄的是**做法**（写下来 · 机器检查
 * 重叠），不是它的资料结构。
 *
 * ⚠️ **不取代 `git status`**（[重点 20](../docs/founder-points.md)）——
 * `git status` 答的是「已经动过什么」，这一支答的是「谁**打算**动什么」，
 * 那是 `git status` 看不到的一半（对方还没敲下第一个字）。
 *
 * 读的是 `docs/session-claims.md` 那张表：一行没划掉 = 还挂着，
 * 两行挂着的档案清单有重叠 = 报错。纯读一个 Markdown 档案，
 * 不用登入、不用资料库，跟这个仓库其他「check:」不一样，是故意的 ——
 * 这一支要快到可以在动手前顺手跑一次。
 */
import { readFileSync } from "node:fs";

const PATH = "docs/session-claims.md";
const text = readFileSync(new URL(`../${PATH}`, import.meta.url), "utf8");

/** 表格那几行：`| session | a.ts, b.ts | 2026-09-10 |` 形状。
 *  表头跟分隔线（`---`）都不算一行宣称。 */
function claimRows(src) {
  return src
    .split("\n")
    .filter((l) => l.trim().startsWith("|"))
    .map((l) => l.split("|").map((c) => c.trim()).filter(Boolean))
    .filter((cells) => cells.length >= 2)
    .filter((cells) => !/^-+$/.test(cells[0]))
    .filter((cells) => cells[0].toLowerCase() !== "session");
}

/** 一格档名字串（逗号分隔，可能带 glob）→ 一份档名清单。 */
function filesOf(cell) {
  return cell
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

/** 两个档名/glob 算不算同一片地。今天只判「完全一样」跟「一个是另一个的前缀」——
 *  够用，而且不会因为一个太聪明的 glob 比对器本身有 bug 而放过真的重叠。 */
function overlaps(a, b) {
  if (a === b) return true;
  const stripped = (s) => s.replace(/\*.*/, "");
  return stripped(a) && stripped(b) && (stripped(a).startsWith(stripped(b)) || stripped(b).startsWith(stripped(a)));
}

const rows = claimRows(text);
if (rows.length === 0) {
  console.log("干净 —— 没有人挂着任何宣称。");
  process.exit(0);
}

const problems = [];
for (let i = 0; i < rows.length; i += 1) {
  for (let j = i + 1; j < rows.length; j += 1) {
    const [sessionA, filesA] = rows[i];
    const [sessionB, filesB] = rows[j];
    if (sessionA === sessionB) continue; // 同一个 session 自己那几行不算撞
    for (const fa of filesOf(filesA)) {
      for (const fb of filesOf(filesB)) {
        if (overlaps(fa, fb)) {
          problems.push(`🔴 ${sessionA} 跟 ${sessionB} 都宣称了「${fa}」`);
        }
      }
    }
  }
}

for (const row of rows) {
  console.log(`  挂着：${row[0]} → ${row[1]}`);
}

if (problems.length) {
  console.log("\n" + problems.join("\n"));
  console.log(`\n判：${problems.length} 个重叠 —— 先去问，不要两边同时动手`);
  process.exit(1);
}
console.log(`\n判：${rows.length} 条宣称，没有重叠`);

/**
 * 沙龙那 13 页：每一颗按钮、每一块数字都要对得上资料库 —— 一把会自己报红的尺。
 *
 * ── 为什么（2026-09-24，任务 415，他要「第一版补齐、每个按钮都对应到表」）────
 *
 * 那一晚我手动盘点了三样东西，每一样都是这个仓库反复栽过的形状：
 *
 *   ① 「还没接」的弹窗   alert(`… isn't wired up yet`) / notWired("…")
 *                        —— 一颗按下去只讲一句抱歉的按钮
 *   ② 没有任何动作的按钮  <button> 上没有 onClick，也不是送出键
 *                        —— 一颗按了完全没反应的按钮（这个仓库禁得最严的一条）
 *   ③ 设计自带的假资料    `Blond Studio` · `PO #2024-108` · `94.2%` · `Wei Lin`
 *                        —— 一间新店打开会以为是自己的
 *
 * 其中 ③ 最贵：我前面几页收尾时都讲「Stock 转成真资料了」，而库存页右边整块
 * 进货单草稿其实没转，两颗按钮没有任何动作 —— 是这一次盘点才抓到的。
 * **靠人记得，就会再漏一次。所以这一把是常驻的。**
 *
 * ── 怎么用 ─────────────────────────────────────────────────────────────────
 *
 * 已知的缺口写在下面的 KNOWN，每一格带着「是哪个任务在补」。规矩是**两个方向都红**：
 *   - 多了一个新的 → 红（新写的按钮不准是空的）
 *   - 少了一个（补好了）→ 也红，逼你把 KNOWN 那一格改小 —— 不然一张过期的清单
 *     会静静替下一个新缺口让出位子
 * 一页补完，就把它那一行改成 0（或整行删掉）。全部归零那天，KNOWN 就是空的。
 *
 * 这一把只回答「有没有再犯」。**好不好看是眼睛判的**（重点 24）。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "app/[locale]/salon-preview";

/** file (relative to ROOT) -> { stubs, dead, sample, why } */
const KNOWN = {
  "eod-cash/eod-client.tsx": { stubs: 1, dead: 0, sample: 0, why: "任务 415：Export Shift PDF（收工记录表要新表，已登记）" },
  "lookbook/lookbook-client.tsx": { stubs: 5, dead: 0, sample: 5, why: "任务 415 B：作品表要新表（他已决定留着当卖点，六张示例卡）" },
  "salon-shell.tsx": { stubs: 0, dead: 0, sample: 1, why: "任务 414：侧栏左下角写死的 Wei Lin" },
};

// 设计自带的示例（不是任何一间真店的）。只在「代码」里找，注解里讲它们不算。
const SAMPLE = [
  /Blond Studio/, /Olaplex/, /L'Oréal/, /Milbon/, /94\.2%/, /#2024-\d+/,
  /Jasmine Teo/, /Amanda Choong/, /Datin Nora/, /Wei Lin/, /Kérastase/,
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** 去掉 /* … *​/ 跟 // … 注解（认得字串引号，不会被 "image/*" 骗到）。 */
function stripComments(src) {
  let out = "";
  let i = 0;
  let q = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
      if (c === q) q = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === "/" && n === "/" && src[i - 1] !== ":") { const e = src.indexOf("\n", i); i = e < 0 ? src.length : e; continue; }
    out += c;
    i++;
  }
  return out;
}

/** <button …> 开标签里有没有点击动作。开标签里 `=>` 的 `>` 不算结尾。 */
function deadButtons(src) {
  const dead = [];
  let i = 0;
  while ((i = src.indexOf("<button", i)) >= 0) {
    let j = i + 7;
    let depth = 0;
    let q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === q && src[j - 1] !== "\\") q = null; continue; }
      if (depth === 0 && (c === '"' || c === "'")) { q = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const tag = src.slice(i, j + 1);
    if (!/onClick=|type="submit"|onSubmit/.test(tag)) {
      const close = src.indexOf("</button>", j);
      dead.push(src.slice(j + 1, close).replace(/<[^>]+>/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim().slice(0, 40));
    }
    i = j;
  }
  return dead;
}

const found = {};
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const code = stripComments(readFileSync(file, "utf8"));
  // 「还没接」：notWired("…") 的呼叫（函式定义不算），或 alert 里写着 isn't/not wired
  // notWired 函式自己的那句 alert 不是一处缺口，是它的定义 —— 有定义就扣掉一次。
  const defines = /function notWired\(/.test(code) ? 1 : 0;
  const stubs =
    (code.match(/notWired\(\s*[`"']/g) ?? []).length +
    (code.match(/alert\(\s*[`"'][^)]*(isn't|is not|not) wired/g) ?? []).length -
    defines;
  const dead = deadButtons(code);
  const sample = SAMPLE.reduce((n, re) => n + (code.match(new RegExp(re.source, "g")) ?? []).length, 0);
  if (stubs || dead.length || sample) found[rel] = { stubs, dead: dead.length, deadText: dead, sample };
}

let bad = 0;
const say = (m) => { bad++; console.log(`  FAIL  ${m}`); };

for (const [rel, got] of Object.entries(found)) {
  const want = KNOWN[rel] ?? { stubs: 0, dead: 0, sample: 0 };
  for (const kind of ["stubs", "dead", "sample"]) {
    const label = { stubs: "「还没接」的弹窗", dead: "没有动作的按钮", sample: "设计自带的假资料" }[kind];
    if (got[kind] > want[kind]) {
      say(`${rel}：${label} 多了 —— 现在 ${got[kind]}，清单上写 ${want[kind]}` +
        (kind === "dead" ? `（${got.deadText.map((t) => `「${t}」`).join(" ")}）` : "") +
        "。新写的按钮要接到一张表；接不了就别画。");
    }
  }
}
// 反方向：清单上写着有、实际已经没有了 —— 补好了，把清单改小。
for (const [rel, want] of Object.entries(KNOWN)) {
  const got = found[rel] ?? { stubs: 0, dead: 0, sample: 0 };
  for (const kind of ["stubs", "dead", "sample"]) {
    if (got[kind] < want[kind]) {
      say(`${rel}：清单上写 ${kind} = ${want[kind]}，实际只剩 ${got[kind]} —— 补好了，把 scripts/check-salon-pages.mjs 的 KNOWN 改成 ${got[kind]}（${want.why}）`);
    }
  }
}

const totals = Object.values(KNOWN).reduce((a, k) => ({ stubs: a.stubs + k.stubs, dead: a.dead + k.dead, sample: a.sample + k.sample }), { stubs: 0, dead: 0, sample: 0 });
console.log(`已知还没补的：「还没接」${totals.stubs} 处 · 没动作的按钮 ${totals.dead} 颗 · 假资料 ${totals.sample} 处（分布在 ${Object.keys(KNOWN).length} 个档案）`);
if (bad) {
  console.log(`\n🔴 ${bad} 处不对`);
  process.exit(1);
}
console.log("✅ 没有新增的空按钮 / 没接的弹窗 / 假资料，清单跟实际对得上");

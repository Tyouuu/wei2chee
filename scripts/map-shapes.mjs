/**
 * 每一页的骨架 —— 十几页里有几种**不同的**。
 *
 *   npm run map:shapes
 *
 * 老板 2026-09-08：`不能全部的設計都是差不多的 一定要有點區別 每個頁面`。
 * 他 2026-09-05 讲过同一件（`我不要一直都是同个组件`），
 * 而 [任务 95b](../docs/founder-tasks.md) 当时是**手数**的：
 * 十七页里十六页是同一句话 —— 标题 → 筛一下 → 一张表。
 *
 * 🔴 **一个手数出来的数字，下个月没有人会再数一次。** 这一支把它变成读数：
 * 拿产品自己那一支 `buildPageLayout` 跑每一页，把区块的**顺序**印出来，
 * 一样的归成一堆。
 *
 * ⚠️ 它只能否决（[重点 24](../docs/founder-points.md)）：
 * 两页骨架不同，不代表看起来不一样；而两页骨架一样，**一定**看起来一样。
 */
const { buildPageLayout } = await import("../lib/templates/industry-template.ts");
const { MODULE_KEYS, PAGES_FOR_INDUSTRY } = await import("../lib/portal/module-catalog.ts");

/* 一个装修承包商的样子 —— 行业只影响用词跟流程，不影响骨架的形状。 */
const CTX = {
  lang: "en",
  trade: "renovation",
  after_workflow: ["Enquiry", "Quote", "Build", "Paid"],
};

const keys = MODULE_KEYS ?? Object.keys(PAGES_FOR_INDUSTRY ?? {});
const pages = keys.map((k) => ({ key: k, title: null }));

/** 一页由哪几块组成，照顺序。插槽里的也要数进去。 */
function skeleton(node, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) skeleton(n, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  if (typeof node.type === "string") {
    /* 🔴 一个零件的**名字**不等於它长什么样。
       这一套的整个设计就是「register 挑每一块的形状」，所以
       库存跟客户两页都是 `RecordTable`，而库存 9-05 换成了一格一件的卡
       （[任务 186]）—— 只读名字会把两页判成一样，而画面上差很远。
       ⚠️ 而形状有两个来源：这里传的 `look`，跟那一套风格自己的偏好。
       这一支只看得到前者 —— **写下来，不要拿它当全部**。 */
    const shape = node.props?.look ?? node.props?.variant ?? node.props?.shape ?? node.props?.kind;
    out.push(typeof shape === "string" ? `${node.type}:${shape}` : node.type);
  }
  for (const v of Object.values(node.props ?? {})) {
    if (Array.isArray(v) || (v && typeof v === "object")) skeleton(v, out);
  }
  return out;
}

const rows = [];
for (const key of keys) {
  let layout;
  try {
    layout = buildPageLayout(key, CTX, "Hin Fatt Renovation", "en", pages, "swiss", null);
  } catch (e) {
    rows.push({ key, failed: String(e).slice(0, 60) });
    continue;
  }
  /* 外壳跟侧栏每一页都一样，数它们等於把每一页都算成一样的。 */
  const SHELL = new Set(["SystemShell", "RailNav", "SystemBar", "Columns"]);
  const all = skeleton(layout?.content ?? layout);
  const body = all.filter((t) => !SHELL.has(t));
  rows.push({ key, body, sig: body.join(" → ") });
}

const good = rows.filter((r) => !r.failed);
const groups = new Map();
for (const r of good) {
  if (!groups.has(r.sig)) groups.set(r.sig, []);
  groups.get(r.sig).push(r.key);
}

console.log(`\n== 每一页由哪几块组成 ==`);
for (const r of rows) {
  if (r.failed) {
    console.log(`  🔴 ${r.key.padEnd(16)}${r.failed}`);
    continue;
  }
  console.log(`  ${r.key.padEnd(16)}${r.sig || "（空的）"}`);
}

console.log(`\n== 一样的归成一堆 ==`);
const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [sig, ks] of sorted) {
  const flag = ks.length > 1 ? "🔴" : "  ";
  console.log(`  ${flag} ${String(ks.length).padStart(2)} 页  ${ks.join(" · ")}`);
  if (ks.length > 1) console.log(`        ${sig}`);
}

const same = sorted.filter(([, ks]) => ks.length > 1).reduce((a, [, ks]) => a + ks.length, 0);
console.log(
  `\n判：${good.length} 页 · ${groups.size} 种骨架 · ` +
    `其中 ${same} 页跟别人一模一样（最大的一堆 ${sorted[0]?.[1].length ?? 0} 页）`,
);
console.log(`⚠️ 只能否决 —— 骨架不同不等於看起来不一样，而骨架一样一定看起来一样。`);

/* ─────────────────────────────────────────────────────────────────────────
   🔴 而「一模一样」不是他讲的那一件。

   他讲的是「**差不多**」，而上面那 13 种骨架里，十六种开场是同一句：
   一个标题 → 一两个控件 → 一张表。**骨架不同，读起来一样。**

   所以第二个读数问一句更笨的：**这一页的主角是什么、开场几块**。
   主角＝那一页最大的那一块（表 / 板 / 图 / 一张纸），
   开场＝主角前面他要滑过去的东西。 */
const HERO = new Set(["RecordTable", "TaskBoard", "DaySchedule", "TrendChart", "SiteHero"]);
const bare = (t) => t.split(":")[0];

console.log(`\n== 这一页的主角是什么 ==`);
const heroes = new Map();
for (const r of good) {
  const hero = r.body.find((t) => HERO.has(bare(t))) ?? r.body[0] ?? "（没有）";
  const before = r.body.slice(0, r.body.indexOf(hero));
  if (!heroes.has(hero)) heroes.set(hero, []);
  heroes.get(hero).push({ key: r.key, before });
}
for (const [hero, ks] of [...heroes].sort((a, b) => b[1].length - a[1].length)) {
  const flag = ks.length >= 4 ? "🔴" : "  ";
  console.log(`  ${flag} ${String(ks.length).padStart(2)} 页  主角是 ${hero}`);
  for (const k of ks) {
    console.log(`        ${k.key.padEnd(16)}开场 ${k.before.length} 块  ${k.before.join(" → ") || "（直接就是它）"}`);
  }
}
const table = [...heroes].filter(([h]) => bare(h) === "RecordTable").reduce((a, [, k]) => a + k.length, 0);
console.log(
  `\n判：${good.length} 页里 ${table} 页的主角是同一张表 —— ` +
    `那才是「差不多」的来源，不是骨架`,
);

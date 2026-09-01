/* 把候选字体全部画出来，摊成一张图给老板挑。
 *
 *   npm run shoot:fonts
 *
 * ── 为什么是「摊出来给他挑」而不是「我挑好」 ──────────────────────────────
 * 老板 2026-09-01：`字体样式可以去帮我去拿更多的字体套吗`。
 * [重点 3](../docs/founder-points.md)：审美是用看的。
 * [重点 7m](../docs/founder-points.md)：**量要大** —— 「他要的是挑，三个不叫挑」。
 * `scripts/font-probe.mjs` 那四根轴（直笔比 · 笔画对比 · 小写多高 · 墨量）
 * 挑得出「谁跟谁像」，**挑不出哪一个好看**，所以数字只用来排序，不用来决定。
 *
 * ── 量出来缺在哪（这才是这张图要解的问题）────────────────────────────────
 * 六套风格有**两层**字：
 *     工作台 `--font-display`   6 套风格只有 **4 套字** ← 缺在这里
 *         图纸 + 満図 共用 Newsreader
 *         中台 + 台账 共用 Archivo
 *     官网   `--site-display`   6 套风格 6 套字，不缺
 *
 * ⚠️ **多几套字不会让官网变重。** 官网那 233 KB 不是因为宣告了几套，
 * 是因为根 layout 把 13 个变数全部挂上去、每一页都预载
 * （[任务 58](../docs/founder-tasks.md)，试过、退掉过，理由写在那里）。
 * 那是**载入**的问题，不是**数量**的问题 —— 两件事不要混。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const FAMILIES = [
  ["展示衬线 · 标题用", [
    "Playfair Display", "DM Serif Display", "Prata", "Bodoni Moda", "Abril Fatface",
    "Instrument Serif", "Fraunces", "Young Serif", "Gloock", "Yeseva One",
    "Libre Baskerville", "Lora", "Literata", "Domine", "Frank Ruhl Libre",
  ]],
  ["细展示体 · 有留白的场合", [
    "Italiana", "Julius Sans One", "Federo", "Cormorant", "Cormorant Infant",
    "Marcellus", "Marcellus SC", "Gilda Display", "Antic Didone", "Forum", "Gruppo",
  ]],
  ["几何无衬线", [
    "Jost", "Poppins", "Outfit", "Josefin Sans", "Lexend",
    "Urbanist", "Sora", "Red Hat Display", "Hanken Grotesk", "Questrial",
  ]],
  ["黑体 · 高 x 高", [
    "Inter", "Manrope", "Space Grotesk", "Figtree", "Plus Jakarta Sans",
    "DM Sans", "Onest", "Geologica", "Instrument Sans", "Bricolage Grotesque",
  ]],
  ["新哥特 · 后台耐看", [
    "Roboto", "Barlow", "Asap", "Encode Sans", "Mulish", "Rubik",
    "IBM Plex Sans", "Work Sans", "Karla", "Cabin", "Assistant", "Libre Franklin",
  ]],
  ["人文 · 末端外扩", [
    "Spectral", "Vollkorn", "Faustina", "Petrona", "Cardo",
    "Gentium Book Plus", "Alegreya", "Eczar", "Radley", "Copse", "EB Garamond",
  ]],
  ["压缩 · 招牌跟标题墙", [
    "Oswald", "Fjalla One", "Anton", "Archivo Black", "Bebas Neue", "Archivo Narrow",
  ]],
  ["等宽 · 注解跟单号", [
    "JetBrains Mono", "IBM Plex Mono", "Space Mono", "Roboto Mono", "DM Mono",
  ]],
];

/* 现在真的在用的，标出来 —— 一张没有基准线的对照图，看不出「换了会怎样」。 */
const IN_USE = new Map([
  ["Newsreader", "图纸 · 満図 的工作台"],
  ["Archivo", "中台 · 台账 的工作台"],
  ["Archivo Narrow", "招牌 的工作台"],
  ["Public Sans", "瑞士 的工作台"],
  ["EB Garamond", "图纸 的官网"],
  ["Libre Franklin", "中台 的官网"],
  ["Tenor Sans", "台账 的官网"],
  ["Questrial", "招牌 的官网"],
]);

/* 老板读得懂的样本：一个中文店名 + 一行英文 + 一个金额。
   ⚠️ 中文字这些 Google 拉丁字体都没有，会退回系统字 ——
   那正好是**真实情况**：客户的系统就是中英混排。 */
const SAMPLE_BIG = "Xing Fa Renovation";
const SAMPLE_SMALL = "RM 48,500 · 12 jobs · Klang Valley";

const all = FAMILIES.flatMap(([, f]) => f);
const chunks = [];
for (let i = 0; i < all.length; i += 20) chunks.push(all.slice(i, i + 20));
const links = chunks
  .map(
    (c) =>
      `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${c
        .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`)
        .join("&")}&display=block">`,
  )
  .join("");

const html = `${links}<body style="margin:0;background:#0b0d13;color:#e8e3d8;font-family:system-ui">
${FAMILIES.map(
  ([group, fams]) => `
  <div style="padding:26px 32px 6px">
    <div style="font:600 13px system-ui;letter-spacing:.16em;color:#00beb7;text-transform:uppercase">${group}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 40px;padding:0 32px">
  ${fams
    .map(
      (f) => `
    <div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.10)">
      <div style="font:400 11px system-ui;letter-spacing:.08em;color:${IN_USE.has(f) ? "#00beb7" : "rgba(232,227,216,.45)"}">
        ${f}${IN_USE.has(f) ? ` — 现在是 ${IN_USE.get(f)}` : ""}
      </div>
      <div style="font-family:'${f}';font-weight:700;font-size:34px;line-height:1.15;margin-top:6px">${SAMPLE_BIG}</div>
      <div style="font-family:'${f}';font-weight:400;font-size:15px;line-height:1.4;margin-top:4px;color:rgba(232,227,216,.72)">${SAMPLE_SMALL}</div>
    </div>`,
    )
    .join("")}
  </div>`,
).join("")}
<div style="height:40px"></div></body>`;

fs.mkdirSync(".screenshots/fonts", { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1200 } });
await p.setContent(html);
await p.waitForLoadState("networkidle");
await p.evaluate(() => document.fonts.ready);
/* 字体档要真的到齐再拍。没等的话拍回来一整张都是 fallback，
   而**那张图看起来跟真的一模一样** —— 这个仓库被这个形状咬过好几次。 */
await p.waitForTimeout(2500);

const missing = await p.evaluate((fams) => {
  const c = document.createElement("canvas").getContext("2d");
  const w = (font) => { c.font = font; return c.measureText("Hamburgefons").width; };
  const base = w('400 40px "__nope__", monospace');
  return fams.filter((f) => w(`400 40px "${f}", monospace`) === base);
}, all);

await p.screenshot({ path: ".screenshots/fonts/all.jpg", fullPage: true, type: "jpeg", quality: 86 });
const h = await p.evaluate(() => document.body.scrollHeight);
await b.close();

console.log(`.screenshots/fonts/all.jpg   ${all.length} 套 · ${FAMILIES.length} 类 · ${h}px 高`);
if (missing.length) {
  console.log(`⚠️ 这 ${missing.length} 套没载到，图上是替代字，不算数：${missing.join(" · ")}`);
} else {
  console.log("每一套都真的载到了。");
}
console.log("\n⚠️ 数字挑得出「谁跟谁像」，挑不出「哪一个好看」——用眼睛看这张图（重点 3）。");

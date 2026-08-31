/* 挑字体，用量的，不用猜的。
 *
 *   node scripts/font-probe.mjs --target 0.94,1.00,1.00,0.118
 *   node scripts/font-probe.mjs --target signboard
 *
 * 老板 2026-08-31:「10以下 你想办法去修好」。
 * 招牌 剩下的五项里有四项是**同一个根**：那套字。
 * `大写比小写宽 0.94对1.26 · 小写多高 1.00对0.77 · 墨量 0.118对0.213 ·
 *  级差` —— 四个读数，一个原因。他们是 marzo-w00-regular（Wix 授权的展示体），
 * 我们是 Archivo Narrow。
 *
 * ⚠️ 而「换成哪一套」不可以用眼睛在名字上挑，也不可以用印象挑
 * （Playfair「看起来像」不是一个读数）。这支脚本把候选字体照 align 那四个
 * **一模一样**的量法量出来，按距离排序 —— 换字之前先知道换过去会落在哪里。
 *
 * 量的四根轴，定义跟 scripts/align-site.mjs 的 readType 逐字相同：
 *   serifish  "IHMTEFL" 的宽 ÷ "ooeecc" 的宽 —— 直笔多的字串对圆笔多的字串
 *             ⚠️ 它**不是**「有没有衬线」（align 里已经改过名，理由写在那里）
 *   contrast  一个大写 O，中横穿过竖笔的厚度 ÷ 中竖穿过横笔的厚度
 *   xish      x 的高 ÷ H 的高
 *   inkish    100px 的 "Hamburgefons" 画进 400×140，暗像素占的比例
 *
 * 只查 Google Fonts —— 那是官网层唯一载得进来的字库（CSP 只放行
 * fonts.googleapis.com / fonts.gstatic.com），而且 SIL OFL 可以商用。
 */
import { chromium } from "playwright";

/* 目标：从 align 的实测读数来，不是从印象来。
   要加一套风格，先跑 `npm run align -- <风格>`，把那四行的「模版」抄进来。 */
const TARGETS = {
  /* Toulouse Brasserie（招牌 的参考），2026-08-31 实测 */
  signboard: { serifish: 0.94, contrast: 1.0, xish: 1.0, inkish: 0.118 },
  /* Kurofude（中台 的参考）—— univers-lt-std，字重 700 */
  counter: { serifish: 1.28, contrast: 1.44, xish: 0.70, inkish: 0.210 },
  /* Newel（台账 的参考）—— displace-2-0，末端外扩那一族 */
  ledger: { serifish: 1.21, contrast: 1.83, xish: 0.74, inkish: 0.093 },
};

/* 候选。挑的规矩：Google Fonts 上有、SIL OFL、而且是**展示体或正文体**
   —— 手写体跟图标字不进这张表，因为一个客户的官网标题不该是手写。 */
const FAMILIES = [
  // 我们已经在用的，当作基准线
  "Archivo", "Archivo Narrow", "Geist", "Public Sans", "Nunito", "Tenor Sans", "Newsreader",
  // 展示衬线（Marzo 那一类）
  "Playfair Display", "DM Serif Display", "Prata", "Bodoni Moda", "Abril Fatface",
  "Libre Baskerville", "Cormorant Garamond", "Instrument Serif", "Fraunces",
  // 几何无衬线（Futura 那一类）
  "Jost", "Poppins", "Outfit", "Questrial", "Josefin Sans", "Lexend",
  // 高 x 高的黑体
  "Inter", "Manrope", "Space Grotesk", "Figtree",
  // 新哥特（Univers 那一类）—— 中台 的参考是 univers-lt-std
  "Roboto", "Barlow", "Libre Franklin", "Asap", "Encode Sans", "Arimo", "Mulish", "Rubik",
  // 末端外扩 / 人文（Displace 2.0 · Optima 那一类）—— 台账 的参考
  "Marcellus", "Gilda Display", "Radley", "Copse", "Quattrocento Sans",
  "Spectral", "Vollkorn", "Faustina", "Petrona", "Amiri", "Cardo", "Gentium Book Plus",
  // 图纸 用的那一套本人
  "EB Garamond",
];

const args = process.argv.slice(2);
const tArg = args[args.indexOf("--target") + 1];
const target = TARGETS[tArg] ?? (tArg?.includes(",")
  ? (([a, b, c, d]) => ({ serifish: +a, contrast: +b, xish: +c, inkish: +d }))(tArg.split(","))
  : null);
if (!target) {
  console.error(`用法: node scripts/font-probe.mjs --target <${Object.keys(TARGETS).join("|")}|a,b,c,d>`);
  process.exit(1);
}
const weight = Number(args[args.indexOf("--weight") + 1]) || 400;

const css = `https://fonts.googleapis.com/css2?${FAMILIES
  .map((f) => `family=${f.replace(/ /g, "+")}:wght@${weight === 400 ? "400" : `400;${weight}`}`)
  .join("&")}&display=block`;

const browser = await chromium.launch();
const p = await browser.newPage();
await p.setContent(`<link rel="stylesheet" href="${css}"><body style="font:400 100px sans-serif">
${FAMILIES.map((f) => `<span style="font-family:'${f}'">Hamburgefons</span>`).join("")}</body>`);
/* ⚠️ 等字体真的到了再量。没等的话每一套都回传 fallback 的读数，
   **而那些读数长得跟真的一模一样** —— 这个仓库今天已经被这个形状咬过三次。 */
await p.waitForLoadState("networkidle");
await p.evaluate(() => document.fonts.ready);

const rows = await p.evaluate(({ families, wt }) => {
  const w = (font, text) => {
    const c = document.createElement("canvas").getContext("2d");
    c.font = font;
    return c.measureText(text).width;
  };
  const out = [];
  for (const fam of families) {
    const font = `${wt} 100px "${fam}", monospace`;
    /* 真的载到了吗 —— 拿它跟一个不存在的字体比宽度。一样宽就是都在用 fallback。 */
    const here = w(font, "Hamburgefons") !== w(`${wt} 100px "__nope__", monospace`, "Hamburgefons");

    const serifish = w(font, "IHMTEFL") / w(font, "ooeecc");
    const asc = (t) => {
      const c = document.createElement("canvas").getContext("2d");
      c.font = font;
      return c.measureText(t).actualBoundingBoxAscent || 0;
    };
    const capH = asc("H"), xH = asc("x");

    const cv = document.createElement("canvas");
    cv.width = 400; cv.height = 140;
    const c2 = cv.getContext("2d", { willReadFrequently: true });
    c2.fillStyle = "#fff"; c2.fillRect(0, 0, 400, 140);
    c2.fillStyle = "#000"; c2.font = font; c2.textBaseline = "alphabetic";
    c2.fillText("Hamburgefons", 4, 110);
    const d = c2.getImageData(0, 0, 400, 140).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
    const inkish = dark / (400 * 140);

    /* 笔画对比：一个大写 O，中横穿过竖笔的厚度 ÷ 中竖穿过横笔的厚度。 */
    const S = 200;
    const c3 = (() => {
      const v = document.createElement("canvas");
      v.width = S; v.height = S;
      const g = v.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#fff"; g.fillRect(0, 0, S, S);
      g.fillStyle = "#000"; g.font = `${wt} 160px "${fam}", monospace`;
      g.textBaseline = "middle"; g.textAlign = "center";
      g.fillText("O", S / 2, S / 2);
      return g.getImageData(0, 0, S, S).data;
    })();
    const dark2 = (x, y) => c3[(y * S + x) * 4] < 128;
    const run = (line) => {
      let best = 0, cur = 0;
      for (const on of line) { cur = on ? cur + 1 : 0; if (cur > best) best = cur; }
      return best;
    };
    const stem = run(Array.from({ length: S }, (_, x) => dark2(x, S / 2 | 0)));
    const bar = run(Array.from({ length: S }, (_, y) => dark2(S / 2 | 0, y)));
    const contrast = stem && bar ? Math.max(stem, bar) / Math.min(stem, bar) : 0;

    out.push({
      fam, here,
      serifish: +serifish.toFixed(3),
      contrast: +contrast.toFixed(2),
      xish: capH ? +(xH / capH).toFixed(3) : 0,
      inkish: +inkish.toFixed(4),
    });
  }
  return out;
}, { families: FAMILIES, wt: weight });

await browser.close();

/* 距离：四根轴各自除以目标值再取相对差，所以 0.118 的墨量跟 1.00 的比例
   一样重 —— 不这样做的话墨量那一根永远被压成零。 */
const dist = (r) => ["serifish", "contrast", "xish", "inkish"]
  .reduce((n, k) => n + Math.abs(r[k] - target[k]) / (target[k] || 1), 0);

const gone = rows.filter((r) => !r.here).map((r) => r.fam);
if (gone.length) console.log(`⚠️ 这几套没载到，读数不算数：${gone.join(" · ")}\n`);

console.log(`目标（${tArg}，字重 ${weight}）  直笔比 ${target.serifish} · 笔画对比 ${target.contrast} · 小写多高 ${target.xish} · 墨量 ${target.inkish}\n`);
console.log("  距离   字体                     直笔比  笔画对比  小写多高   墨量");
for (const r of rows.filter((x) => x.here).sort((a, b) => dist(a) - dist(b))) {
  console.log(
    `  ${dist(r).toFixed(2).padStart(5)}  ${r.fam.padEnd(24)}` +
    `${String(r.serifish).padStart(6)}${String(r.contrast).padStart(9)}` +
    `${String(r.xish).padStart(10)}${String(r.inkish).padStart(8)}`);
}
console.log(`
⚠️ 排在最前面的**不是答案，是候选**。这四根轴量得到「同一个字级下看起来
   像不像」，量不到有没有衬线、字形好不好看、马来西亚的老板认不认得。
   照重点 24：挑出前三名，渲染出来，用眼睛看那张图。`);

/* ── 并排画出来，用眼睛看 ────────────────────────────────────────────────
   `--sheet "TOULOUSE" --bg #500014 --fg #f9a8d4`
   老板 2026-08-31:「为什么你不要帮我换字 我说了那么多次是字体不同」。
   ⚠️ 数字挑候选，眼睛定案（重点 24）。上一次换字（台账 → Tenor Sans）
   就是这样定的：数字上最接近的是 Geist 200，而它的笔画从头到尾一样粗，
   老板一眼看出来。**四根轴里，眼睛几乎只看笔画那一根。** */
if (args.includes("--sheet")) {
  const word = args[args.indexOf("--sheet") + 1] || "TOULOUSE";
  const bg = args[args.indexOf("--bg") + 1] || "#500014";
  const fg = args[args.indexOf("--fg") + 1] || "#f9a8d4";
  const short = rows.filter((r) => r.here).sort((a, b) => dist(a) - dist(b)).slice(0, 7);
  const b2 = await chromium.launch();
  const p2 = await b2.newPage({ viewport: { width: 1440, height: 200 * (short.length + 1) } });
  await p2.setContent(`<link rel="stylesheet" href="${css}">
    <body style="margin:0;background:${bg};color:${fg}">
    ${short.map((r) => `<div style="padding:10px 24px 24px">
      <div style="font:400 13px system-ui;opacity:.65;letter-spacing:.08em">${r.fam}　笔画对比 ${r.contrast}　墨量 ${r.inkish}</div>
      <div style="font-family:'${r.fam}';font-weight:${weight};font-size:108px;line-height:1;letter-spacing:0.01em">${word}</div>
    </div>`).join("")}</body>`);
  await p2.waitForLoadState("networkidle");
  await p2.evaluate(() => document.fonts.ready);
  await p2.screenshot({ path: ".screenshots/align/face-candidates.jpg", fullPage: true, type: "jpeg", quality: 92 });
  await b2.close();
  console.log("\n  .screenshots/align/face-candidates.jpg  ← 用眼睛看这一张");
}

/**
 * 第二趟：**先读他们自己的连结，再进去拍那一页** —— 不猜网址。
 *
 * ── 为什么要第二趟 ──────────────────────────────────────────────────────
 *
 * `shoot:tradepages` 第一趟拍首页跟我猜的几个功能页，回来的多半是招牌照、
 * 页尾、跟两个 404（Teachworks 那一个的页尾上写着真正的名字是
 * 「Billing & Payroll」，跟我猜的不一样）。
 * **猜网址就是在制造 404**，而一张 404 跟一个「这一家没有这一页」
 * 在报告里长得一模一样（[重点 15](../docs/founder-points.md)）。
 *
 * 所以这一趟照人手做的顺序：**进他们的站 → 读页面上真的连结 →
 * 挑名字对得上那一句话的那一条 → 进去，滚三段，一段拍一张。**
 *
 * 三句话跟 [任务 332](../docs/founder-tasks.md#332) 的三格一一对上：
 *   ① 一按开全班的学费单   billing · invoice · fees · payment
 *   ② 疗程记录那一页       notes · chart · record · form · client
 *   ③ 同意书               consent · waiver · intake · signature
 *
 *     node scripts/shoot-featurepage.mjs
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/featurepages";
fs.mkdirSync(OUT, { recursive: true });

const W = 1400;
const H = 950;

/* 一个站，一句话要找的字。**按顺序试** —— 排前面的词更贴近那一格。 */
const HUNTS = [
  ["teachworks", "https://www.teachworks.com/", "①", ["billing", "invoic", "payment"]],
  ["jackrabbit", "https://www.jackrabbitclass.com/", "①", ["billing", "payment", "tuition"]],
  ["classe365", "https://www.classe365.com/", "①", ["fees", "invoic", "billing"]],
  ["pike13", "https://www.pike13.com/", "①", ["billing", "payment"]],
  ["myclasscampus", "https://www.myclasscampus.com/", "①", ["fee", "billing"]],

  ["pabau", "https://pabau.com/", "②", ["medical form", "record", "chart", "note"]],
  ["mangomint", "https://www.mangomint.com/", "②", ["form", "chart", "client"]],
  ["boulevard", "https://www.joinblvd.com/", "②", ["client", "chart", "form"]],
  ["zenoti", "https://www.zenoti.com/", "②", ["medical", "chart", "record"]],
  ["timely", "https://www.gettimely.com/", "②", ["client", "note", "record"]],
  ["aestheticrecord", "https://www.aestheticrecord.com/", "②", ["chart", "emr", "note"]],
  ["cliniko", "https://www.cliniko.com/", "②", ["treatment note", "note", "record"]],
  ["janeapp", "https://www.janeapp.com/", "②", ["chart", "note"]],

  ["pabauc", "https://pabau.com/", "③", ["consent"]],
  ["arc", "https://www.aestheticrecord.com/", "③", ["consent"]],
  ["mangomintc", "https://www.mangomint.com/", "③", ["form", "consent"]],
  ["clinikoc", "https://www.cliniko.com/", "③", ["consent", "form"]],
  ["carepatron", "https://www.carepatron.com/", "③", ["consent"]],

  /* ── 第三趟（2026-09-10）：两页 arhamkhnz 完全没有，`beauty` 那一行今天
     一页都开不出来的东西，各要一批参考 ──────────────────────────────────
       ④ 一份有价钱、她会签的疗程方案（[任务 341] 记的那一件：
         beauty 没有报价单也没有订单那一页，她开不出任何一张有明细的纸）
       ⑤ 一个人的这个月赚多少（师傅那一页右边那块面板今天填不出来的
         「This month」「Status」两格，[任务 344] 还欠的那一件） */
  ["pabau4", "https://pabau.com/", "④", ["treatment plan", "consultation", "quote"]],
  ["arc4", "https://www.aestheticrecord.com/", "④", ["treatment plan", "chart", "note"]],
  ["zenoti4", "https://www.zenoti.com/", "④", ["treatment", "package", "membership"]],
  ["boulevard4", "https://www.joinblvd.com/", "④", ["form", "chart", "client"]],
  ["mangomint4", "https://www.mangomint.com/", "④", ["form", "membership", "package"]],

  ["fresha5", "https://www.fresha.com/for-business", "⑤", ["team", "staff", "commission", "payroll"]],
  ["vagaro5", "https://www.vagaro.com/pro/", "⑤", ["team", "staff", "payroll", "commission"]],
  ["boulevard5", "https://www.joinblvd.com/", "⑤", ["team", "staff", "payroll"]],
  ["mangomint5", "https://www.mangomint.com/", "⑤", ["team", "staff", "payroll", "commission"]],
  ["mindbody5", "https://www.mindbodyonline.com/business", "⑤", ["staff", "payroll", "team"]],
];

/** `GROUPS=④,⑤ node scripts/shoot-featurepage.mjs`：只重跑新加的那几组，
 *  不用把已经拍过的 ①②③ 也打一次别人的站。 */
const wantGroups = process.env.GROUPS ? new Set(process.env.GROUPS.split(",")) : null;
const hunts = wantGroups ? HUNTS.filter((h) => wantGroups.has(h[2])) : HUNTS;

const browser = await chromium.launch();
const rows = [];

for (const [key, root, group, words] of hunts) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  const row = { key, group, root, found: "", shots: 0, why: "" };
  try {
    await page.goto(root, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    for (const label of [/accept all/i, /accept/i, /agree/i, /allow all/i, /got it/i]) {
      const b = page.getByRole("button", { name: label }).first();
      if (await b.count().catch(() => 0)) {
        await b.click({ timeout: 2500 }).catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(800);

    /* 读**他们自己写的**连结，一条都不猜。 */
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        text: (a.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase(),
        href: a.href,
      })),
    );
    let hit = null;
    for (const w of words) {
      hit = links.find(
        (l) =>
          l.text.includes(w) &&
          l.href.startsWith("http") &&
          !/pricing|blog|login|sign|contact|demo|support|careers/.test(l.href),
      );
      if (hit) break;
    }
    if (!hit) throw new Error(`连结上找不到 ${words[0]}`);
    row.found = hit.href;

    await page.goto(hit.href, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    /* 三段：产品图很少在第一屏。 */
    for (let i = 0; i < 3; i += 1) {
      if (i) {
        await page.mouse.wheel(0, 1500);
        await page.waitForTimeout(1600);
      }
      await page.screenshot({ path: `${OUT}/${key}-${i}.png` });
      row.shots += 1;
    }
  } catch (e) {
    row.why = String(e).replace(/\s+/g, " ").slice(0, 70);
  }
  await page.close();
  rows.push(row);
  console.log(
    `  ${key.padEnd(16)} ${group}  ${row.shots ? row.found.slice(0, 62) : "✗ " + row.why}`,
  );
}

await browser.close();

/* 一组一张联络表。 */
for (const g of ["①", "②", "③", "④", "⑤"]) {
  const mine = rows.filter((r) => r.group === g && r.shots);
  if (!mine.length) continue;
  const H2 = 520;
  const LABEL = 26;
  const GAP = 8;
  const parts = [];
  for (const r of mine) {
    for (let i = 0; i < r.shots; i += 1) {
      const f = `${OUT}/${r.key}-${i}.png`;
      if (!fs.existsSync(f)) continue;
      const meta = await sharp(f).metadata();
      const iw = Math.round(meta.width * (H2 / meta.height));
      parts.push({
        img: await sharp(f).resize({ width: iw, height: H2, fit: "fill" }).toBuffer(),
        w: iw,
        label: i === 0 ? r.key : "",
      });
    }
  }
  if (!parts.length) continue;
  const per = 5;
  const lines = [];
  for (let i = 0; i < parts.length; i += per) lines.push(parts.slice(i, i + per));
  const width = Math.max(...lines.map((l) => l.reduce((n, p) => n + p.w + GAP, GAP)));
  const height = lines.length * (H2 + LABEL + GAP) + GAP;
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#0b0b0c"/>` +
      lines
        .map((line, li) =>
          line
            .map((p, i) => {
              if (!p.label) return "";
              const x = GAP + line.slice(0, i).reduce((n, q) => n + q.w + GAP, 0);
              const y = li * (H2 + LABEL + GAP) + 18;
              return `<text x="${x}" y="${y}" font-family="monospace" font-size="14" fill="#f2f2f0">${p.label}</text>`;
            })
            .join(""),
        )
        .join("") +
      `</svg>`,
  );
  const out = `${OUT}/sheet-${g}.jpg`;
  await sharp({
    create: { width, height, channels: 3, background: { r: 11, g: 11, b: 12 } },
  })
    .composite([
      { input: svg, top: 0, left: 0 },
      ...lines.flatMap((line, li) =>
        line.map((p, i) => ({
          input: p.img,
          top: li * (H2 + LABEL + GAP) + LABEL,
          left: GAP + line.slice(0, i).reduce((n, q) => n + q.w + GAP, 0),
        })),
      ),
    ])
    .jpeg({ quality: 82 })
    .toFile(out);
  console.log(`\n  ${g} → ${out}`);
}

const missed = rows.filter((r) => !r.shots);
if (missed.length) {
  console.log(`\n⚠️ 进不去 ${missed.length} 个：`);
  for (const r of missed) console.log(`  · ${r.key} — ${r.why}`);
}
console.log(`\n${OUT}/\n`);

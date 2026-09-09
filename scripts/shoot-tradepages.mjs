/**
 * 那三格要长出画面之前，先去外面拍一批 —— 21 家，三个问题。
 *
 * ── 为什么有这一支 ──────────────────────────────────────────────────────
 *
 * 老板 2026-09-09（同一晚第四次）：
 *   `你一定要记得什么去接画面 都是去外网去做深度研究 我们借鉴别人的做法`
 *
 * 前三次讲的是助手那一块（[重点 7n](../docs/founder-points.md)），
 * **这一次把范围讲到底了：什么去接画面都要先去拍。**
 * 而手上正好有三格（[任务 332](../docs/founder-tasks.md#332)）：
 * 底下那一层全部是真的、尺子全绿，而**她今天一格都点不到**。
 *
 * ── 它回答的三句话，不是「好不好看」 ────────────────────────────────────
 *
 *   ① **一按开全班的学费单** —— 那一颗按钮**长在哪里**？按下去先给他看什么？
 *      开完之后画面变成什么？（补习 · 才艺班 · 道场那一类的系统）
 *   ② **疗程记录那一页** —— 一次疗程记下来的那一页**由哪几块组成**？
 *      （医美 · 美容 · 物理治疗那一类）
 *   ③ **同意书** —— 「这一个还没签」在她的画面上**是一句话、一个记号、还是一整段**？
 *
 * ⚠️ 拍到的多半是**他们自己的官网**，而官网上那几张产品图正好就是这几页
 * （这一类软件的行销页就是在卖那一页长什么样）。登入后面那一层拿不到，
 * [任务 267](../docs/founder-tasks.md) 判过一次。
 *
 * ⚠️ 拍不到的**照实印「拍不到」**（[重点 15](../docs/founder-points.md)）。
 *
 *     node scripts/shoot-tradepages.mjs
 *     ONLY=pabau,teachworks node scripts/shoot-tradepages.mjs
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/tradepages";
fs.mkdirSync(OUT, { recursive: true });

/* 一档就够 —— 这一支问的是「那一页由哪几块组成」，而那个答案在桌面上。 */
const W = 1400;
const H = 950;

const SITES = [
  /* ① 一按开全班的学费单 */
  ["teachworks", "https://www.teachworks.com/features/billing-invoicing", "① 全班开单", "Teachworks（补习）"],
  ["jackrabbit", "https://www.jackrabbitclass.com/", "① 全班开单", "Jackrabbit Class"],
  ["classe365", "https://www.classe365.com/features/fees-management/", "① 全班开单", "Classe365"],
  ["teachmint", "https://teachmint.com/", "① 全班开单", "Teachmint"],
  ["pike13", "https://www.pike13.com/", "① 全班开单", "Pike13"],
  ["omnify", "https://www.getomnify.com/", "① 全班开单", "Omnify"],
  ["fedena", "https://fedena.com/", "① 全班开单", "Fedena"],

  /* ② 疗程记录那一页 */
  ["pabau", "https://pabau.com/", "② 疗程记录", "Pabau（医美）"],
  ["aestheticrecord", "https://www.aestheticrecord.com/", "② 疗程记录", "Aesthetic Record"],
  ["zenoti", "https://www.zenoti.com/", "② 疗程记录", "Zenoti"],
  ["mangomint", "https://www.mangomint.com/", "② 疗程记录", "Mangomint"],
  ["boulevard", "https://www.joinblvd.com/", "② 疗程记录", "Boulevard"],
  ["phorest", "https://www.phorest.com/", "② 疗程记录", "Phorest"],
  ["timely", "https://www.gettimely.com/", "② 疗程记录", "Timely"],
  ["vagaro", "https://www.vagaro.com/", "② 疗程记录", "Vagaro"],

  /* ③ 同意书 */
  ["pabauconsent", "https://pabau.com/features/consent-forms/", "③ 同意书", "Pabau 同意书"],
  ["arconsent", "https://www.aestheticrecord.com/features", "③ 同意书", "Aesthetic Record 表单"],
  ["cliniko", "https://www.cliniko.com/", "③ 同意书", "Cliniko"],
  ["janeapp", "https://www.janeapp.com/", "③ 同意书", "Jane"],
  ["nookal", "https://www.nookal.com/", "③ 同意书", "Nookal"],
  ["carepatron", "https://www.carepatron.com/", "③ 同意书", "Carepatron"],
];

const only = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const list = only.length ? SITES.filter(([k]) => only.includes(k)) : SITES;

const browser = await chromium.launch();
const rows = [];

for (const [key, url, group, name] of list) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  let ok = false;
  let why = "";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    /* cookie 那一层挡住半个画面的时候，图上量不到任何东西。 */
    for (const label of [/accept all/i, /accept/i, /agree/i, /got it/i, /allow all/i]) {
      const b = page.getByRole("button", { name: label }).first();
      if (await b.count().catch(() => 0)) {
        await b.click({ timeout: 2500 }).catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${key}.png` });
    /* 第一屏多半是招牌照，产品图常在再下面一屏 —— 多拍一张。 */
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${key}-2.png` });
    ok = true;
  } catch (e) {
    why = String(e).slice(0, 60);
  }
  await page.close();
  rows.push({ key, group, name, ok, why });
  console.log(`  ${name.padEnd(26)} ${ok ? "拍到" : "✗ " + why}`);
}

await browser.close();

/* 一组一张联络表，一眼看得完（[重点 3]：用眼睛）。两张一组并排。 */
for (const g of [...new Set(list.map(([, , x]) => x))]) {
  const mine = rows.filter((r) => r.group === g && r.ok);
  if (!mine.length) continue;
  const H2 = 560;
  const LABEL = 28;
  const GAP = 8;
  const parts = [];
  for (const r of mine) {
    for (const suffix of ["", "-2"]) {
      const f = `${OUT}/${r.key}${suffix}.png`;
      if (!fs.existsSync(f)) continue;
      const meta = await sharp(f).metadata();
      const iw = Math.round(meta.width * (H2 / meta.height));
      parts.push({
        img: await sharp(f).resize({ width: iw, height: H2, fit: "fill" }).toBuffer(),
        w: iw,
        label: suffix ? "" : r.name,
      });
    }
  }
  if (!parts.length) continue;
  const per = 4;
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
              const y = li * (H2 + LABEL + GAP) + 19;
              return `<text x="${x}" y="${y}" font-family="monospace" font-size="15" fill="#f2f2f0">${p.label}</text>`;
            })
            .join(""),
        )
        .join("") +
      `</svg>`,
  );
  const out = `${OUT}/sheet-${g.slice(0, 1)}.jpg`;
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

const missed = rows.filter((r) => !r.ok);
if (missed.length) {
  console.log(`\n⚠️ 拍不到 ${missed.length} 个：`);
  for (const r of missed) console.log(`  · ${r.name} — ${r.why}`);
}
console.log(`\n${OUT}/\n`);

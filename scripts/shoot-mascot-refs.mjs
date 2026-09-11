/**
 * 老板挑形象要看的照片——真的品牌吉祥物，不是我画的。
 *
 *   node scripts/shoot-mascot-refs.mjs
 *
 * 他指定了方向：像 Discord 的 Wumpus 那种——简单、圆润的小生物，
 * 不是写实动物也不是日本动漫风格。这一支去真的品牌页面拍，
 * 摊成一张给他指，照[重点 7m](../docs/founder-points.md)：量大，三个不叫挑。
 * 不猜网址、读官方或维基百科自己的页面，跟 shoot-featurepage.mjs 同一条规矩。
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/mascots";
fs.mkdirSync(OUT, { recursive: true });

const W = 900;
const H = 700;

const TARGETS = [
  ["wumpus", "https://discord.com/branding", "Discord — Wumpus"],
  ["snoo", "https://www.redditinc.com/brand", "Reddit — Snoo"],
  ["octocat", "https://octodex.github.com/", "GitHub — Octocat（官方 Octocat 画廊）"],
  ["gecko", "https://www.geico.com/", "GEICO — Gecko"],
  ["duo", "https://www.duolingo.com/", "Duolingo — Duo"],
  ["fin", "https://www.intercom.com/fin", "Intercom — Fin（AI 助手，抽象符号不是生物）"],
];

const browser = await chromium.launch();
const rows = [];

for (const [key, url, label] of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  const row = { key, label, url, ok: false, why: "" };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    for (const sel of [
      "#onetrust-accept-btn-handler",
      'button:has-text("Accept")',
      'button:has-text("Accept all")',
      /* 🔴 维基百科的募款横幅盖住整页内容——它自己那个 × 按钮。 */
      ".cdx-message__dismiss-button",
      "#dismissButton",
      'a:has-text("Maybe later")',
      "#localNotice .close",
      ".vector-dismissable-banner button",
    ]) {
      const b = page.locator(sel).first();
      if (await b.count().catch(() => 0)) await b.click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${key}.png` });
    row.ok = true;
  } catch (e) {
    row.why = String(e).replace(/\s+/g, " ").slice(0, 70);
  }
  await page.close();
  rows.push(row);
  console.log(`  ${key.padEnd(12)} ${row.ok ? "ok" : "✗ " + row.why}`);
}
await browser.close();

/* 摊成一张，四栏。 */
const ok = rows.filter((r) => r.ok);
const per = 4;
const LABEL = 30;
const GAP = 10;
const cellW = 420;
const cellH = 340;
const lines = [];
for (let i = 0; i < ok.length; i += per) lines.push(ok.slice(i, i + per));
const width = per * (cellW + GAP) + GAP;
const height = lines.length * (cellH + LABEL + GAP) + GAP;

const svg = Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="100%" height="100%" fill="#0b0b0c"/>` +
    lines
      .map((line, li) =>
        line
          .map((r, i) => {
            const x = GAP + i * (cellW + GAP);
            const y = li * (cellH + LABEL + GAP) + 20;
            return `<text x="${x}" y="${y}" font-family="sans-serif" font-size="16" fill="#f2f2f0">${r.label}</text>`;
          })
          .join(""),
      )
      .join("") +
    `</svg>`,
);

await sharp({ create: { width, height, channels: 3, background: { r: 11, g: 11, b: 12 } } })
  .composite([
    { input: svg, top: 0, left: 0 },
    ...(
      await Promise.all(
        lines.flatMap((line, li) =>
          line.map(async (r, i) => ({
            input: await sharp(`${OUT}/${r.key}.png`).resize({ width: cellW, height: cellH, fit: "cover" }).toBuffer(),
            top: li * (cellH + LABEL + GAP) + LABEL,
            left: GAP + i * (cellW + GAP),
          })),
        ),
      )
    ),
  ])
  .jpeg({ quality: 85 })
  .toFile(`${OUT}/pick.jpg`);

console.log(`\n${OUT}/pick.jpg`);
const missed = rows.filter((r) => !r.ok);
if (missed.length) {
  console.log(`\n⚠️ 拍不到 ${missed.length} 个：`);
  for (const r of missed) console.log(`  · ${r.key} — ${r.why}`);
}

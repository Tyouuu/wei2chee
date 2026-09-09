/**
 * 别人的 AI 助手长在哪里 —— 二十四个真的站，一张一张拍回来。
 *
 * ── 为什么有这一支 ──────────────────────────────────────────────────────
 *
 * 老板 2026-09-09：`整个在下面那个ai助手的Ui设计 我不要了
 * 你去参考一下别人是怎么去做Ui设计的`
 *
 * 他讲的是我那一天做的东西：一条贴在画面下缘、整页宽的线。
 * 我是**照我们自己那个外壳的限制**推出来的（那条线要在内容外面，
 * 不然会被侧栏盖住），不是**照别人怎么做**推出来的 —— 而 [重点 7d] 写着
 * 「动手之前先去看别人怎么做」，[重点 7m] 写着「量大，摊成一张给他指」。
 *
 * ── 它回答的那一句 ──────────────────────────────────────────────────────
 *
 * **「一个长在别人产品里的助手，坐在画面的哪一块？」**
 * 不是「好不好看」（那只有眼睛判得了，[重点 24]）——
 * 是**位置 · 大小 · 开着还是收着 · 收起来的时候是什么形状**。
 *
 * ⚠️ 拍到的多半是**他们自己的官网**，不是登入后的产品内页
 * （Xero · Jobber · QuickBooks 的内页在登入后面，[任务 267] 判过一次）。
 * 而**挂在官网上那颗客服泡泡，跟产品里那颗助手，是同一个形状**——
 * 那一颗就是这一支要量的东西。真的产品内页只有几家在行销页上放了图，
 * 那几张也拍进来。
 *
 * ⚠️ 有些站会挡 headless、有些要按 cookie。拍不到的**照实印「拍不到」**
 * （[重点 15]：查不到的要写查不到，不要用推的填）。
 *
 *     node scripts/shoot-askrefs.mjs            # 全部
 *     ONLY=copilotkit,intercom node scripts/...  # 只拍几个
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";

const OUT = ".screenshots/askrefs";
fs.mkdirSync(OUT, { recursive: true });

/* 桌面跟手机两档就够 —— 这一支问的是「坐在哪一块」，
   而那个答案在 820 上跟 390 上是同一个（都是那颗浮钮）。 */
const WIDTHS = [
  [1400, 900, "desktop"],
  [390, 844, "phone"],
];

/* 四类，故意混着拍：
   ① 卖「助手」这套零件的（他们自己的站上就挂着自己的产品）
   ② 我们同一批客户在用的生意软件（沙龙 · 装修 · 记帐）
   ③ 客服泡泡那一派 —— 全世界最多人见过的那个形状
   ④ 文件站的「问 AI」—— 一个不占地方的做法 */
const SITES = [
  ["copilotkit", "https://www.copilotkit.ai/", "① 卖零件", "CopilotKit（MIT 37k）"],
  ["assistantui", "https://www.assistant-ui.com/", "① 卖零件", "assistant-ui（MIT 12k）"],
  ["vercelchat", "https://chat.vercel.ai/", "① 卖零件", "Vercel AI 聊天"],
  ["chatbase", "https://www.chatbase.co/", "① 卖零件", "Chatbase"],

  ["jobber", "https://www.jobber.com/features/", "② 同一批客户", "Jobber（装修 · 水电 · 冷气）"],
  ["fresha", "https://www.fresha.com/for-business", "② 同一批客户", "Fresha（沙龙 13 万家）"],
  ["booksy", "https://booksy.com/biz/en-my", "② 同一批客户", "Booksy（沙龙）"],
  ["xero", "https://www.xero.com/my/", "② 同一批客户", "Xero（记帐）"],
  ["quickbooks", "https://quickbooks.intuit.com/", "② 同一批客户", "QuickBooks（记帐）"],
  ["zoho", "https://www.zoho.com/zia/", "② 同一批客户", "Zoho Zia"],
  ["hubspot", "https://www.hubspot.com/products/artificial-intelligence", "② 同一批客户", "HubSpot Breeze"],
  ["monday", "https://monday.com/", "② 同一批客户", "monday"],
  ["square", "https://squareup.com/us/en", "② 同一批客户", "Square"],
  ["shopify", "https://www.shopify.com/", "② 同一批客户", "Shopify Sidekick"],

  ["intercom", "https://www.intercom.com/", "③ 客服泡泡", "Intercom Fin"],
  ["crisp", "https://crisp.chat/en/", "③ 客服泡泡", "Crisp"],
  ["tidio", "https://www.tidio.com/", "③ 客服泡泡", "Tidio"],
  ["drift", "https://www.salesloft.com/", "③ 客服泡泡", "Salesloft（原 Drift）"],

  ["stripedocs", "https://docs.stripe.com/", "④ 问 AI", "Stripe 文件"],
  ["supabasedocs", "https://supabase.com/docs", "④ 问 AI", "Supabase 文件"],
  ["mintlify", "https://mintlify.com/", "④ 问 AI", "Mintlify"],
  ["gitbook", "https://www.gitbook.com/", "④ 问 AI", "GitBook"],
  ["linear", "https://linear.app/", "④ 问 AI", "Linear"],
  ["notion", "https://www.notion.com/product/ai", "④ 问 AI", "Notion AI"],
];

/* 收起来那一颗，八成长这样。按得到就按一下 —— 摊开来的样子才是要看的。 */
const LAUNCHERS = [
  '[aria-label*="chat" i]',
  '[aria-label*="assistant" i]',
  '[aria-label*="help" i]',
  '[id*="launcher" i]',
  '[class*="launcher" i]',
  'button:has-text("Ask AI")',
  'button:has-text("Ask")',
];

const only = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const list = only.length ? SITES.filter(([k]) => only.includes(k)) : SITES;

const browser = await chromium.launch();
const rows = [];

for (const [key, url, group, name] of list) {
  const row = { key, group, name, shots: {} };
  for (const [w, h, tag] of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(4500);
      /* cookie 那一层挡住半个画面的时候，图上量不到任何东西。 */
      for (const label of [/accept all/i, /accept/i, /agree/i, /got it/i]) {
        const b = page.getByRole("button", { name: label }).first();
        if (await b.count().catch(() => 0)) {
          await b.click({ timeout: 2500 }).catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${key}-${tag}.png` });
      row.shots[tag] = true;

      /* 再按一次那颗启动钮，拍摊开来的样子。按不到就算了 —— 收起来那一张
         本来就是这一支最要紧的读数。 */
      if (tag === "desktop") {
        for (const sel of LAUNCHERS) {
          const b = page.locator(sel).first();
          if (!(await b.count().catch(() => 0))) continue;
          if (!(await b.isVisible().catch(() => false))) continue;
          await b.click({ timeout: 2500 }).catch(() => {});
          await page.waitForTimeout(2500);
          await page.screenshot({ path: `${OUT}/${key}-open.png` });
          row.shots.open = true;
          break;
        }
      }
    } catch (e) {
      row.shots[tag] = String(e).slice(0, 60);
    }
    await page.close();
  }
  rows.push(row);
  const ok = Object.entries(row.shots)
    .map(([k, v]) => (v === true ? k : `${k}✗`))
    .join(" ");
  console.log(`  ${name.padEnd(28)} ${ok}`);
}

await browser.close();

/* 一组一张联络表，一眼看得完（[重点 3]：用眼睛）。 */
const GROUPS = [...new Set(list.map(([, , g]) => g))];
for (const g of GROUPS) {
  const mine = rows.filter((r) => r.group === g && r.shots.desktop === true);
  if (!mine.length) continue;
  const H = 620;
  const LABEL = 30;
  const GAP = 10;
  const parts = [];
  for (const r of mine) {
    const f = `${OUT}/${r.key}-desktop.png`;
    if (!fs.existsSync(f)) continue;
    const meta = await sharp(f).metadata();
    const iw = Math.round(meta.width * (H / meta.height));
    parts.push({
      img: await sharp(f).resize({ width: iw, height: H, fit: "fill" }).toBuffer(),
      w: iw,
      label: r.name,
    });
  }
  if (!parts.length) continue;
  const total = parts.reduce((n, p) => n + p.w + GAP, GAP);
  const svg = Buffer.from(
    `<svg width="${total}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#0b0b0c"/>` +
      parts
        .map((p, i) => {
          const x = GAP + parts.slice(0, i).reduce((n, q) => n + q.w + GAP, 0);
          return `<text x="${x}" y="20" font-family="monospace" font-size="15" fill="#f2f2f0">${p.label}</text>`;
        })
        .join("") +
      `</svg>`,
  );
  const out = `${OUT}/sheet-${g.slice(0, 1)}.jpg`;
  await sharp({
    create: { width: total, height: H + LABEL + GAP, channels: 3, background: { r: 11, g: 11, b: 12 } },
  })
    .composite([
      { input: svg, top: 0, left: 0 },
      ...parts.map((p, i) => ({
        input: p.img,
        top: LABEL + GAP,
        left: GAP + parts.slice(0, i).reduce((n, q) => n + q.w + GAP, 0),
      })),
    ])
    .jpeg({ quality: 84 })
    .toFile(out);
  console.log(`\n  ${g} → ${out}`);
}

const missed = rows.filter((r) => r.shots.desktop !== true);
if (missed.length) {
  console.log(`\n⚠️ 拍不到 ${missed.length} 个：`);
  for (const r of missed) console.log(`  · ${r.name} — ${r.shots.desktop}`);
}
console.log(`\n${OUT}/  · 收起来 <名字>-desktop.png · 摊开来 <名字>-open.png\n`);

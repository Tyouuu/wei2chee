/**
 * 放大来看 —— 一套风格的每一页，两倍解析度，横切成段。
 *
 * 老板 2026-09-03：`不要用缩图 一定要放大 每一个细节慢慢复刻`，
 * 隔一句又讲 `每一套都是要每一页放大来看 你复刻的仔细一点`。
 *
 * ── 为什么另开一支，不并进 `align:admin` ──────────────────────────────────
 * `align:admin` 回答的是「差几项」，它一套只看**一页**（`ourPage`），
 * 因为参考只有那一页，比别页等於比错东西。
 * 这一支回答的是另一个问题：**这一套穿在他每一页上，长什么样。**
 * 六套 × 四页 = 24 张页面，而客户每天开的是后面那 23 张。
 *
 * ── 一个真的坑：放大 ≠ 拉大 ────────────────────────────────────────────────
 * 把 1440 宽的截图用 sharp 放大两倍，**不会长出任何细节** —— 只是把同样的
 * 像素涂大，边缘变糊。要真的看到 1px 的边框、字的粗细、图标的形状，
 * 必须在**拍的时候**就用 `deviceScaleFactor: 2`，让浏览器自己画两倍。
 * 所以这支自己开一个两倍的分页，不共用 `align:admin` 那一个。
 *
 * ⚠️ 它**不判对错**，一个数字都不印。判像不像只有眼睛（[重点 24](../docs/founder-points.md)）。
 * 它做的只有一件事：把细节送到看得见的大小。
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const OUT = ".screenshots/zoom";
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "tianyou.demo@formae.test";
const PASS = process.env.DEMO_PASSWORD || "FormaeDemo2026!";
const OURS_ROOT = '[class*="_PuckCanvas-root"]';

/** 他每天真的会开的那几页。第一页是总览，其余按客户开得多不多排。 */
const PAGES = [
  ["dashboard", "/en/portal/dashboard", "总览"],
  ["quotations", "/en/portal/quotations", "报价单"],
  ["customers", "/en/portal/customers", "客户"],
  ["payments", "/en/portal/payments", "收款"],
];

/** 一段多高（**物理像素**）。1000 物理 = 500 CSS，一屏看得完。 */
const BAND = 1000;

/** 把一张两倍的图横切成段，写成档。回传写了几段。 */
async function bands(buf, dir, name, label) {
  const m = await sharp(buf).metadata();
  const n = Math.max(1, Math.ceil(m.height / BAND));
  for (let i = 0; i < n; i++) {
    const top = i * BAND;
    const h = Math.min(BAND, m.height - top);
    if (h <= 16) break;
    await sharp(buf)
      .extract({ left: 0, top, width: m.width, height: h })
      .jpeg({ quality: 88 })
      .toFile(`${dir}/${name}-${i + 1}.jpg`);
  }
  console.log(`    ${label} ${m.width}×${m.height} → ${n} 段`);
  return n;
}

async function main() {
  const { REGISTER_REFERENCES } = await import("../design-system/register-references.ts");
  const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const regs = want.length ? want : Object.keys(REGISTER_REFERENCES);

  const b = await chromium.launch();
  /* 🔴 两倍要在这里给。开完之后改不了，而改不了正是这支存在的理由。 */
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });

  await p.goto(`${BASE}/en/login`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', EMAIL);
  await p.fill('input[type="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 60000 });

  await p.goto(`${BASE}/en/portal/styles`, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(3500);
  const ORIGINAL = await p.evaluate(() => {
    const c = [...document.querySelectorAll("li[data-register]")].find(
      (x) => !x.querySelector("button[data-register-use]"),
    );
    return c ? c.getAttribute("data-register") : null;
  });
  console.log(`本来是 ${ORIGINAL ?? "(读不到)"}\n`);

  const made = [];
  let failed = 0;

  for (const reg of regs) {
    const ref = REGISTER_REFERENCES[reg];
    if (!ref) { console.log(`${reg}: 没有声明参考`); failed++; continue; }
    const dir = `${OUT}/${reg}`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    console.log(`\n${ref.zh} ${reg}  ← ${ref.reference}`);

    /* 参考先拍，因为它跟我们穿哪一套无关。 */
    let refBands = 0;
    try {
      await p.goto(ref.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(6500);
      const words = await p.evaluate(() => (document.body.innerText || "").replace(/\s+/g, "").length);
      /* 载到一张登入页、或者一张几乎没有字的页，跟没载到是同一件事，
         而它们在档案夹里长得一模一样 —— 所以在这里就挡掉。 */
      if (words < 60) throw new Error(`只读到 ${words} 个字 —— 多半没载到`);
      refBands = await bands(await p.screenshot({ type: "png" }), dir, "ref", "参考");
    } catch (e) {
      console.log(`  🔴 参考页读不到：${String(e).slice(0, 70)}`);
      failed++;
    }

    /* 换成这一套。 */
    await p.goto(`${BASE}/en/portal/styles`, { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(3500);
    const hit = await p.evaluate((w) => {
      const card = document.querySelector(`li[data-register="${w}"]`);
      if (!card) return "miss";
      const btn = card.querySelector(`button[data-register-use="${w}"]`);
      if (!btn) return "active";
      btn.click();
      return "ok";
    }, reg);
    if (hit === "miss") { console.log(`  🔴 画廊里点不到它`); failed++; continue; }
    await p.waitForTimeout(3000);

    const pages = [];
    for (const [key, url, zh] of PAGES) {
      await p.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 120000 });
      await p.waitForTimeout(6000);
      /* 🔴 每一页都要关一次那张「这是一份草稿」的黑卡。
         它**故意不记住**（draft-notice.tsx 的档头写了理由：手机上关掉不该
         让笔电上也不出现），所以换一页它就回来。
         它固定在右上角，而**六个参考页的右上角全部是有东西的** ——
         头像、名字、两三颗图标。不关掉，那一角永远比不了。 */
      await p
        .getByRole("button", { name: /got it, hide this/i })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      /* 关完把指标移开。停在原地的话，编辑器会在指标附近画出那条橘色的
         「＋ 加一段」分隔线 —— 那是我们的编辑器家具，不是这一套风格的设计，
         而它会横过整页，看起来像页面自己有一条线。 */
      await p.mouse.move(4, 4);
      await p.waitForTimeout(500);
      const root = p.locator(OURS_ROOT).first();
      if (!(await root.count())) { console.log(`  🔴 ${zh} 找不到画布`); failed++; continue; }
      const n = await bands(await root.screenshot({ type: "png" }), dir, key, zh);
      pages.push({ key, zh, n, isRef: url === ref.ourPage });
    }
    made.push({ reg, zh: ref.zh, ref, refBands, pages });
  }

  if (ORIGINAL) {
    await p.goto(`${BASE}/en/portal/styles`, { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(3000);
    await p.evaluate((w) => document.querySelector(`button[data-register-use="${w}"]`)?.click(), ORIGINAL);
    await p.waitForTimeout(2500);
    console.log(`\n放回 ${ORIGINAL}`);
  }
  await b.close();

  const img = (r, f) => `<img src="${r}/${f}" loading="lazy">`;
  writeFileSync(
    `${OUT}/index.html`,
    `<title>放大对照</title><style>body{background:#0b0d13;color:#eef1f5;font-family:system-ui;margin:0;padding:20px}
h1{font-size:19px;margin:34px 0 4px;color:#00beb7}h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#6c7686;margin:22px 0 6px;font-weight:500}
p{color:#98a1b0;font-size:13px;margin:0 0 10px}img{display:block;width:100%;max-width:1440px;border:1px solid #222836;margin:0 0 8px;background:#fff}</style>` +
      made
        .map(
          (m) =>
            `<h1>${m.zh} ${m.reg} — 参考：${m.ref.reference}</h1><p>${m.ref.takes}</p>` +
            `<h2>参考页（两倍）</h2>` +
            Array.from({ length: m.refBands }, (_, i) => img(m.reg, `ref-${i + 1}.jpg`)).join("") +
            m.pages
              .map(
                (pg) =>
                  `<h2>我们 · ${pg.zh}${pg.isRef ? "（就是拿来对齐的那一页）" : ""}</h2>` +
                  Array.from({ length: pg.n }, (_, i) => img(m.reg, `${pg.key}-${i + 1}.jpg`)).join(""),
              )
              .join(""),
        )
        .join(""),
  );
  console.log(`\n→ ${OUT}/index.html   ⚠️ 现在去用眼睛看`);
  if (failed) { console.log(`\n🔴 ${failed} 处没拍到。`); process.exit(1); }
}

await main();

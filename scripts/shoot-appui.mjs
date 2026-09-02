/* app 的 UI 素材 —— 拍成图给他挑。
 *
 *   npm run shoot:appui
 *
 * 老板 2026-09-02：`你去找吧 跟我照片的`。
 *
 * ⚠️ [重点 3](../docs/founder-points.md)：**用看的，不是量的。** 所以这支脚本的产出
 * 是一张拼图，不是一张表。
 *
 * ── 为什么是这两批，而不是一批 ─────────────────────────────────────────────
 *
 * [任务 106](../docs/founder-tasks.md) 找完素材之后剩一个洞，而那个洞跟
 * [任务 26](../docs/founder-tasks.md) 是同一件事：**上面找到的画廊全部是国外的。**
 * 而[任务 25](../docs/founder-tasks.md) 学到的那条分边规矩是
 * 「国外给『有哪些区段』，本地给『多大、多宽、多密』」。
 *
 * 手机这一边的「本地」，是他客人手机里**已经装着的那几个**：Grab · Touch 'n Go ·
 * Shopee · MAE · foodpanda。原本以为那要装了才拍得到 —— **不用。**
 * 每一个 app 的商店页面上就摆着它自己的官方截图，公开、打得开、而且是真的画面。
 *
 * ── 🔴 一个实拍抓到的错，写下来免得下次又信 ────────────────────────────────
 *
 * 第一轮探路的读数说 screenlane「17 张手机形状的图」，看起来是这一批里最多的。
 * **打开图一看，那 17 张是 app 的图标**（圆角方形，一整墙），
 * 而整页是一张写着 Try 3 Days 的行销页 —— **它现在要钱，首页一张画面都没有。**
 * 「手机形状」这个量法在图标墙上是会中的。**读数只能否决，通过要用眼睛**
 * （[重点 24](../docs/founder-points.md)）。
 */
import { chromium } from "playwright";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = ".screenshots/appui";
fs.mkdirSync(OUT, { recursive: true });


/* 🟢 专业的老板端 —— 他 2026-09-02：`不要那么大众的吧 去那种专业去弄App后端的网站`。
   挑的不是「有名的 app」，是**跟我们十个零件同一件事的 app**：
   走单 · 记帐 · 名册 · 预约 · 库存。前四个更是他手上两个真的市场
   （承包商 · 沙龙）自己在用的东西。
   ⚠️ 包名全部先打过一次：回「Not Found」的一律不放进来。 */
const PRO = [
  // ── 上门服务 / 承包商：他最大的那个市场 ────────────────────────────────
  ["jobber", "com.getjobber.jobber", "Jobber · 承包商走单"],
  ["housecall", "housecall.pros", "Housecall Pro · 上门服务"],
  ["servicem8", "com.servicem8.skip", "ServiceM8 · 师傅端"],
  // ── 沙龙 / 预约：他手上那一单 ─────────────────────────────────────────
  ["fresha", "com.fresha.Business", "Fresha for business · 沙龙老板端"],
  ["booksy", "net.booksy.business", "Booksy Biz · 沙龙老板端"],
  // ── 收钱 / POS ────────────────────────────────────────────────────────
  ["square", "com.squareup", "Square · 收款 POS"],
  ["shopify", "com.shopify.mobile", "Shopify · 店主端"],
  ["loyverse", "com.loyverse.sale", "Loyverse · POS"],
  // ── 记帐 / 开单 ───────────────────────────────────────────────────────
  ["xero", "com.xero.touch", "Xero · 记帐"],
  ["quickbooks", "com.intuit.quickbooks", "QuickBooks · 记帐"],
  ["zohobooks", "com.zoho.books", "Zoho Books · 记帐"],
  // ── 走单 / 排程 ───────────────────────────────────────────────────────
  ["odoo", "com.odoo.mobile", "Odoo · 整套"],
  ["monday", "com.monday.monday", "monday · 看板"],
  ["asana", "com.asana.app", "Asana · 任务"],
  ["trello", "com.trello", "Trello · 看板"],
  ["notion", "notion.id", "Notion · 文件"],
];

/* 他客人手机里装着的。商店页面上就有官方截图。 */
const LOCAL = [
  ["grab", "com.grabtaxi.passenger", "Grab · 叫车外送"],
  ["tng", "my.com.tngdigital.ewallet", "Touch 'n Go · 电子钱包"],
  ["shopee", "com.shopee.my", "Shopee · 网购"],
  /* 🟢 这两个最贴近我们：使用者就是小生意老板本人。 */
  ["grab-merchant", "com.grab.merchant", "GrabMerchant · 老板端"],
  /* ⚠️ Shopee Seller 拿掉了：试过五个包名全部回 Not Found。
     一个猜错的包名拍回来是一张错误页，**而那跟一张真的截图在读数上长得一样** */
];

/* 国外的，看「有哪些区段」。只放实测打得开而且免费的。 */
const FOREIGN = [
  ["banani", "https://www.banani.co/references/apps", "banani · 免费不用注册"],
  ["refero", "https://refero.design/", "refero · 我们已经在用"],
  ["mobbin", "https://mobbin.com/", "mobbin · 最大，要钱"],
];

/* 开源那几套自己的零件展示，看「一个手机零件长什么样」。 */
/* ⚠️ 两个零件页的网址猜错了，**而它们回的是 200 不是 404** ——
   这两个文件站对不认得的路径照样服务一张壳。跟[任务 23d](../docs/founder-tasks.md)
   那次一模一样。报错的是「几乎没有字」那一条，不是 HTTP 回码。 */
const KITS = [
  ["rnr", "https://reactnativereusables.com/docs/components/button", "react-native-reusables · MIT"],
  ["paper", "https://callstack.github.io/react-native-paper/", "react-native-paper · MIT"],
  ["uilib", "https://wix.github.io/react-native-ui-lib/", "wix ui-lib · MIT"],
  ["m3", "https://m3.material.io/components/buttons/overview", "Material 3 · Google"],
];

const bad = [];
const shots = [];
const b = await chromium.launch();

async function grab(page, name, label, clipToPhones) {
  const m = await page.evaluate(() => {
    const phones = [...document.querySelectorAll("img")]
      .map((i) => i.getBoundingClientRect())
      /* 直的、够大的 —— 一张手机截图的形状。⚠️ 圆角方形的 app 图标是 1:1，
         所以门槛是 1.5 倍高，不是「比较高」。 */
      .filter((r) => r.height > r.width * 1.5 && r.height > 150 && r.width > 60
        /* ⚠️ 只要主栏那一条。第一版拍回来右边夹着「Rated for 3+」跟
           「App support」，因为右侧栏里也有直的图。读数报「8 张画面」，
           图上一半是没用的东西。 */
        && r.x + r.width < 1000);
    const box = phones.length
      ? phones.reduce(
          (a, r) => ({
            x: Math.min(a.x, r.x), y: Math.min(a.y, r.y),
            r: Math.max(a.r, r.x + r.width), b: Math.max(a.b, r.y + r.height),
          }),
          { x: 1e9, y: 1e9, r: -1e9, b: -1e9 },
        )
      : null;
    return {
      phones: phones.length,
      box,
      words: (document.body.innerText.match(/\S+/g) || []).length,
      title: document.title.slice(0, 46),
      /* 商店页面找不到那个 app 的时候，长得跟一张正常页面一样。 */
      missing: /we're sorry, the requested URL was not found|not found on this server/i
        .test(document.body.innerText),
    };
  });

  const file = `${OUT}/${name}.jpg`;
  let clip;
  if (clipToPhones && m.box && m.box.r > m.box.x) {
    const pad = 16;
    clip = {
      x: Math.max(0, m.box.x - pad),
      y: Math.max(0, m.box.y - pad),
      width: Math.min(1440 - Math.max(0, m.box.x - pad), m.box.r - m.box.x + pad * 2),
      height: Math.min(2200, m.box.b - m.box.y + pad * 2),
    };
  }
  await page.screenshot({ path: file, type: "jpeg", quality: 88, clip });

  const note = m.missing
    ? "  🔴 商店上没有这个 app"
    : clipToPhones && m.phones === 0
      ? "  🔴 一张画面都没拍到"
      : m.words < 60
        ? "  🔴 几乎没有字"
        : "";
  if (note) bad.push(name);
  else shots.push([file, label, m.phones]);
  console.log(
    `${name.padEnd(15)} 画面 ${String(m.phones).padStart(3)}  字 ${String(m.words).padStart(5)}  ${label}${note}`,
  );
}

console.log("\n专业的老板端 —— 跟我们做同一件事的 app:");
/* ⚠️ 两倍解析度。商店页里一张手机截图本身只有 ~150px 宽，
   一倍拍出来拼成一张表之后根本读不了——老板 2026-09-03：`太模糊了 我看不到`。
   放大一张小图不会长出细节，要在拍的时候就多拿像素。 */
for (const [name, id, label] of PRO) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  try {
    await p.goto(`https://play.google.com/store/apps/details?id=${id}&hl=en&gl=MY`, {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    await p.waitForTimeout(5000);
    await grab(p, name, label, true);
  } catch (e) {
    bad.push(name);
    console.log(`${name.padEnd(15)} 🔴 读不到  ${String(e).slice(0, 44)}`);
  }
  await p.close();
}

console.log("\n他客人手机里装着的（商店页面上的官方截图）:");
for (const [name, id, label] of LOCAL) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await p.goto(`https://play.google.com/store/apps/details?id=${id}&hl=en&gl=MY`, {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    await p.waitForTimeout(5000);
    await grab(p, name, label, true);
  } catch (e) {
    bad.push(name);
    console.log(`${name.padEnd(15)} 🔴 读不到  ${String(e).slice(0, 44)}`);
  }
  await p.close();
}

console.log("\n国外的画廊:");
for (const [name, url, label] of FOREIGN) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(6000);
    await grab(p, name, label, false);
  } catch (e) {
    bad.push(name);
    console.log(`${name.padEnd(15)} 🔴 读不到  ${String(e).slice(0, 44)}`);
  }
  await p.close();
}

console.log("\n开源那几套自己的零件:");
for (const [name, url, label] of KITS) {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(5000);
    await grab(p, name, label, false);
  } catch (e) {
    bad.push(name);
    console.log(`${name.padEnd(15)} 🔴 读不到  ${String(e).slice(0, 44)}`);
  }
  await p.close();
}

/* 拼成一张。不用外挂 —— 就是一页 HTML，再拍它一次。 */
const cell = (f, label) =>
  `<figure><img src="${pathToFileURL(f).href}"><figcaption>${label}</figcaption></figure>`;
const pick = (list) => shots.filter(([f]) => list.some(([n]) => f.endsWith(`/${n}.jpg`))).map(([f, l]) => cell(f, l)).join("");
const sheet = `<!doctype html><meta charset="utf-8"><style>
 body{margin:0;background:#0e1113;color:#cfc8ba;font:13px/1.4 system-ui,sans-serif;padding:28px}
 h2{font:600 15px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#00beb7;margin:34px 0 14px}
 .g{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
 .g.k{grid-template-columns:repeat(3,1fr)}
 figure{margin:0}
 img{width:100%;display:block;border-radius:6px;background:#fff}
 figcaption{margin-top:6px;font-size:12px;color:#9a938a}
</style>
<h2>专业的老板端 —— 跟我们做同一件事的</h2><div class="g">
${pick(PRO)}
</div>
<h2>他客人手机里装着的（本地的视觉习惯）</h2><div class="g">
${pick(LOCAL)}
</div>
<h2>国外的画廊 / 开源那几套</h2><div class="g k">
${pick(FOREIGN.concat(KITS))}
</div>`;
fs.writeFileSync(`${OUT}/sheet.html`, sheet);
const sp = await b.newPage({ viewport: { width: 1700, height: 1200 } });
await sp.goto(pathToFileURL(`${OUT}/sheet.html`).href);
await sp.waitForTimeout(2500);
await sp.screenshot({ path: `${OUT}/sheet.jpg`, type: "jpeg", quality: 74, fullPage: true });
await sp.close();
await b.close();

console.log(`\n→ ${OUT}/sheet.jpg   ⚠️ 现在用眼睛看，读数只能否决`);
if (bad.length) {
  console.log(`\n🔴 ${bad.length} 张没拍到：${bad.join(" ")}`);
  process.exit(1);
}

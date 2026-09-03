/**
 * 同行的系统长什么样 —— 拿他们自己公开摆出来的画面。
 *
 * ⚠️ 不注册他们的试用帐号。那是拿假身分进别人的服务，而我们要的东西
 * 他们本来就公开摆着：产品页的截图、说明中心的画面、商店页的官方图。
 * 这跟 9-03 拍手机 app 用的是同一招 —— 商店页面上就摆着真的界面。
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = ".screenshots/rivals";
mkdirSync(OUT, { recursive: true });

const SITES = [
  ["sql-features", "https://www.sql.com.my/sql-account/", "SQL Account 产品页"],
  ["autocount", "https://www.autocountsoft.com/product/autocount-accounting/", "AutoCount 会计"],
  ["autocount-cloud", "https://www.autocountsoft.com/product/autocount-cloud-accounting/", "AutoCount 云端"],
  ["bukku", "https://bukku.my/features", "Bukku 功能页"],
  ["bukku-home", "https://bukku.my/", "Bukku 首页"],
  ["tunai", "https://tunaipos.com/", "Tunai"],
  ["aoikumo", "https://www.aoikumo.com/", "Aoikumo"],
  ["storehub", "https://www.storehub.com/my/", "StoreHub"],
  ["qne", "https://qne.cloud/my/", "QNE"],
  ["financio", "https://financio.co/my/", "Financio"],
];

/** Google Play 的商店页 —— 官方摆的真实界面图，跟拍手机 app 那一轮同一个来源。 */
const STORE = [
  ["play-bukku", "https://play.google.com/store/apps/details?id=my.bukku.app", "Bukku 手机版"],
  ["play-autocount", "https://play.google.com/store/apps/details?id=com.autocount.pos", "AutoCount POS"],
  ["play-storehub", "https://play.google.com/store/apps/details?id=com.storehub.beep", "StoreHub"],
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await p.setExtraHTTPHeaders({
  "accept-language": "en-MY,en;q=0.9",
});

const rows = [];
for (const [key, url, name] of [...SITES, ...STORE]) {
  try {
    const r = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const status = r?.status() ?? 0;
    await p.waitForTimeout(3500);
    const words = (await p.evaluate(() => document.body?.innerText?.length ?? 0)) || 0;

    /* 载不到就是失败，不是「这一页很简单」。这个仓库被这一条骗过至少四次。 */
    if (status !== 200 || words < 400) {
      rows.push({ key, name, status, words, ok: false });
      console.log(`🔴 ${name.padEnd(18)} ${status} · ${words} 字 —— 拿不到`);
      continue;
    }
    await p.screenshot({ path: `${OUT}/${key}.png`, fullPage: false });
    /* 整页也拍一张：产品截图通常在中段，不在第一屏。 */
    await p.screenshot({ path: `${OUT}/${key}-full.png`, fullPage: true }).catch(() => {});
    const imgs = await p.evaluate(() =>
      [...document.images].filter((i) => i.naturalWidth > 500 && i.naturalHeight > 300).length,
    );
    rows.push({ key, name, status, words, imgs, ok: true });
    console.log(`   ${name.padEnd(18)} ${status} · ${words} 字 · ${imgs} 张大图`);
  } catch (e) {
    rows.push({ key, name, ok: false, why: String(e).slice(0, 60) });
    console.log(`🔴 ${name.padEnd(18)} 打不开 —— ${String(e).slice(0, 50)}`);
  }
}

/*
  第二轮：把他们嵌在页面里的产品图抓下来。

  ⚠️ 这才是有用的那一半。整页截图拍到的是行销版面 —— 一句大标题压着一台
  斜放的萤幕，量它量到的是那个行销设计师的排版。真正的界面是页面里那几张
  大图，抓图本身才拿得到原始像素。跟 9-03 拍手机 app 学到的是同一条。
*/
const UI = `${OUT}/ui`;
mkdirSync(UI, { recursive: true });
let grabbed = 0;

for (const [key, url, name] of SITES) {
  if (!rows.find((r) => r.key === key)?.ok) continue;
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    /* 滚一遍，不然懒载入的图根本没进 DOM */
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    await p.waitForTimeout(2000);

    /* 只要「像一张界面」的：够大，而且比例偏宽 —— 一张后台截图几乎一定是横的，
       而 logo、头像、图标是方的，人物照多半更方或更竖。 */
    const urls = await p.evaluate(() =>
      [...document.images]
        .filter(
          (i) =>
            i.naturalWidth >= 700 &&
            i.naturalHeight >= 380 &&
            i.naturalWidth / i.naturalHeight > 1.15 &&
            i.naturalWidth / i.naturalHeight < 2.6,
        )
        .map((i) => i.currentSrc || i.src)
        .filter((s) => s && !s.startsWith("data:")),
    );
    const uniq = [...new Set(urls)].slice(0, 8);
    for (const [i, u] of uniq.entries()) {
      const r = await p.request.get(u, { timeout: 30000 }).catch(() => null);
      if (!r || !r.ok()) continue;
      const ext = (u.split("?")[0].split(".").pop() || "png").slice(0, 4);
      writeFileSync(`${UI}/${key}-${i}.${ext}`, await r.body());
      grabbed += 1;
    }
    console.log(`   ${name.padEnd(18)} 产品图 ${uniq.length} 张`);
  } catch (e) {
    console.log(`🔴 ${name.padEnd(18)} 产品图抓不到 —— ${String(e).slice(0, 40)}`);
  }
}

await b.close();
const got = rows.filter((r) => r.ok).length;
console.log(`\n判：${got} / ${rows.length} 个页面 · ${grabbed} 张产品图 · ${OUT}/`);

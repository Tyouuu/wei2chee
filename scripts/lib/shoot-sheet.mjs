/**
 * 拍一批网站，摊成一张给老板挑。
 *
 * 从 `shoot-admins.mjs` 抽出来的（2026-09-08）—— 因为平台那一边要拍另一批
 * （建造工具：Puck · GrapesJS · Craft.js · Typeform…），而**把这两百行抄第二份，
 * 正是这个仓库栽过至少八次的那件事**。两支尺，一份实作。
 *
 * ⚠️ [重点 7m](../../docs/founder-points.md)：**量要大** ——「他要的是挑，三个不叫挑」，
 * 而三十个档案也不叫挑，那叫三十次开档案。所以一定要摊成一张。
 *
 * 🔴 三条自检，每一条都是被骗过之后才加的：
 *   · **像登入页** —— 一张登入页的截图，跟一张正常的截图，在报告里长得一模一样
 *   · **几乎没有字** —— 网址猜错的时候常常回 200 加一张壳
 *   · **跟别人一模一样** —— `gentelella.colorlib.com` 每一个路径都回 200，
 *     回的是同一张行销首页，五张截图长得完全正常
 */
import { chromium } from "playwright";
import fs from "node:fs";

/**
 * @param {[string, string, string][]} SITES  [名字, 网址, 出处]
 * @param {string} OUT  资料夹
 * @param {{ perRow?: number, width?: number, wait?: number, seen?: Map<string,string> }} [opts]
 * @returns {Promise<number>} 没拍到几张
 */
export async function shootSheet(SITES, OUT, opts = {}) {
  const { perRow = 5, width = 420, wait = 6500 } = opts;
  fs.mkdirSync(OUT, { recursive: true });

  /* `ONLY=a,b` 只拍那几个 —— 拼图照旧用全部拍过的档案组，
     所以补一批的时候不用把几十个重拍一遍。 */
  const PICK = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((x) => x.trim())) : null;
  /* 🔴 查重要**跨整轮**，不是一批一次。
     2026-09-08：`shoot:pagerefs` 一组呼叫一次，而 gentelella 的五个路径
     全部回同一张行销首页 —— 五张分在五组，**组内不撞，所以这一条看不见**，
     整轮回报「没拍到 0 张」。呼叫端把同一个 Map 传进来，它才看得到。
     （这个仓库为同一件事栽过一次：[任务 103](../../docs/founder-tasks.md)。） */
  const seen = opts.seen ?? new Map();
  let bad = 0;

  const b = await chromium.launch();
  for (const [name, url, repo] of SITES) {
    if (PICK && !PICK.has(name)) continue;
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(wait);
      const m = await p.evaluate(() => ({
        h: document.body.scrollHeight,
        cards: [...document.querySelectorAll("div,section,article")].filter((e) => {
          const c = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return (
            r.width > 140 &&
            r.height > 80 &&
            parseFloat(c.borderRadius) > 2 &&
            (c.boxShadow !== "none" || parseFloat(c.borderTopWidth) > 0)
          );
        }).length,
        /* ⚠️ 第一版只看头 600 个字里有没有「sign in」，於是**侧栏上一个
           「Sign In」的选单项**就把一张好好的后台判成登入页。一张登入页真正的
           特徵是**整页只有那一件事**：字少，而且画面上有一个密码框。 */
        looksLikeLogin:
          !!document.querySelector('input[type="password"]') ||
          ((document.body.innerText.match(/\S+/g) || []).length < 120 &&
            /sign in|log in|登录|登入/i.test(document.body.innerText.slice(0, 400))),
        words: (document.body.innerText.match(/\S+/g) || []).length,
        /* 🔴 一个编辑器的外壳**本来就是图标不是字** —— GrapesJS 那一排区块形状、
           Craft.js 那几颗「拖过去加一块」，整页 32–49 个字而画面是对的。
           2026-09-08 那条「几乎没有字」一口气冤枉了两张真的截图。
           所以「空」要两件都成立：**字很少，而且按得到的东西也很少**。 */
        controls: document.querySelectorAll("button,[role=button],a[href],input,select").length,
      }));
      await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 62 });
      const fp = `${m.h}/${m.cards}/${m.words}`;
      const twin = seen.get(fp);
      seen.set(fp, twin ?? name);
      const note = twin
        ? `  🔴 跟 ${twin} 一模一样 —— 多半没换页`
        : m.looksLikeLogin
          ? "  🔴 像登入页"
          : m.words < 60 && m.controls < 20
            ? "  🔴 几乎没有字"
            : "";
      if (note) bad++;
      console.log(
        `${name.padEnd(17)} ${String(m.h).padStart(6)}px  卡片 ${String(m.cards).padStart(3)}  字 ${String(m.words).padStart(4)}  ${repo}${note}`,
      );
    } catch (e) {
      bad++;
      console.log(`${name.padEnd(17)} 🔴 读不到  ${String(e).slice(0, 48)}`);
    }
    await p.close();
  }
  await b.close();

  /* 摊成一张。只取第一屏 —— 一张 7000px 高的页缩到 420 宽就是一条看不见的线，
     而挑设计看的是**打开的那一眼**。 */
  const { createRequire } = await import("node:module");
  const sharp = createRequire(import.meta.url)("sharp");
  const W = width;
  const LABEL = 26;
  const tiles = [];
  for (const [name, , repo] of SITES) {
    const f = `${OUT}/${name}.jpg`;
    if (!fs.existsSync(f)) continue;
    const img = await sharp(f).resize({ width: W }).toBuffer();
    const h = Math.min((await sharp(img).metadata()).height, 300);
    const top = await sharp(img).extract({ left: 0, top: 0, width: W, height: h }).toBuffer();
    const label = Buffer.from(
      `<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#0b0d13"/>` +
        `<text x="6" y="17" font-family="monospace" font-size="12" fill="#00beb7">${name}</text>` +
        `<text x="${W - 6}" y="17" text-anchor="end" font-family="monospace" font-size="10" fill="#6c7686">` +
        `${repo.replace(/[<>&]/g, "")}</text></svg>`,
    );
    tiles.push(
      await sharp({ create: { width: W, height: h + LABEL, channels: 3, background: "#0b0d13" } })
        .composite([
          { input: top, top: 0, left: 0 },
          { input: label, top: h, left: 0 },
        ])
        .png()
        .toBuffer(),
    );
  }
  const rows = Math.ceil(tiles.length / perRow);
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const rowH = [];
  for (let r = 0; r < rows; r++)
    rowH.push(Math.max(...metas.slice(r * perRow, (r + 1) * perRow).map((m) => m.height)));
  const G = 8;
  const sheetW = perRow * W + (perRow + 1) * G;
  const sheetH = rowH.reduce((a, c) => a + c + G, G);
  const comp = [];
  let y = G;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < perRow; c++) {
      const i = r * perRow + c;
      if (i >= tiles.length) break;
      comp.push({ input: tiles[i], left: G + c * (W + G), top: y });
    }
    y += rowH[r] + G;
  }
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#0b0d13" } })
    .composite(comp)
    .jpeg({ quality: 72 })
    .toFile(`${OUT}/sheet.jpg`);
  console.log(`\n${tiles.length} 张摊成一张 → ${OUT}/sheet.jpg`);
  console.log(`\n→ ${OUT}/   ⚠️ 现在去用眼睛看拼图，读数只能否决`);
  if (bad) console.log(`\n🔴 ${bad} 张没拍到。`);
  return bad;
}

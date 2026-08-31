/* 别人的「价钱那一段」长什么样 —— 从 Awwwards 的得奖站里挖，逐个量。
 *
 *   node scripts/shoot-pricing.mjs startups technology business-corporate --n 8
 *
 * ── 为什么是这一段，为什么是 Awwwards ──────────────────────────────────────
 * 老板 2026-09-01 挑的参考（consider.digital）是一篇文章，**它从头到尾没有
 * 跟人要过钱**，所以我们最弱的那半段（价钱 → 收据 → 最后那颗按钮）它教不了。
 * 我先提议去挖 Lapa Ninja（7,303 个官网、按区段切开），他否掉：
 * 「还是去awwwards去找 质量认证」。
 *
 * **他讲对了，而理由是数得出来的**：Lapa 是一个画廊，收录没有门槛；
 * Awwwards 每一个都过评审团。[任务 31](../docs/founder-tasks.md) 量过
 * landing.love 那个池子 —— 68% 是设计师做给设计师看的作品集，
 * 一个没有质量门槛的池子，多数样本会把我们带偏。
 *
 * ⚠️ Awwwards **没有 pricing 这个分类**（179 个分类全部读过了）。
 * 所以不能靠分类找，要**靠内容找**，而且两个条件要同时成立：
 * 「pricing / plans」这种字长在**标题或 id 上**，**而且**那一段至少有两个钱数。
 * ⚠️ 第一版只要其中一个就算，**三个样本全部认错** —— 第一屏的成效数字、
 * 正文里一句 "calibrate price" 都被当成价钱段。这一点很重要：
 * 靠分类找会找到零个，然后这支脚本会安静地回报「都挖过了」。
 *
 * ── 量什么（每一项都是我们那一段答不出来的问题）────────────────────────────
 *   在整页的第几 %      他们把价钱放多前面（我们放在 78%）
 *   那一段多高          一段价钱值得占多少画面
 *   几档                两档？三档？还是一条一条列？
 *   钱印多大            那个数字是不是这一段的主角（我们是 40px）
 *   有没有「最多人选」   要不要替客户先挑一个
 *   那一段的地色        它有没有换地（我们整页黑，这一段也是黑）
 *   按钮几颗、写什么     最后那一下要人做什么
 *
 * ⚠️ 量完**一定要看那张对照图**（[重点 7l](../docs/founder-points.md)）——
 * 数字挑得出「谁不一样」，挑不出「哪一个好看」。
 */
import { chromium } from "playwright";
import fs from "node:fs";

/* ⚠️ `--n 6` 的那个 6 也要剔掉，不然它会被当成一个叫「6」的分类，
   然后印出「════ 6 （0 个得奖站）」—— 一个看起来像资料的假分类。 */
const ARGV = process.argv.slice(2);
const CUT = ARGV.indexOf("--urls");
const CATS = (CUT === -1 ? ARGV : ARGV.slice(0, CUT)).filter(
  (a, i) => !a.startsWith("--") && ARGV[i - 1] !== "--n",
);
const N = Number(process.argv[process.argv.indexOf("--n") + 1]) || 6;
if (!CATS.length && !process.argv.includes("--urls")) {
  console.error("用法: node scripts/shoot-pricing.mjs startups technology [--n 6]");
  process.exit(1);
}

/* ── 直接给网址，不经过 Awwwards ──────────────────────────────────────────
   node scripts/shoot-pricing.mjs --urls https://linear.app/pricing ...

   ⚠️ **为什么需要这个模式，是量出来的**：照老板讲的去 Awwwards 挖
   （5 个分类 · 34 个不重复的得奖站），**只有 1 个有真的价钱段**。
   他讲「去 awwwards 找 质量认证」是对的 —— 那个池子确实有门槛；
   **但那个池子里几乎没有在跟人收订阅费的产品**：得奖的是形象站、
   作品集、产品发表、企划。**有门槛，不等於有我们要的东西。**
   （[任务 31](../docs/founder-tasks.md) 量 landing.love 是同一个形状的另一半：
   那边是没门槛而且 68% 是设计师给设计师看的。）
   → 所以价钱这一段要去**真的在收钱的产品**那里量。 */
const URLS = ARGV.includes("--urls") ? ARGV.slice(ARGV.indexOf("--urls") + 1).filter((a) => a.startsWith("http")) : [];

const OUT = ".screenshots/pricing";
fs.mkdirSync(OUT, { recursive: true });

/** 在一页里找出「价钱那一段」并量它。两条路（Awwwards 分类 / 直接给网址）
 *  共用同一份 —— 两份会各自漂移，而这个仓库栽在那上面很多次。 */
const PROBE = () => {
      const MONEY = /(?:[$€£¥]|RM|USD|EUR)\s?\d|\d+\s?(?:\/|per\s)\s?(?:mo|month|yr|year|user|seat)/i;
      const WORD = /\b(pricing|plans?|price|membership|subscribe|packages?)\b/i;

      /* 靠内容找那一段，不是靠分类 —— Awwwards 没有 pricing 分类。
         ⚠️ 第一版**三个样本全部认错**：Rothfinder 认成第一屏（它那几个
         $1,041,000 是「你会多赚多少」不是价钱），Nomu 认成功能格
         （正文里有一句 "calibrate price"）。**在正文里找关键词就是在找错
         东西** —— 这个仓库栽过很多次的同一个形状。
         改成两个条件同时成立才算：
           ① 关键词要长在**标题或 id/class** 上，不是正文里
           ② 那一段**至少要有两个钱数**
         而且第一屏一律不算 —— 第一屏的数字讲的是成效，不是价钱。 */
      let best = null;
      for (const el of document.querySelectorAll("section, div[id], div[class], main > div, footer")) {
        const r = el.getBoundingClientRect();
        if (r.height < 260 || r.width < window.innerWidth * 0.6) continue;
        const top = r.top + window.scrollY;
        if (top < window.innerHeight * 0.8) continue; // 第一屏不算
        const txt = el.innerText || "";
        if (txt.length > 4000) continue; // 太大 = 它是整页的包装，不是一段
        const heads = [...el.querySelectorAll("h1,h2,h3,h4")].map((h) => h.innerText || "").join(" ");
        const money = (txt.match(new RegExp(MONEY, "gi")) || []).length;
        const named =
          WORD.test(heads) ||
          WORD.test(el.id || "") ||
          WORD.test(typeof el.className === "string" ? el.className : "");
        if (!named || money < 2) continue;
        /* 越小越好：最贴身的那一层才是「那一段」，不是它的爷爷。 */
        if (!best || r.height < best.h) best = { el, h: r.height, money, named };
      }
      if (!best) return null;

      const el = best.el;
      const box = el.getBoundingClientRect();
      const top = box.top + window.scrollY;
      const px = (s) => Number((s.match(/[\d.]+/) || [0])[0]);

      /* 钱印多大 —— 找这一段里含钱数、而且字最大的那个元素。 */
      let biggest = 0;
      let biggestText = "";
      for (const n of el.querySelectorAll("*")) {
        if (n.children.length) continue;
        const t = (n.textContent || "").trim();
        if (!t || !MONEY.test(t)) continue;
        const size = px(getComputedStyle(n).fontSize);
        if (size > biggest) { biggest = size; biggestText = t.slice(0, 18); }
      }

      /* 几档 —— 找那个「一排等宽的孩子」的容器。 */
      let tiers = 0;
      for (const n of el.querySelectorAll("*")) {
        const kids = [...n.children].filter((k) => k.getBoundingClientRect().height > 120);
        if (kids.length < 2 || kids.length > 6) continue;
        const ws = kids.map((k) => Math.round(k.getBoundingClientRect().width));
        const sameW = Math.max(...ws) - Math.min(...ws) < 24;
        const sameRow = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top / 20))).size === 1;
        if (sameW && sameRow && kids.length > tiers) tiers = kids.length;
      }

      const buttons = [...el.querySelectorAll("a,button")]
        .filter((b) => b.getBoundingClientRect().height > 24 && (b.innerText || "").trim())
        .map((b) => b.innerText.trim().replace(/\s+/g, " ").slice(0, 22));

      const bg = (() => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && !/rgba?\([^)]*,\s*0\)/.test(c) && c !== "transparent") return c;
          n = n.parentElement;
        }
        return "";
      })();
      const pageBg = getComputedStyle(document.body).backgroundColor;

      return {
        total: document.body.scrollHeight,
        top: Math.round(top),
        pct: Math.round((top / document.body.scrollHeight) * 100),
        h: Math.round(box.height),
        tiers,
        money: best.money,
        named: best.named,
        figure: Math.round(biggest),
        figureText: biggestText,
        popular: /most popular|recommended|best value|popular/i.test(el.innerText || ""),
        bg,
        sameGround: bg === pageBg,
        buttons: [...new Set(buttons)].slice(0, 4),
      };
};

const browser = await chromium.launch();
const rows = [];

/** 一个站量完 —— 网址进，读数出。分类那条路跟直接给网址那条路共用它。 */
async function measure(name, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 900) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 140));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(900);
    const m = await page.evaluate(PROBE);
    if (!m) {
      console.log(`  ${String(name).padEnd(26)} 没有价钱段`);
    } else {
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 60)), m.top);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 74 });
      rows.push({ name, url, ...m });
      console.log(
        `  ${String(name).padEnd(26)} ${String(m.pct).padStart(3)}%  高 ${String(m.h).padStart(5)}  ` +
          `${m.tiers || "-"} 档  钱 ${String(m.figure).padStart(3)}px ${m.figureText.padEnd(10)} ` +
          `${m.popular ? "有最多人选 " : "          "}${m.sameGround ? "同一个地" : "换了地"}`,
      );
    }
  } catch (e) {
    console.log(`  ${String(name).padEnd(26)} X ${String(e).split(String.fromCharCode(10))[0].slice(0, 56)}`);
  }
  await page.close();
}

if (URLS.length) {
  console.log(`
════ 直接给的网址（${URLS.length} 个）`);
  for (const u of URLS) await measure(new URL(u).hostname.replace(/^www\./, ""), u);
}

for (const cat of CATS) {
  const list = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let slugs = [];
  try {
    await list.goto(`https://www.awwwards.com/websites/${cat}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await list.waitForTimeout(4000);
    slugs = await list.evaluate(() =>
      [...new Set([...document.querySelectorAll("a[href*='/sites/']")].map((a) => a.href))].filter((h) =>
        /awwwards\.com\/sites\//.test(h),
      ),
    );
  } catch (e) {
    console.log(`════ ${cat}  ✖ ${String(e).split("\n")[0].slice(0, 70)}`);
  }
  await list.close();
  console.log(`\n════ ${cat}  (${slugs.length} 个得奖站)`);

  for (const slug of slugs.slice(0, N)) {
    /* 提名页 → 真正的网址。Awwwards 自己那一页没有价钱段可以量。 */
    const nom = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let url = "";
    let why = "";
    let name = slug.split("/").filter(Boolean).pop();
    try {
      await nom.goto(slug, { waitUntil: "domcontentloaded", timeout: 40000 });
      await nom.waitForTimeout(2600);
      url = await nom.evaluate(() => {
        /* ⚠️ 不要只认「Visit Site」那颗按钮：实测 8 个里有 4 个读不到，
           因为那颗按钮的字要等它自己渲染完才出现，而其他几条指向同一个网址
           的连结（logo、缩图）是**没有字**的。
           改成**数**：外部连结里出现最多次的那个域名就是它。
           一个只认得一种写法的选择器，会安静地把一半样本判成「没有网址」。 */
        const count = new Map();
        for (const a of document.querySelectorAll("a")) {
          if (!a.href?.startsWith("http") || a.href.includes("awwwards.com")) continue;
          if (/facebook|twitter|x\.com|instagram|linkedin|dribbble|behance|youtube/.test(a.href)) continue;
          count.set(a.href, (count.get(a.href) ?? 0) + 1);
        }
        const named = [...document.querySelectorAll("a")].find(
          (x) => /visit\s*site|visit\s*website/i.test(x.innerText || "") && x.href?.startsWith("http") && !x.href.includes("awwwards"),
        );
        if (named) return named.href;
        const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : "";
      });
    } catch (e) {
      why = String(e).split(String.fromCharCode(10))[0].slice(0, 50);
    }
    await nom.close();
    if (!url) {
      /* ⚠️ 讲清楚是「读不到」还是「它真的没有外部连结」——
         一句笼统的「拿不到网址」会让人以为是资料的问题，
         而实测有一半是 Awwwards 连着开太多页之后挡我们。 */
      console.log(`  ${String(name).padEnd(26)} ← 拿不到网址${why ? "：" + why : ""}`);
      continue;
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      /* 先滚一遍到底，把懒载入的东西叫出来 —— 价钱段几乎永远在下半页。 */
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 900) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 140));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(900);

      const m = await page.evaluate(PROBE);

      if (!m) {
        console.log(`  ${String(name).padEnd(26)} 没有价钱段`);
      } else {
        await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 60)), m.top);
        await page.waitForTimeout(700);
        const file = `${OUT}/${name}.jpg`;
        await page.screenshot({ path: file, type: "jpeg", quality: 74 });
        rows.push({ name, url, ...m });
        console.log(
          `  ${String(name).padEnd(26)} ${String(m.pct).padStart(3)}%  高 ${String(m.h).padStart(5)}  ` +
            `${m.tiers || "-"} 档  钱 ${String(m.figure).padStart(3)}px ${m.figureText.padEnd(10)} ` +
            `${m.popular ? "有最多人选 " : "          "}${m.sameGround ? "同一个地" : "换了地"}`,
        );
      }
    } catch (e) {
      console.log(`  ${String(name).padEnd(26)} ✖ ${String(e).split("\n")[0].slice(0, 56)}`);
    }
    await page.close();
  }
}

await browser.close();

if (rows.length) {
  fs.writeFileSync(`${OUT}/readings.json`, JSON.stringify(rows, null, 2));
  const med = (k) => {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === "number" && x > 0).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  };
  console.log(`\n量到 ${rows.length} 段价钱`);
  console.log(`  中位：在整页 ${med("pct")}% · 高 ${med("h")}px · ${med("tiers")} 档 · 钱印 ${med("figure")}px`);
  console.log(`  ${rows.filter((r) => r.popular).length}/${rows.length} 有「最多人选」标记`);
  console.log(`  ${rows.filter((r) => !r.sameGround).length}/${rows.length} 这一段换了地色`);
  console.log(`\n⚠️ 数字只挑得出「谁不一样」。挑「哪一个好看」要看 ${OUT}/ 里的图。`);
} else {
  /* 一段都没找到 = 这支脚本什么都没量，而它会安静地看起来像跑完了。 */
  console.log("\n✖ 一段价钱都没找到 —— 是找法坏了，不是别人都不写价钱");
  process.exit(1);
}

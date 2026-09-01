/* 这十一个画面是不是同一个产品？—— 量得出来的那几件。
 *
 *   npm run check:consistency
 *
 * ── 为什么要这一把尺 ────────────────────────────────────────────────────────
 * 老板 2026-09-01：`我们要每一个操作跟页面都是要好看的UI设计跟流畅的使用体验`
 * · `毕竟是我们自己的平台 我们要用心去设计`。
 *
 * 「不好看」判不了对错。[重点 24](../docs/founder-points.md) 讲清楚了分工：
 * **眼睛判像不像，尺子判有没有再犯。** 所以这一支不判好看，
 * 它只量**一个产品跟十一个产品的差别**：
 *
 *   ① 内容从哪里开始   十一页的正文左缘对不对得齐
 *   ② 顶栏有没有       PageBar 是这个外壳的门牌，九个 surface 在用
 *   ③ 标题长什么样     一个产品最多两三种标题，不是十一种
 *   ④ 手机上横不横滚   横滚 = 有东西碰不到（[任务 55](../docs/founder-tasks.md) 栽过）
 *   ⑤ 手机上按钮多高   拇指按得到是 44px，不是「看起来还行」
 *
 * ⚠️ 它**不会**说「这一页很丑」。它只会说「这一页跟其他十页不是同一套」。
 * 好不好看还是要打开 `.screenshots/journey/` 用眼睛看（[重点 7l](../docs/founder-points.md)）。
 *
 * ⚠️ 一条 magic link 只能用一次 —— 每一个宽度各产生一条。
 * `shoot-journey.mjs` 因为共用一条，**整个手机半边拍的是登入页，而且没有人发现**，
 * 因为它只印 1440 那一半的读数。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const PROJECT = process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2";
const { data: proj } = await db.from("projects").select("account_id").eq("id", PROJECT).single();
const { data: acct } = await db.from("accounts").select("email").eq("id", proj.account_id).single();

const PAGES = [
  ["home", "/en/portal"],
  ["editor", "/en/portal/dashboard"],
  ["quotations", "/en/portal/quotations"],
  ["website", "/en/portal/website"],
  ["enquiries", "/en/portal/enquiries"],
  ["library", "/en/portal/library"],
  ["templates", "/en/portal/templates"],
  ["sections", "/en/portal/sections"],
  ["styles", "/en/portal/styles"],
  ["spec", "/en/portal/spec"],
  ["account", "/en/portal/account"],
];

/* 在浏览器里跑。只看**看得见**的东西 —— 这个仓库量过好几次 DOM 里的东西，
   而 DOM 里的东西不是画面上的东西。 */
/* ⚠️ 这是一个**真的函式**，不是一段字串。
   写成字串的那一版，正则里的反斜线要逃两层，而 `rgba?\(` 到了浏览器变成
   「跳脱的反斜线 + 左括号」= 括号没有配对 = 每一页都 Invalid regular expression。
   playwright 会自己把函式送进页面，没有这一层。 */
const PROBE = () => {
  /* 🔴 缩略图里的东西不算数。
     「sections」 那一页量出 432 个控件，**其中 378 个长在缩放过的缩略图里** ——
     那是客户自己页面的按钮画成一格 60px 的小图，不是老板要按的东西。
     照那样算，这一页的「按钮太小」是 430 个；真正的数字是 54。
     [任务 85](../docs/founder-tasks.md) 犯过一模一样的错（报了一屏 460 个控件，
     裁图一看画面上只有 24 个）。
     判别靠两件事：祖先被 transform 缩过，或者祖先是外壳那几个展示容器
     （CSS module 的 class 名字里仍然带着 mount / exhibit / paper / sheet）。 */
  const inChrome = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const t = getComputedStyle(n).transform;
      /* ⚠️ 「有 transform」不等於「是缩略图」——framer-motion 的进场动画会在
         每一个区块上留下一个 transform，於是第二版把**整个 portal 排除掉了**，
         十一页十一个「—」，而摘要那一行照样印出「正文左缘 1 种」。
         **一把量不到任何东西的尺，印出来的是满分。**
         只有真的被缩小过才算缩略图。 */
      if (t && t !== "none") {
        const m = t.match(/matrix\(([-0-9.]+)/);
        if (m && parseFloat(m[1]) < 0.9) return true;
      }
      if (/mount|exhibit/i.test(String(n.className))) return true;
    }
    return false;
  };

  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    /* ⚠️ 手机上侧栏是**推到画面外**的（translate，不是 display:none），
       所以它十几条导航连结在每一页都被算成「按钮太小」——
       每一行都虚胖十几个。推到画面外的东西，手指碰不到。 */
    if (r.right <= 0 || r.left >= innerWidth || r.bottom <= -2) return false;
    const c = getComputedStyle(el);
    if (c.visibility === "hidden" || c.display === "none" || Number(c.opacity) < 0.05) return false;
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  };

  const rail = [...document.querySelectorAll("nav, aside")]
    .filter(seen)
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.left < 8 && r.height > innerHeight * 0.5)
    .sort((a, b) => b.width - a.width)[0];
  const railW = rail ? Math.round(rail.right) : 0;

  /* ⚠️ 第一版要求 top <= 1，於是**手机上十一页有十页报「没有顶栏」** ——
     而顶栏就在那里，只是坐在手机版那条 header 下面（top: 57）。
     一把把「我没找到」印成「它没有」的尺，跟一把坏掉的尺一样。 */
  const bar = [...document.querySelectorAll("div,header")].filter((e) => {
    if (!seen(e) || inChrome(e)) return false;
    const c = getComputedStyle(e);
    if (c.position !== "sticky" && c.position !== "fixed") return false;
    const r = e.getBoundingClientRect();
    return r.top <= 96 && r.top >= 0 && r.width > (innerWidth - railW) * 0.6 && r.height < 120;
  })[0];
  const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;

  const first = [...document.querySelectorAll("h1,h2,h3,p,table,ul")]
    .filter((e) => seen(e) && !inChrome(e) && e.textContent.trim().length > 1)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter((o) => o.r.left >= railW - 1 && o.r.top > barBottom)
    .sort((a, b) => a.r.top - b.r.top)[0];

  /* ⚠️ 「这一页最大的标题」不可以包含**客户自己页面**里的标题 ——
     编辑器那三页画布上就是他的官网，那里的 54px Libre Franklin 是他的字体，
     不是我们外壳的。第一版把它算进来，於是报「我们有 9 种标题」。 */
  const head = [...document.querySelectorAll("h1,h2")]
    .filter((e) => seen(e) && !inChrome(e))
    .map((e) => ({ e, s: parseFloat(getComputedStyle(e).fontSize) }))
    .sort((a, b) => b.s - a.s)[0];
  const hc = head ? getComputedStyle(head.e) : null;

  const taps = [...document.querySelectorAll("button, a[href], [role=button]")]
    .filter((e) => seen(e) && !inChrome(e))
    .filter((e) => {
      const c = getComputedStyle(e);
      const painted = !/rgba?\\(0, 0, 0, 0\\)|transparent/.test(c.backgroundColor);
      return painted || parseFloat(c.borderTopWidth) > 0;
    })
    .map((e) => Math.round(e.getBoundingClientRect().height));

  return {
    hasBar: Boolean(bar),
    contentX: first ? Math.round(first.r.left) : null,
    headPx: head ? Math.round(head.s) : null,
    headWeight: hc ? hc.fontWeight : null,
    headFamily: hc ? hc.fontFamily.split(",")[0].replace(/["']/g, "") : null,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    tapsUnder44: taps.filter((h) => h < 44).length,
    tapsTotal: taps.length,
  };
};

const rows = { 1440: [], 390: [] };
let bad = 0;
const b = await chromium.launch();
for (const W of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
  await p
    .goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`, {
      waitUntil: "networkidle",
      timeout: 180000,
    })
    .catch(() => {});
  for (const [name, path] of PAGES) {
    try {
      await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
      await p.waitForTimeout(1400);
      await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
      /* 落在登入页就是没量到，不是量到了一页很简单的画面。 */
      if (/\/login/.test(p.url())) {
        rows[W].push({ name, failed: "落在登入页" });
        bad++;
        continue;
      }
      rows[W].push({ name, ...(await p.evaluate(PROBE)) });
    } catch (e) {
      rows[W].push({ name, failed: String(e).slice(0, 50) });
      bad++;
    }
  }
  await ctx.close();
}
await b.close();

const pad = (v, n) => String(v ?? "—").padStart(n);
for (const W of [1440, 390]) {
  console.log(`\n══ ${W}px ══`);
  console.log("  页面          顶栏  正文左缘   标题 px/字重/字体          横滚   按钮<44px");
  for (const r of rows[W]) {
    if (r.failed) {
      console.log(`  ${r.name.padEnd(12)} 🔴 ${r.failed}`);
      continue;
    }
    const face = `${pad(r.headPx, 3)} ${pad(r.headWeight, 3)} ${(r.headFamily ?? "—").slice(0, 17).padEnd(17)}`;
    console.log(
      `  ${r.name.padEnd(12)} ${r.hasBar ? " 有 " : " 无 "} ${pad(r.contentX, 8)}   ${face} ${pad(r.overflowX > 1 ? "+" + r.overflowX : "", 5)}  ${pad(W === 390 ? `${r.tapsUnder44}/${r.tapsTotal}` : "", 9)}`,
    );
  }
}

const ok = rows[1440].filter((r) => !r.failed);
const xs = [...new Set(ok.map((r) => r.contentX))].sort((a, c) => a - c);
const heads = [...new Set(ok.map((r) => `${r.headPx}/${r.headWeight}`))];
const bars = ok.filter((r) => r.hasBar).length;
const over = rows[390].filter((r) => !r.failed && r.overflowX > 1);
const thumbs = rows[390].filter((r) => !r.failed).reduce((a, r) => a + r.tapsUnder44, 0);

console.log("\n── 一个产品，还是十一个 ──");
console.log(`  正文左缘   ${xs.length} 种   ${xs.join(" · ")}`);
console.log(`  标题       ${heads.length} 种   ${heads.join(" · ")}`);
console.log(`  顶栏       ${bars}/${ok.length} 页有`);
console.log(`  手机横滚   ${over.length} 页   ${over.map((r) => `${r.name}+${r.overflowX}`).join(" ") || "—"}`);
console.log(`  手机上拇指按不稳的按钮  ${thumbs} 个`);
console.log(`\n  目标：正文左缘 ≤ 2 种 · 标题 ≤ 3 种 · 顶栏 ${ok.length}/${ok.length} · 横滚 0 页`);

/* ⚠️ 门槛**故意先不 exit 1**。今天的数字远超它，而一把从第一天就红的尺
   跟一把坏掉的尺一样没有人看（`check:upstream` 天天喊狼那次的教训）。
   收敛到门槛之内的那一天再把它打开 —— 写在[任务 92](../docs/founder-tasks.md)。
   但**量不到**仍然是失败：落在登入页、页面开不了，那是尺子坏了不是产品好了。 */
if (bad) process.exit(1);

/* 真的走一遍 —— 会点、会打字、会按 Tab，然后记下哪里会让人卡住。
 *
 *   npm run walk
 *
 * 老板 2026-09-02：`我是要那种看到细节的 不然你就去实际模拟人使用电话跟电脑
 * 进行一下操作 你就知道有什么是需要加强的呢`。
 *
 * ⚠️ 这一支跟 check:consistency 是两件事。那一支量**静止的画面**
 * （左缘、字级、顶栏）。这一支量**按下去之后发生了什么**：
 *
 *   1. 点了多久才有反应       —— 超过一秒而画面完全没动，人会再点一次
 *   2. 点了有没有立刻的回馈   —— 没有忙碌样子的等待，看起来就是坏了
 *   3. 键盘走到哪里看不看得见 —— Tab 过去而没有框，等於键盘用不了
 *   4. 画面会不会自己跳       —— 载入后元素位移，手指会按到别的东西
 *   5. 从一张表单回得去吗     —— 抬起头有没有一条看得见的路
 *
 * ⚠️ **它不写任何东西**。只点连结、开表单、打字，不按送出 ——
 * demo 帐号是老板自己在看的那一个，一把每跑一次就往里面丢一笔假单的尺，
 * 是有代价的尺（align 那次就是这样被抓到的）。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { demoProject } from "./lib/demo-project.mjs";
import fs from "node:fs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const demo = await demoProject(db);
const PROJECT = demo.id;
const proj = demo;
const acct = { email: demo.email };

const OUT = ".screenshots/walk";
fs.mkdirSync(OUT, { recursive: true });
const notes = [];
const note = (where, what) => {
  notes.push({ where, what });
  console.log("  " + where.padEnd(20) + " " + what);
};

const BUSY = '[aria-busy="true"],[data-busy],[data-nav-pending],[role=progressbar],.animate-spin,[data-loading]';

/** 按下去之后，画面多久才有第一个变化？中间有没有「正在做」的样子？ */
async function press(p, locator, label) {
  const before = await p.evaluate(() => document.body.innerText.slice(0, 4000));
  const url0 = p.url();
  const t0 = Date.now();
  try {
    await locator.click({ timeout: 5000 });
  } catch {
    note(label, "点不到");
    return;
  }
  let firstChange = null;
  let sawBusy = false;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(60);
    const s = await p.evaluate(
      (sel) => ({ txt: document.body.innerText.slice(0, 4000), busy: !!document.querySelector(sel) }),
      BUSY,
    );
    if (s.busy) sawBusy = true;
    if (firstChange === null && (s.txt !== before || p.url() !== url0)) firstChange = Date.now() - t0;
    if (firstChange !== null && Date.now() - t0 > 700) break;
  }
  if (firstChange === null) note(label, "点了 2.4 秒，画面完全没动");
  else if (firstChange > 900 && !sawBusy)
    note(label, "等 " + firstChange + "ms 才有反应，中间没有任何「正在做」的样子");
}

/** 键盘走一圈：有几个停靠点看不出焦点在哪。 */
async function tabRing(p, n, where) {
  let blind = 0;
  let seen = 0;
  await p.evaluate(() => {
    const e = document.activeElement;
    if (e instanceof HTMLElement) e.blur();
  });
  for (let i = 0; i < n; i++) {
    await p.keyboard.press("Tab");
    const r = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const c = getComputedStyle(e);
      const rect = e.getBoundingClientRect();
      const onScreen = rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.top < innerHeight;
      /* 看得见的焦点 = 有外框、有阴影、或自己有边。三个都没有就是没有。 */
      const ring =
        (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0) ||
        c.boxShadow !== "none" ||
        parseFloat(c.borderTopWidth) > 0;
      return {
        onScreen,
        ring,
        tag: e.tagName,
        txt: (e.innerText || e.getAttribute("aria-label") || "").trim().slice(0, 24),
      };
    });
    if (!r || !r.onScreen) continue;
    seen++;
    if (!r.ring) {
      blind++;
      if (blind <= 3) note(where, "键盘走到「" + (r.txt || r.tag) + "」看不出焦点在哪");
    }
  }
  if (seen) note(where, "键盘 " + seen + " 个停靠点，" + blind + " 个看不见");
}

/** 载入之后画面还会不会自己跳。 */
async function settle(p, where) {
  const pos = () =>
    p.evaluate(() =>
      [...document.querySelectorAll("h1,h2,button,a[href],table")]
        .slice(0, 60)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return Math.round(r.top) + ":" + Math.round(r.left);
        })
        .join("|"),
    );
  const a = await pos();
  await p.waitForTimeout(1600);
  const c = await pos();
  if (a !== c) {
    const aa = a.split("|");
    const cc = c.split("|");
    const moved = aa.filter((v, i) => v !== cc[i]).length;
    note(where, "站定之后又跳了一次，" + moved + " 个东西换了位置");
  }
}

/** 🔴 按下去不会有反应的控件 —— 用打靶的方式判，不猜原因。
 *
 * 2026-09-02 用真的滑鼠点出来的：报价单那一页右上角的「New quotations」，
 * **编辑模式下按不动，预览模式下按得动**，而打开那一页预设就是编辑模式。
 *
 *     edit     点 (1325,148) -> 按不动
 *     preview  点 (1325,98)  -> 走到 /en/portal/quotations/new
 *
 * ⚠️ **我第一版把原因写错了**，写成「祖先 pointer-events: none」。
 * 那条规则反过来才对：`pointer-events` 是会继承的，所以一个元素自己算出来是
 * `auto`，它就是**收得到**点击的 —— 照那个写法，Puck 的「＋ 加一段」
 * 被判成死的，而它明明按得动。**一个错的原因配一个对的现象，比没查更糟。**
 *
 * 真正的原因是**被盖住**：那颗连结的正中央，`elementFromPoint` 回来的是
 * 编辑器画布的一层 `DropZone`，不是它自己。所以这里用打靶判：
 * 往控件正中央打一枪，回来的不是它（也不是它里面的东西），它就按不动。
 * 不用真的点，也就不会真的走掉。
 */
async function pointerDead(p, where) {
  const dead = await p.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll("a[href],button")) {
      const r = e.getBoundingClientRect();
      if (r.width < 40 || r.height < 16) continue;
      if (r.bottom < 4 || r.top > innerHeight - 4) continue;
      const txt = (e.innerText || "").trim();
      if (!txt || e.disabled) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const covered = !hit || !(hit === e || e.contains(hit));
      if (!covered) continue;
      /* ⚠️ 画布上大部分东西**本来就是不该按的** —— 那是「一张页面的照片」，
         里面的导航跟按钮属於一套还不存在的系统，`mobile-editor.tsx` 的档头
         白纸黑字写过为什么。所以只报**真的功能**被埋在里面的：
         今天唯一一个是 `/new`（加一单），它是 8-31 才做出来的真功能，
         而它长在那张照片里。 */
      const href = e.getAttribute("href") || "";
      if (!/\/new$/.test(href)) continue;
      out.push(txt.replace(/\s+/g, " ").slice(0, 26) + " → " + href);
    }
    return [...new Set(out)];
  });
  if (dead.length) note(where, "🔴 真的功能被埋在画布里，按不动：" + dead.join(" · "));
  return dead;
}

/** 手机上侧栏是收起来的 —— 一个人要先按那个汉堡。 */
async function openNav(p, W) {
  if (W >= 500) return;
  const burger = p.locator('header button, button[aria-label*="enu"], button[aria-expanded]').first();
  if (await burger.count()) {
    await burger.click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(600);
  }
}

const b = await chromium.launch();
for (const W of [1440, 390]) {
  console.log("\n====== " + (W === 390 ? "手机" : "电脑") + " " + W + "px ======");
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
  await p
    .goto(BASE + "/auth/confirm?token_hash=" + link.properties.hashed_token + "&type=magiclink&next=/en/portal", {
      waitUntil: "networkidle",
      timeout: 180000,
    })
    .catch(() => {});
  await p.waitForTimeout(1200);

  await settle(p, "首页");
  await pointerDead(p, "首页");
  await openNav(p, W);
  await p.screenshot({ path: OUT + "/" + W + "-1-home.jpg", type: "jpeg", quality: 62 });

  /* 一个人进来第一件事：从侧栏点进自己的单子。 */
  await press(p, p.locator('a:has-text("Quotations")').first(), "侧栏 到 报价单");
  await p.waitForTimeout(900);
  await settle(p, "报价单");
  await pointerDead(p, "报价单");
  await p.screenshot({ path: OUT + "/" + W + "-2-quotations.jpg", type: "jpeg", quality: 62 });

  /* 加一单：开得了吗、第一格在不在眼前、送出在不在眼前、回不回得去。 */
  const add = p.locator('a[href$="/new"]').first();
  if (await add.count()) {
    /* 先照人的方式点一次（会失败，上面那条已经讲了原因），
       再直接走网址进去 —— 不然后面每一项表单检查都量不到。 */
    await press(p, add, "加一单（用点的）");
    const href = await add.getAttribute("href");
    await p.goto(BASE + href, { waitUntil: "networkidle", timeout: 180000 });
    await p.waitForTimeout(1400);
    const f = await p.evaluate(() => {
      /* ⚠️ 排除画布里的表单。报价单那一页的画布上有客户自己官网的询价表单
         （怎么称呼 · 电话 · 想做什么），第一版把它当成「加一单」的表单量，
         於是报「输入框只有 0px 高」「送出还是灰的」—— 两条都是关於别人的表单。 */
      const live = (el) => {
        for (let n = el; n; n = n.parentElement)
          if (getComputedStyle(n).pointerEvents === "none") return false;
        return true;
      };
      const i = [...document.querySelectorAll("form input, form textarea")].filter(live)[0];
      if (!i) return null;
      const r = i.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height), inView: r.top >= 0 && r.top < innerHeight };
    });
    if (!f) note("加一单", "打开了，但找不到任何一个可以填的格子");
    else {
      if (!f.inView) note("加一单", "第一个要填的格子在画面外（" + f.top + "px），要先滚才看得到");
      if (f.h < 44 && W === 390) note("加一单", "手机上输入框只有 " + f.h + "px 高，拇指按不稳");
      await p.locator("form input").first().fill("走一遍用的字，不会送出").catch(() => {});
      await p.waitForTimeout(400);
      const s = await p.evaluate(() => {
        const live = (el) => {
          for (let n = el; n; n = n.parentElement)
            if (getComputedStyle(n).pointerEvents === "none") return false;
          return true;
        };
        const list = [...document.querySelectorAll("form button")].filter(live);
        const btn = list.find((x) => x.type === "submit") || list.pop();
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { disabled: btn.disabled, inView: r.top < innerHeight, top: Math.round(r.top) };
      });
      if (s && s.disabled) note("加一单", "字填了，送出还是灰的，而画面上没有讲为什么");
      if (s && !s.inView) note("加一单", "送出那颗在画面外（" + s.top + "px）");
    }
    await tabRing(p, 14, "加一单");
    /* 抬起头，有没有一条看得见的路回到那张清单。 */
    const canGoBack = await p.evaluate(() => {
      const list = location.pathname.replace(/\/new$/, "");
      return [...document.querySelectorAll("a[href]")].some((a) => {
        const r = a.getBoundingClientRect();
        const href = a.getAttribute("href") || "";
        return r.width > 2 && r.top < innerHeight && (href === list || href.endsWith(list));
      });
    });
    if (!canGoBack) note("加一单", "这一屏没有任何一条看得见的路回到那张清单");
    await p.screenshot({ path: OUT + "/" + W + "-3-new.jpg", type: "jpeg", quality: 62 });
  } else {
    note("报价单", "找不到加一单");
  }

  await p.goto(BASE + "/en/portal/enquiries", { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(1500);
  await settle(p, "询价");
  await tabRing(p, 10, "询价");
  await p.screenshot({ path: OUT + "/" + W + "-4-enquiries.jpg", type: "jpeg", quality: 62 });

  await p.goto(BASE + "/en/portal/account", { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(1200);
  await tabRing(p, 16, "帐号");
  await p.screenshot({ path: OUT + "/" + W + "-5-account.jpg", type: "jpeg", quality: 62 });

  await ctx.close();
}
await b.close();
console.log("\n共 " + notes.length + " 条 · 截图在 " + OUT + "/");

/**
 * 每一页要他做几件事、看到什么、等多久 —— **摩擦，不是通不通**。
 *
 *   npm run walk:friction            装修
 *   TRADE=salon npm run walk:friction
 *
 * 老板 2026-09-07：
 *   `你要帮我很详细的排查 不止是按不按的动啊 我还要user friendly的改善方法`
 *
 * ── 它跟 walk:customer 差在哪（两支都要，不是同一份清单的两半）─────────
 *
 *   walk:customer  一天的事走不走得通 —— 按了有没有反应、打的字存不存得下
 *   **这一支**      同一条路顺不顺 —— **等多久 · 打几个字 · 看得懂吗**
 *
 * 一件事可以完全走得通而完全不好用：一张十四个框的表单存得下每一个字，
 * 而他每一张单都要打十四次。**前一支量得到「存下来了」，量不到那十四次。**
 *
 * ── 🔴 它量两边，而那个对照就是这一支最有力的一条 ───────────────────────
 *
 * `front-door.ts` 定的：一页都没保存过 → 开**编辑器**；保存过 → 开**他的系统**。
 * 所以同一个老板、同一页，在他按下第一次保存**之前跟之後**是两个画面。
 * 这一支**两边各走一次**，因为「第一次进来那一段有多难用」只有对照才讲得清楚。
 *
 * ⚠️ 它自己开一个用完就删的帐号，不碰示范帐号（walk.mjs 那条规矩没被推翻）。
 * ⚠️ 它**不判分数**，它印读数。「几秒算慢」「几个字算多」是他的判断，
 *    而一条我发明的门槛，会让这份读数从第一天起就在替他做决定。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `fric-${STAMP}@formae.test`;
const PASSWORD = `Fric!${STAMP}`;

const TRADES = {
  reno:     { pages: ["customers", "quotations", "payments", "projects"], who: "Hin Fatt Renovation", job: "quotations" },
  salon:    { pages: ["customers", "bookings", "payments"],               who: "Wei Hair Studio",     job: "bookings" },
  hardware: { pages: ["customers", "inventory", "orders", "payments"],    who: "Seng Huat Hardware",  job: "orders" },
};
const TRADE = process.env.TRADE || "reno";
const T = TRADES[TRADE];
if (!T) throw new Error(`不认得这一行：${TRADE}（${Object.keys(TRADES).join(" ")}）`);
const OUT = `.screenshots/walk-friction/${TRADE}`;
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
let userId = null;
dropThrowawayOnExit?.(admin, () => userId);

const found = [];
const BAD = "红";
const ODD = "黄";
const NIT = "灰";
const flag = (level, where, what, ev = "") => {
  found.push({ level, where, what, ev });
  const mark = level === BAD ? "🔴" : level === ODD ? "⚠️ " : "· ";
  console.log(`  ${mark} ${where.padEnd(22)} ${what}${ev ? "\n       " + ev : ""}`);
};
const ok = (where, what) => console.log(`  ✓  ${where.padEnd(22)} ${what}`);
const head = (t) => console.log(`\n${t}`);

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
const seen = async (page) => (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");

/* 每一页量的那一份读数 */
const readPage = async (page) => {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
    };
    const inFold = (el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };

    /* 可以按的 */
    const clickable = [...document.querySelectorAll("a,button,[role=button],summary,select")].filter(vis);
    /* 🔴 死的：一条哪里都不去的连结 —— 按下去什么都不会发生，而它长得跟活的一样 */
    const dead = clickable
      .filter((el) => {
        if (el.tagName !== "A") return false;
        const h = el.getAttribute("href");
        return !h || h === "#" || h.startsWith("#") === false ? !h || h === "#" : false;
      })
      .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30));

    /* 输入 */
    const boxes = [...document.querySelectorAll("input,textarea,select")].filter(vis).filter((el) => el.type !== "hidden");
    const typed = boxes.filter((el) => !["checkbox", "radio", "submit", "button"].includes(el.type));
    const required = typed.filter((el) => el.required || el.getAttribute("aria-required") === "true");
    const assisted = typed.filter(
      (el) => el.tagName === "SELECT" || el.getAttribute("list") || el.getAttribute("role") === "combobox",
    );
    const labelOf = (el) => {
      const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
      const wrap = el.closest("label");
      return (
        (byFor && byFor.innerText) ||
        (wrap && wrap.innerText) ||
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        ""
      ).replace(/\s+/g, " ").trim();
    };
    const nameless = typed.filter((el) => !labelOf(el)).map((el) => el.name || el.type || "?");

    /* 拇指按不稳的（44px 是 Apple 自己的最小值） */
    const small = clickable
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height < 44 || r.width < 44;
      })
      .map((el) => ({
        t: (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 24),
        h: Math.round(el.getBoundingClientRect().height),
        w: Math.round(el.getBoundingClientRect().width),
      }))
      .filter((x) => x.t);

    /* 被切断的字 —— 省略号是设计，一句被切一半的句子是坏的 */
    const clipped = [...document.querySelectorAll("p,span,div,h1,h2,h3,td,th,li,label,button,a")]
      .filter(vis)
      .filter((el) => {
        const s = getComputedStyle(el);
        if (s.textOverflow !== "ellipsis" && s.overflow !== "hidden") return false;
        return el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 30;
      })
      .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40))
      .filter(Boolean);

    /* 🔴 示例资料自己讲出「我是示例」——「Sample content」「Record 001」
       是我们的词不是他的词。一个装修老板打开会问「Sample content 是谁」。
       重点 22d 记过同一类（拿错道具），而这一次连假装都没有。 */
    const placeholders = [...new Set(
      (document.body.innerText || "").match(/Sample content|Record \d{3}|Lorem|TODO|EMPTY STATE|placeholder/gi) ?? [],
    )];

    /* 🔴 贴在底部那一条会盖住内容 —— 除非内容底下留了它的高度。
       手机上那张纸的最后一段就被它切在半句话上。 */
    const bars = [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") return false;
      const r = el.getBoundingClientRect();
      return r.height > 30 && r.bottom > window.innerHeight - 8 && r.width > window.innerWidth * 0.5;
    });
    let covered = [];
    if (bars.length) {
      const top = Math.min(...bars.map((b) => b.getBoundingClientRect().top));
      covered = [...document.querySelectorAll("p,td,h1,h2,h3,li,span")]
        .filter(vis)
        /* ⚠️ 底下那一条自己的字当然在它自己里面 —— 第一版把它算成「被盖住的」，
           於是它对着一个完全正常的底栏报「盖住 2 段字」。
           **一把把家具算成被家具盖住的尺，量的是它自己。** */
        .filter((el) => !bars.some((b) => b.contains(el)))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > top + 4 && (el.innerText || "").trim().length > 8;
        })
        .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 44))
        .slice(0, 4);
    }

    return {
      clickable: clickable.length,
      inFold: clickable.filter(inFold).length,
      placeholders,
      covered,
      dead,
      words: (document.body.innerText || "").trim().split(/\s+/).length,
      boxes: typed.length,
      required: required.length,
      assisted: assisted.length,
      nameless,
      small,
      clipped: [...new Set(clipped)],
      hSpill: document.documentElement.scrollWidth > window.innerWidth + 2,
      labels: [...new Set(clickable.map((el) => (el.innerText || "").replace(/\s+/g, " ").trim()).filter((t) => t && t.length <= 28))],
      h1: [...document.querySelectorAll("h1")].filter(vis).map((el) => el.innerText.replace(/\s+/g, " ").trim()),
    };
  });
};

/* 一页开多久 —— 从按下去到主要内容真的画出来
   🔴 第一版等 `innerText.length > 120`，而 customers 整页只有 78 个字 ——
   於是它对一个完全正常的页面等满 60 秒，报「开 64 秒」。
   **一个把自己的等待条件报成产品慢的读数，比没有读数更糟。**
   现在等的是「主要区块里有字」，而且逾时会讲出来，不假装那是载入时间。 */
const timeTo = async (page, url) => {
  const t = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  let timedOut = false;
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector("main") || document.querySelector("[data-editor-canvas]") || document.body;
        return (el.innerText || "").trim().length > 30;
      },
      null,
      { timeout: 20000 },
    )
    .catch(() => {
      timedOut = true;
    });
  const sec = (Date.now() - t) / 1000;
  return timedOut ? { sec, timedOut } : { sec, timedOut: false };
};

let browser;
const words = { save: new Set(), back: new Set(), add: new Set(), cancel: new Set() };
const titles = [];

try {
  /* ── 台面：一个刚走完问卷的老板 ───────────────────────────────────── */
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  await admin.from("projects").update({ business_name: T.who, system_language: "en" }).eq("id", proj.id);
  /* 🔴 **风格不在这里挑** —— 一个真的客人是登入之后在挑风格那一页挑的，
     而那一页也是他第一天会看到的东西之一。
     ⚠️ 而且这不只是「比较真实」：先设风格，登入之后那一跳的目标就变成
     `/portal`，而那一页在本机第一次编译要好几分钟 —— 於是整支尺卡在登入页上，
     画面上写着「帐号或密码不对」，而那句话是假的（帐密从头到尾是对的）。
     **一趟因为落点太重而卡住的走法，跟一个坏掉的登入页长得一模一样。** */

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.on("pageerror", (e) => flag(BAD, "浏览器", "页面丢出错误", String(e).slice(0, 150)));

  /* ── 登入 ────────────────────────────────────────────────────────────
     ⚠️ 这一段的秒数**不是产品的读数** —— 登入之后那一跳要等目标页面算完，
     而在本机开发服务器上那包含第一次编译。实测：同一支脚本，
     没暖机 180 秒还没跳，编译过 15 秒。正式环境那几页是预先编译好的。 */
  head("① 登入 —— 他第一次打开这个产品");
  const tLogin = Date.now();
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (!page.url().includes("/portal")) {
    /* 🔴 登不进去要讲得出为什么 —— 一个只讲「登不进去」的尺，
       跟一个坏掉的登入页在报告里长得一模一样。拍一张，把画面上的字印出来。 */
    await shot(page, "0-stuck-on-login");
    const said = await seen(page);
    console.log("  画面上写着：", said.slice(0, 400));
    const state = await page.evaluate(() => {
      const b = document.querySelector('button[type="submit"]');
      return {
        btn: b ? { text: (b.innerText || "").trim(), disabled: b.disabled, aria: b.getAttribute("aria-disabled") } : null,
        spin: /loading|signing|wait|…/i.test(document.body.innerText || ""),
        url: location.href,
      };
    });
    console.log("  那颗按钮：", JSON.stringify(state));
    throw new Error(`登入没成功：${((Date.now() - tLogin) / 1000).toFixed(1)}s 之后还在 ${new URL(page.url()).pathname}`);
  }
  const loginSec = (Date.now() - tLogin) / 1000;
  ok("登入", `${loginSec.toFixed(1)}s 落在 ${new URL(page.url()).pathname}（含本机编译，不是产品的读数）`);

  /* ── ①b 挑一套风格 —— 他第一天真的会走的那一步 ──────────────────────── */
  head("①b 挑一套风格");
  {
    await shot(page, "0-style-select");
    const r = await readPage(page);
    console.log(`  这一页：一屏 ${r.inFold} 个可按 · ${r.words} 个字`);
    if (r.hSpill) flag(BAD, "挑风格", "画面横着溢出去了");
    const cjk = ((await seen(page)).match(/[一-鿿]/g) ?? []).length;
    if (cjk) flag(ODD, "挑风格", `英文系统里 ${cjk} 个中文字`);

    const pick = page.locator("button:visible, a:visible, [role=button]:visible").filter({ hasText: /^(Ledger|Swiss|Hearth|Counter|Blueprint|Signboard)\b/i }).first();
    if (!(await pick.count())) {
      flag(ODD, "挑风格", "找不到一套可以挑的 —— 改用直接设");
      await api.rpc("set_project_style", { new_style: "swiss" });
    } else {
      const label = ((await pick.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim().slice(0, 24);
      await pick.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const { data: after } = await api.from("projects").select("style").single();
      if (after?.style) ok("挑风格", `按「${label}」→ 存下来是 ${after.style}`);
      else {
        flag(BAD, "挑风格", `按「${label}」之后资料库里还是空的`);
        await api.rpc("set_project_style", { new_style: "swiss" });
      }
    }
    for (const key of T.pages) await api.rpc("add_project_page", { requested_key: key, new_title: null });
  }

  /* ── ⓪ 暖机 ──────────────────────────────────────────────────────────
     🔴 每一页各开一次，把本机第一次编译的时间花掉。下面量到的才是产品的。
     **一份把编译时间报成载入时间的读数，比没有读数更糟。** */
  head("⓪ 暖机 —— 把本机第一次编译的时间花掉");
  for (const key of [...T.pages, `${T.job}/new`]) {
    const t = Date.now();
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 300000 }).catch(() => {});
    await page.waitForTimeout(500);
    console.log(`  暖 ${key.padEnd(16)} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }

  /* ── ② 他的系统：每一页 ───────────────────────────────────────────────
     🔴 2026-09-07 凌晨那个改动之后，**每一个新客人一进来就落在这里**
     （`87c3ce4`：一进来就是他的系统，「改设计」是一颗按钮）。
     所以这一段量的是他每天真正看到的那一边，不再是编辑器。 */
  head("② 他的系统 —— 每一页（一进来就落在这里）");
  const before = {};
  for (const key of T.pages) {
    const { sec, timedOut } = await timeTo(page, `${BASE}/en/portal/${key}`);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(900);
    const r = await readPage(page);
    before[key] = { sec, timedOut, ...r };
    await shot(page, `sys-${key}`);
    console.log(
      `  ${key.padEnd(12)} ${sec.toFixed(1)}s${timedOut ? " ⚠️等不到内容" : ""} · 一屏 ${String(r.inFold).padStart(3)} 个可按 · ${String(r.words).padStart(4)} 个字 · ${r.boxes} 个框`,
    );
    if (timedOut) flag(BAD, key, "20 秒还没有内容画出来");
    if (r.placeholders.length)
      flag(ODD, key, `示例资料用的是我们的词，不是他的`, r.placeholders.slice(0, 4).join(" · "));
    if (r.dead.length) flag(BAD, key, `${r.dead.length} 条连结哪里都不去`, r.dead.slice(0, 4).join(" · "));
    if (r.hSpill) flag(BAD, key, "画面横着溢出去了");
    if (r.clipped.length) flag(ODD, key, `${r.clipped.length} 句被切断`, r.clipped.slice(0, 3).join(" | "));
    if (r.h1.length !== 1) flag(ODD, key, `${r.h1.length} 个大标题`, r.h1.slice(0, 3).join(" · "));
    const cjk = ((await seen(page)).match(/[一-鿿]/g) ?? []).length;
    if (cjk) flag(ODD, key, `英文系统里 ${cjk} 个中文字`);
    titles.push({ page: key, when: "他的系统", h1: r.h1[0] || "（没有）" });
    for (const l of r.labels) {
      const v = /^(save|confirm|apply|done|update|back|return|cancel|close|discard|new|add|create)\b/i.exec(l);
      if (!v) continue;
      const verb = v[1].toLowerCase();
      if (/save|confirm|apply|done|update/.test(verb)) words.save.add(verb);
      if (/back|return|cancel|close|discard/.test(verb)) words.back.add(verb);
      if (/new|add|create/.test(verb)) words.add.add(verb);
    }
  }

  /* ── ②b 那颗主要动作按不按得动 ────────────────────────────────────────
     🔴 2026-09-06 那一趟证明过：画布把点击吃掉，而那是因为新客人落在编辑器。
     凌晨那个改动把正门翻过来了 —— **所以这一段现在量的是它有没有真的修好，
     以及还有没有哪一页漏掉。** */
  head("②b 那颗主要动作按不按得动");
  let stuck = 0;
  for (const key of T.pages) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(2200);
    const btn = page.locator("a:visible").filter({ hasText: /^new |^add /i }).first();
    if (!(await btn.count())) {
      flag(ODD, key, "找不到那一颗主要动作");
      continue;
    }
    const label = ((await btn.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
    const url0 = page.url();
    const err = await btn.click({ timeout: 6000 }).catch((e) => String(e).split("\n")[0]);
    await page.waitForTimeout(1800);
    if (page.url() === url0) {
      /* 🔴 「按不动」跟「还没准备好」是两件事，而画面上长得一模一样 ——
         而两件的改法完全不一样：前者要修那颗按钮，后者要让画面讲一句
         「还在准备」。等三秒再按一次就分得开。 */
      await shot(page, `stuck-${key}`);
      await page.waitForTimeout(3500);
      await btn.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(1800);
      if (page.url() === url0) {
        stuck++;
        flag(BAD, key, `主要动作「${label}」按两次都不动`, typeof err === "string" ? err.slice(0, 110) : "");
      } else {
        flag(BAD, key, `主要动作「${label}」要等三秒才按得动 —— 而画面上看不出来它还没准备好`);
      }
    } else ok(key, `「${label}」走到 ${new URL(page.url()).pathname}`);
  }
  if (stuck) flag(BAD, "主要动作", `${stuck} / ${T.pages.length} 页按不动`);
  else ok("主要动作", `${T.pages.length} 页全部按得动`);

  /* ── ③ 按「改设计」进编辑器 ───────────────────────────────────────────
     🔴 那颗按钮是凌晨那个改动的另一半。这一段问的是：**他找不找得到它，
     按下去到不到得了编辑器，回不回得来** —— 一条只走得进去的路，
     跟一颗按不动的按钮是同一件事的两张脸。 */
  head("③ 按「改设计」进编辑器 —— 找得到吗 · 进得去吗 · 回得来吗");
  const after = {};
  {
    await page.goto(`${BASE}/en/portal/${T.pages[0]}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(2200);
    const design = page
      .locator("a:visible, button:visible")
      .filter({ hasText: /change (the )?design|design|edit/i })
      .first();
    if (!(await design.count())) flag(BAD, "改设计", "找不到进编辑器那颗按钮");
    else {
      const label = ((await design.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      const url0 = page.url();
      await design.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      await shot(page, "editor");
      if (page.url() === url0) flag(BAD, "改设计", `「${label}」按下去网址不变`);
      else {
        ok("改设计", `「${label}」走到 ${new URL(page.url()).pathname + new URL(page.url()).search}`);
        const r = await readPage(page);
        after[T.pages[0]] = r;
        console.log(`  编辑器那一边：一屏 ${r.inFold} 个可按 · ${r.words} 个字`);
        const cjk = ((await seen(page)).match(/[一-鿿]/g) ?? []).length;
        if (cjk) flag(ODD, "编辑器", `英文系统里 ${cjk} 个中文字`);

        /* 回得来吗 —— 一条走得进去回不来的路，是他关掉分页的那一刻 */
        const back = page
          .locator("a:visible, button:visible")
          .filter({ hasText: /my system|back to|done|exit/i })
          .first();
        if (!(await back.count())) flag(BAD, "改设计", "编辑器里找不到回他的系统那颗");
        else {
          const bl = ((await back.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
          const u1 = page.url();
          await back.click({ timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(2500);
          if (page.url() === u1) flag(BAD, "改设计", `回去那颗「${bl}」按下去网址不变`);
          else ok("改设计", `「${bl}」回到 ${new URL(page.url()).pathname}`);
        }
      }
    }
  }

  /* ── ④ 两边差多少 ─────────────────────────────────────────────────── */
  head("④ 同一页：他的系统 / 编辑器");
  {
    const b = before[T.pages[0]], a = after[T.pages[0]];
    if (a)
      console.log(
        `  ${T.pages[0].padEnd(12)} 可按 ${String(b.inFold).padStart(3)} → ${String(a.inFold).padStart(3)}` +
        ` · 字 ${String(b.words).padStart(4)} → ${String(a.words).padStart(4)}`,
      );
    else console.log("  （进不去编辑器，量不到）");
  }

  /* ── ⑥ 开一张单：他要打几个字 ──────────────────────────────────────── */
  head("⑥ 开一张单 —— 他要打几个字（重点 29 那把尺）");
  {
    const { sec, timedOut } = await timeTo(page, `${BASE}/en/portal/${T.job}/new`);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(1200);
    const r = await readPage(page);
    await shot(page, "form");
    ok("那张表", `${sec.toFixed(1)}s 打开 · ${r.boxes} 个要打字的框 · ${r.required} 个必填 · ${r.assisted} 个给挑不用打`);
    if (r.nameless.length) flag(BAD, "那张表", `${r.nameless.length} 个框没有看得见的名字`, r.nameless.slice(0, 6).join(" · "));
    if (r.assisted === 0 && r.boxes > 3)
      flag(ODD, "那张表", `${r.boxes} 个框，一个都不给挑 —— 每一格都要他打字`);
    if (r.clipped.length) flag(ODD, "那张表", `${r.clipped.length} 句被切断`, r.clipped.slice(0, 3).join(" | "));

    /* 🔴 错误讯息：在哪里、讲什么 —— Baymard 那两条 */
    const save = page.locator("button:visible, [role=button]:visible").filter({ hasText: /^save|^confirm/i }).first();
    if (await save.count()) {
      await save.click().catch(() => {});
      await page.waitForTimeout(2200);
      await shot(page, "form-error");
      const err = await page.evaluate(() => {
        const hits = [...document.querySelectorAll("*")].filter((el) => {
          if (el.children.length) return false;
          const t = (el.innerText || "").trim();
          if (!t || t.length > 200) return false;
          return /cannot be blank|required|must |please |missing|invalid|too /i.test(t);
        });
        return hits.map((el) => {
          const r = el.getBoundingClientRect();
          /* 离它最近的那个输入框有多远 —— Baymard：错误要贴着出错那一格 */
          let near = 1e9, name = "";
          for (const inp of document.querySelectorAll("input,textarea,select")) {
            const ir = inp.getBoundingClientRect();
            if (ir.width < 1) continue;
            const d = Math.hypot(r.left - ir.left, r.top - ir.bottom);
            if (d < near) { near = d; name = inp.getAttribute("name") || inp.type; }
          }
          return { text: (el.innerText || "").replace(/\s+/g, " ").trim(), px: Math.round(near), near: name };
        });
      });
      if (!err.length) ok("那张表", "按了保存没有报错（多半是存下去了）");
      for (const e of err) {
        const far = e.px > 120;
        const blames = /cannot be blank|is required|invalid|too /i.test(e.text) && !/must be|at least|enter |use /i.test(e.text);
        flag(
          far || blames ? BAD : NIT,
          "错误讯息",
          `${far ? `离最近那一格 ${e.px}px` : `贴着 ${e.near}`}${blames ? " · 讲的是违规不是要求" : ""}`,
          e.text.slice(0, 120),
        );
      }
    } else flag(BAD, "那张表", "找不到保存");
  }

  /* ── ⑦ 键盘 ────────────────────────────────────────────────────────── */
  head("⑦ 键盘 —— 不用滑鼠走得到吗");
  {
    await page.goto(`${BASE}/en/portal/${T.pages[0]}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(1800);
    let blind = 0, steps = 0;
    for (let i = 0; i < 22; i++) {
      await page.keyboard.press("Tab");
      const s = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const st = getComputedStyle(el);
        const ring = st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0;
        const shadow = st.boxShadow && st.boxShadow !== "none";
        return { tag: el.tagName, seen: ring || shadow, t: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 22) };
      });
      if (!s) continue;
      steps++;
      if (!s.seen) blind++;
    }
    if (blind) flag(ODD, "键盘", `${steps} 个停靠点里 ${blind} 个看不出焦点在哪`);
    else ok("键盘", `${steps} 个停靠点，每一个都看得出焦点在哪`);
  }

  /* ── ⑧ 手机 390 ────────────────────────────────────────────────────── */
  head("⑧ 手机 390 —— 重点 24：验收要在这个宽度看");
  {
    const ph = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await ph.context().addCookies(await page.context().cookies());
    for (const key of [T.pages[0], T.job]) {
      const { sec, timedOut } = await timeTo(ph, `${BASE}/en/portal/${key}`);
      await ph.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      await ph.waitForTimeout(900);
      const r = await readPage(ph);
      await shot(ph, `phone-${key}`);
      console.log(`  ${key.padEnd(12)} ${sec.toFixed(1)}s · 一屏 ${r.inFold} 个可按 · ${r.words} 个字`);
      if (r.hSpill) flag(BAD, `手机 ${key}`, "画面横着溢出去了");
      /* 🔴 滚到最底，看底下那一条有没有盖住最后一段 */
      await ph.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await ph.waitForTimeout(700);
      const bottom = await readPage(ph);
      if (bottom.covered.length)
        flag(BAD, `手机 ${key}`, `滚到底，底下那一条盖住 ${bottom.covered.length} 段字`, bottom.covered.slice(0, 2).join(" | "));
      if (r.placeholders.length)
        flag(ODD, `手机 ${key}`, "示例资料用的是我们的词", r.placeholders.slice(0, 3).join(" · "));
      if (r.small.length)
        flag(ODD, `手机 ${key}`, `${r.small.length} 个拇指按不稳（<44px）`,
          r.small.slice(0, 4).map((x) => `${x.t} ${x.w}×${x.h}`).join(" · "));
      if (r.clipped.length) flag(ODD, `手机 ${key}`, `${r.clipped.length} 句被切断`, r.clipped.slice(0, 3).join(" | "));
    }
    await ph.close();
  }

  /* ── ⑨ 同一件事几种叫法 ────────────────────────────────────────────── */
  head("⑨ 同一件事，几种叫法");
  for (const [k, set] of Object.entries(words)) {
    if (set.size > 1) flag(ODD, "叫法", `${k}：${set.size} 种`, [...set].join(" · "));
    else if (set.size === 1) ok("叫法", `${k}：一种（${[...set][0]}）`);
  }

  head("⑩ 每一页的大标题");
  for (const t of titles) console.log(`  ${t.page.padEnd(12)} ${t.when}  ${t.h1}`);
  const afterTitles = titles.filter((t) => t.when === "保存后").map((t) => t.h1);
  if (new Set(afterTitles).size < afterTitles.length)
    flag(ODD, "大标题", "有两页顶着同一个大标题", [...new Set(afterTitles)].join(" · "));

  /* ── 判 ────────────────────────────────────────────────────────────── */
  const n = (l) => found.filter((f) => f.level === l).length;
  console.log(`\n判 · ${TRADE}：红 ${n(BAD)} · 黄 ${n(ODD)} · 灰 ${n(NIT)}`);
  fs.writeFileSync(
    `${OUT}/found.json`,
    JSON.stringify({ trade: TRADE, at: new Date().toISOString(), before, after, found, titles }, null, 2),
  );
  console.log(`读数写在 ${OUT}/found.json，图在同一个资料夹`);
} finally {
  await browser?.close().catch(() => {});
  if (userId) await dropThrowaway(admin, userId);
}

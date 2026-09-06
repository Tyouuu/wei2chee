/**
 * 他的客人那一边 —— **而这一边从来没有人在浏览器里走过。**
 *
 *   npm run walk:stranger
 *
 * 老板 2026-09-07：`还有什么能排查的吗` → `去排查吧`
 *
 * ── 为什么是这一支（量出来的，不是感觉）─────────────────────────────────
 *
 * 陌生人打得开三条路：
 *   /s/<网址名>   他的官网
 *   /r/<号码>     他客人自己那一张单（看 · 按同意 · 我要改一点 · 签收）
 *   /p/<号码>     经销商自己那一页（看 · 提交一笔）
 *
 * 而 2026-09-07 早上数过：
 *
 *   问的是什么                     老板  师傅  **他客人**
 *   走不走得通（按了有反应吗）      ✅    ❌    🔴 没有
 *   顺不顺（等多久 · 打几个字）      ✅    ❌    🔴 没有
 *   看不看得见（对比 · 按得准）      ✅    ❌    🔴 没有
 *   做错了会怎样                    ✅    ❌    🔴 没有
 *   画面上的金额资料库答不答得出来   ✅    ✅    🔴 没有
 *
 * **五支开浏览器的走查，五支全部是登入之后走后台。**
 * 碰过那三页的只有两支，而且各只问一个问题：
 * `check:anchors`（连结有没有落点）· `check:site-identity`（印的是不是这家公司）。
 * **点不点得到 · 有没有中文 · 对比度 —— 四把尺一支都没走过那一边。**
 *
 * ── 🔴 而那一边正好是护城河本身 ──────────────────────────────────────────
 *
 * [重点 9c] 那张「换掉要付什么」的表，最深两层全部长在那三页上：
 * **钱经过我们** · **他的客人手上有一条连结**。
 * 底下第三第四层（资料 · 功能好用）他自己写着「换一家一样好用的就没了」。
 *
 * 换句话说：**我们量得最细的那一边，是最容易被取代的那一边；
 * 而拔不走的那一边，一次都没有量过。**
 *
 * ── 每一站问同样四句 ──────────────────────────────────────────────────
 *
 *   ① 按得动吗      往每一个可按的东西正中央打一枪，回来的是不是它自己
 *   ② 看得见吗      字 4.5:1（1.4.3）· 他要打字的框的边 3:1（1.4.11）· 按得准 24（2.5.8）
 *   ③ 讲得清楚吗    每个框有没有名字 · 有没有指不到的连结 · 系统讲英文而画面印中文
 *   ④ 出错他知道吗  空的送出去 —— 那句话贴不贴着那一格 · 讲要求还是讲违规
 *
 * ── 🔴 只走 390，而这是一个判断不是省事 ──────────────────────────────────
 *
 * [重点 24]：判这一页的不是我们，是**那个陌生人，而他在手机上**。
 * [任务 26] 实测 19 家马来西亚同行，**15 家第一屏就给 WhatsApp**，
 * 就是因为客人是从一条连结来的、在手机上。
 * 后台那几页老板天天开，这三页**每一个人只开一次** —— 而那一次在手机上。
 * ⚠️ 电脑那一边也走一次，但只印读数不判（最后一段）。
 *
 * ── 三条自己的规矩 ──────────────────────────────────────────────────────
 *
 *  1. 🔴 **走的那个浏览器从头到尾没有登入过。** 种资料用另一个上下文，
 *     种完关掉。一个带着登入 cookie 走陌生人页面的走查，量的是它自己
 *  2. **它自己开用完就删的帐号**，不碰示范帐号
 *  3. **只有那几条有外部门槛的才判**（4.5 · 3 · 24 · 打不打得动 · 横不横滚），
 *     其余只印读数 —— 一条我发明的门槛，会让这份读数从第一天起就在替他做决定
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const OUT = ".screenshots/walk-stranger";
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const newApi = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const users = [];
dropThrowawayOnExit(admin, () => users);

const found = [];
const flag = (where, what, ev = "") => {
  found.push({ where, what, ev });
  console.log(`  [RED] ${where.padEnd(14)} ${what}${ev ? `\n         ${ev}` : ""}`);
};
const soft = (where, what, ev = "") => console.log(`  [!]   ${where.padEnd(14)} ${what}${ev ? `\n         ${ev}` : ""}`);
const ok = (where, what) => console.log(`  ok    ${where.padEnd(14)} ${what}`);
const num = (where, what) => console.log(`  .     ${where.padEnd(14)} ${what}`);
const head = (t) => console.log(`\n${t}`);

/* ═══════════════════════════════════════════════════════════════════════
   在浏览器里跑的那一份。

   🔴 颜色的算术让浏览器自己做 —— `check-contrast.mjs` 的档头写着为什么：
   第一版用正则解析 rgba(...)，而 Tailwind v4 的透明度会算成 oklab(...)，
   於是它对九十二个好好的元素报错。canvas 认得每一种写法。
   ═══════════════════════════════════════════════════════════════════════ */
const AUDIT = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (s) => {
    if (!s || s === "transparent" || s === "none") return { r: 0, g: 0, b: 0, a: 0 };
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.globalCompositeOperation = "copy";
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const over = (fg, bg) =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };

  /* 往上找到第一个真的有底色的祖先。一个透明的框叠在一个透明的卡上，
     真正的地在更上面 —— 只问它自己，会把每一样东西都当成压在白纸上。 */
  const groundOf = (el) => {
    let n = el;
    let acc = null;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.a > 0) acc = acc ? over(acc, c) : c;
      if (acc && acc.a >= 1) return acc;
      n = n.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    if (body.a > 0) return acc ? over(acc, body) : body;
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };

  const out = { text: [], boxes: [], taps: [], unnamed: [], dead: [], cjk: [], sideways: 0, controls: 0, words: 0 };

  /* ── ① 字 4.5:1（WCAG 1.4.3）。只看真的自己带字的那一层 ——
        不然一个包着整页的容器会被当成一段字。 */
  for (const el of document.querySelectorAll("body *")) {
    if (!seen(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    const g = groundOf(el);
    const rt = ratio(over(parse(s.color), g), g);
    const px = parseFloat(s.fontSize) || 16;
    const big = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const need = big ? 3 : 4.5;
    if (rt < need) out.text.push({ t: el.textContent.trim().slice(0, 46), rt: +rt.toFixed(2), need, px: Math.round(px) });
  }

  /* ── ② 他要打字／要挑的框，边 3:1（WCAG 1.4.11）
        老花眼看不见的第一样是边框，那跟字是两条。 */
  for (const el of document.querySelectorAll("input, textarea, select")) {
    if (!seen(el)) continue;
    if (["hidden", "submit", "button"].includes(el.type)) continue;
    const s = getComputedStyle(el);
    const g = groundOf(el.parentElement || el);
    let best = 0;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(s["border" + side + "Width"]) < 0.5) continue;
      best = Math.max(best, ratio(over(parse(s["border" + side + "Color"]), g), g));
    }
    /* 没有边的时候，它自己的底跟外面的地也算 —— 一个填色的框照样看得出边界。 */
    const own = parse(s.backgroundColor);
    if (own.a > 0) best = Math.max(best, ratio(over(own, g), g));
    const label =
      el.labels?.[0]?.textContent?.trim() ||
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      el.getAttribute("placeholder") ||
      el.type;
    if (best < 3) out.boxes.push({ label: String(label).slice(0, 34), rt: +best.toFixed(2) });

    /* ── ③ 每一个框有没有名字。只有提示字不算：一打字它就不见了。 */
    const named =
      (el.labels && el.labels.length > 0) ||
      !!el.getAttribute("aria-label") ||
      !!el.getAttribute("aria-labelledby") ||
      !!el.closest("label");
    if (!named) out.unnamed.push({ ph: String(el.getAttribute("placeholder") || el.type).slice(0, 34) });
  }

  /* ── ④ 按得准（WCAG 2.5.8 是 24×24，Apple 要 44）。
        ⚠️ 2.5.8 的例外是**圆心距**不是缝：一颗 20×20 的按钮
        旁边只要 2px 的空地就够。`walk:eyesight` 第一版写成
        「缝 < 24 就没过」，那把门槛拉高了一倍。 */
  const clickable = [...document.querySelectorAll("a[href], button, input, textarea, select, [role=button]")].filter(seen);
  out.controls = clickable.length;
  const rects = clickable.map((el) => el.getBoundingClientRect());
  clickable.forEach((el, i) => {
    const r = rects[i];
    if (r.width >= 24 && r.height >= 24) return;
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    let near = Infinity;
    rects.forEach((o, j) => {
      if (i === j) return;
      near = Math.min(near, Math.hypot(o.x + o.width / 2 - cx, o.y + o.height / 2 - cy));
    });
    if (near < 24) {
      out.taps.push({
        t: String(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30),
        w: Math.round(r.width),
        h: Math.round(r.height),
        near: Math.round(near),
      });
    }
  });

  /* ── ⑤ 指不到的连结。一颗按下去什么都不会发生的东西，
        是这个仓库禁的第一条。 */
  for (const a of document.querySelectorAll("a[href]")) {
    if (!seen(a)) continue;
    const h = a.getAttribute("href");
    if (h === "#" || h === "" || h === "javascript:void(0)") {
      out.dead.push({ t: a.innerText.trim().slice(0, 34), h });
      continue;
    }
    if (h.startsWith("#")) {
      const id = h.slice(1);
      if (!document.getElementById(id) && !document.querySelector('[name="' + id + '"]')) {
        out.dead.push({ t: a.innerText.trim().slice(0, 34), h });
      }
    }
  }

  /* ── ⑥ 一个讲英文的系统上印中文。[重点 22d]：
        做展示用的资料要跟着那个系统自己的语言走。 */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim();
    if (!t) continue;
    const p = n.parentElement;
    /* ⚠️ 只数**看得见**的字。第一版把藏起来的一起数，於是一张
       390 宽的页报「29425 个字」—— 一个没有人读得完的数字，
       而它读起来像那一页塞满了东西。 */
    if (!p || !seen(p)) continue;
    out.words += t.length;
    if (!/[一-鿿]/.test(t)) continue;
    out.cjk.push(t.slice(0, 40));
  }

  out.sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
};

/** 往每一个可按的东西正中央打一枪 —— 回来的不是它自己，就是被盖住了。 */
const HITTEST = () => {
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width >= 1 && r.height >= 1 && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
  };
  const out = [];
  for (const el of document.querySelectorAll("a[href], button, [role=button], input[type=submit]")) {
    if (!seen(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.y + r.height < 0 || r.y > innerHeight) continue; /* 卷出画面的不算 */
    const cy = Math.max(1, Math.min(innerHeight - 1, r.y + r.height / 2));
    const hit = document.elementFromPoint(r.x + r.width / 2, cy);
    if (!hit) continue;
    if (hit === el || el.contains(hit) || hit.contains(el)) continue;
    const cls = hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : "";
    out.push({
      t: String(el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 34),
      by: (hit.tagName + cls).slice(0, 40),
    });
  }
  return out;
};

/** 一站四句。 */
async function askFour(page, where, { form = false } = {}) {
  const a = await page.evaluate(AUDIT);
  const blocked = await page.evaluate(HITTEST);

  num(where, `${a.controls} 个可按 · ${a.words} 个字`);

  if (blocked.length)
    flag(where, `${blocked.length} 个按不动（被别的东西盖住）`, blocked.map((b) => `「${b.t}」← ${b.by}`).join(" · "));
  else ok(where, "每一个可按的都打得到自己");

  if (a.sideways > 2) flag(where, `手机上要横着滑 ${a.sideways}px`);
  else ok(where, "不横滚");

  if (a.text.length)
    flag(
      where,
      `${a.text.length} 段字看不清`,
      a.text.slice(0, 4).map((x) => `${x.rt}:1（要 ${x.need}）${x.px}px「${x.t}」`).join(" · "),
    );
  else ok(where, "每一段字都读得到");

  if (a.dead.length)
    flag(where, `${a.dead.length} 条连结指不到东西`, a.dead.slice(0, 4).map((x) => `「${x.t}」→ ${x.h}`).join(" · "));
  else ok(where, "没有指不到的连结");

  if (a.cjk.length)
    flag(where, `英文系统上印了 ${a.cjk.length} 处中文`, a.cjk.slice(0, 4).map((x) => `「${x}」`).join(" · "));

  if (form) {
    if (a.boxes.length)
      flag(where, `${a.boxes.length} 个框的边看不见`, a.boxes.slice(0, 5).map((x) => `${x.rt}:1「${x.label}」`).join(" · "));
    else ok(where, "他要打字的框都看得见边");

    if (a.unnamed.length)
      flag(
        where,
        `${a.unnamed.length} 个框没有名字（只有提示字，一打就不见）`,
        a.unnamed.slice(0, 4).map((x) => `「${x.ph}」`).join(" · "),
      );
    else ok(where, "每个框都有名字");
  }

  if (a.taps.length)
    soft(where, `${a.taps.length} 个太小而且旁边没空地`, a.taps.slice(0, 4).map((x) => `${x.w}x${x.h}「${x.t}」`).join(" · "));

  return a;
}

/**
 * ④ 空的送出去 —— 他知道发生什么吗。
 *
 * Baymard（做过真人测试）：错误要**贴着出错那一格**，而且**讲要求不讲违规**
 * （「密码至少 8 个字」赢过「密码太短」）。
 * 所以量两件：那句话离最近那个框多远 · 它有没有讲要怎么做。
 */
async function askWhenWrong(page, where, submitName) {
  const btn = page.getByRole("button", { name: submitName }).first();
  if (!(await btn.count())) {
    soft(where, `找不到那颗送出的按钮（${submitName}）—— 这一段跳过`);
    return;
  }

  /* 🔴 第一版没有想到这一种，而它正是画面真的在做的事：
     那颗按钮是**灰的**。挡住一次错的送出是对的 ——
     而一颗按不动、旁边又没有讲为什么的按钮，他站在那里不知道少了什么。
     所以这一题的答案有三种，不是两种。 */
  if (await btn.isDisabled().catch(() => false)) {
    const why = await page.evaluate(() => {
      const el = [...document.querySelectorAll("[aria-live], [role=status], [role=alert]")]
        .map((n) => n.innerText.trim())
        .filter(Boolean);
      return el.join(" · ").slice(0, 100);
    });
    if (why) ok(where, `空的送不出去（按钮是灰的），而且讲了为什么：「${why}」`);
    else soft(where, "空的送不出去（按钮是灰的）—— 挡住了，而画面上没有讲少了什么");
    return;
  }

  const before = page.url();
  await btn.click({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1800);

  const r = await page.evaluate(() => {
    const seen = (el) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width >= 1 && b.height >= 1 && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
    };
    /* 浏览器自己那一颗气泡（required）也算讲了话 —— 而它贴着那一格，
       所以它是这一题的满分答案，不是缺陷。 */
    const native = [...document.querySelectorAll("input, textarea, select")].filter(
      (el) => seen(el) && el.willValidate && !el.checkValidity(),
    );
    if (native.length) return { kind: "native", near: 0, msg: native[0].validationMessage.slice(0, 60) };

    const fields = [...document.querySelectorAll("input, textarea, select")].filter(seen);
    /* 🔴 一个栏位的**名字**不是一句错误讯息。第一版的正则在
       「What do you need?」上中了 need，於是它对着一张
       什么错都没报的表单回报「它讲了话」。**红的是尺。** */
    const labels = new Set([...document.querySelectorAll("label")]);
    let best = null;
    for (const el of document.querySelectorAll("body *")) {
      if (!seen(el)) continue;
      if (labels.has(el) || el.closest("label")) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3);
      if (!own) continue;
      const t = el.textContent.trim();
      if (t.length > 160) continue;
      if (!/requir|cannot be|must |need|missing|invalid|empty|please|不能|必填|请|要填/i.test(t)) continue;
      const r1 = el.getBoundingClientRect();
      let near = Infinity;
      for (const f of fields) {
        const r2 = f.getBoundingClientRect();
        near = Math.min(near, Math.abs(r1.y - r2.y));
      }
      if (!best || near < best.near) best = { kind: "text", near: Math.round(near), msg: t.slice(0, 80) };
    }
    return best;
  });

  if (!r) {
    if (page.url() !== before) flag(where, "空的送出去，它照样收了 —— 画面直接换页，一个字都没讲");
    else flag(where, "空的送出去，画面上一句话都没有 —— 他不知道发生什么");
    return;
  }
  if (r.kind === "native") {
    ok(where, `空的送出去挡下来了，而且那句话贴着那一格：「${r.msg}」`);
    return;
  }
  const tellsHow = /at least|需要|要填|必填|请填|enter|choose|pick|add |必须/i.test(r.msg);
  if (r.near > 120) flag(where, `那句话离最近那个框 ${r.near}px`, `「${r.msg}」`);
  else ok(where, `讲了，而且离那一格 ${r.near}px：「${r.msg}」`);
  if (!tellsHow) soft(where, "那句话讲的是「哪里错了」，不是「要怎么填」（Baymard）", `「${r.msg}」`);
}

/** 开一个用完就删的老板，给他几页跟一个网址名。 */
async function makeOwner(kind, pages, slug, tradeSlug, style) {
  const stamp = Date.now();
  const email = `stranger-${kind}-${stamp}@formae.test`;
  const password = `Stranger-${stamp}-x!`;
  const api = newApi();

  /* 🔴 行业不在 `projects` 上，在**问卷**上：
     `accounts.lead_id -> leads.industry_id`。`shoot-booking` 的档头记着这一条 ——
     去更新一个不存在的 `projects.trade_slug`，PostgREST 静静地什么都没做，
     而报出来是「官网上没有那一块」。
     **道具没摆好跟产品坏了，在报告里长得一模一样。** */
  const { data: ind } = await admin.from("industries").select("id").eq("slug", tradeSlug).single();
  if (!ind?.id) throw new Error(`industries 里没有 ${tradeSlug}`);
  const { data: lead, error: le } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "stranger walk" } })
    .select("id")
    .single();
  if (le) throw new Error(`lead: ${le.message}`);

  const { data: made, error: ce } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { lead_id: lead.id },
  });
  if (ce) throw new Error(`createUser: ${ce.message}`);
  users.push(made.user.id);

  const { error: se } = await api.auth.signInWithPassword({ email, password });
  if (se) throw new Error(`signIn: ${se.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");

  /* 🔴 道具要像一家真的店（[重点 22d]）。少了公司名，那三页会印
     SQL 里那句后备 `'this business'` —— 而一张写着「this business」的图，
     他一看就问「怎么怪怪的」，然后我要花一轮解释那是道具不是产品。 */
  await admin.from("projects").update({ company_name: "Hin Fatt Renovation" }).eq("id", proj.id);
  await api.rpc("set_project_style", { new_style: style });
  /* 🔴 参数名照**最后一次定义它的那个档案**（20260906340000），不照记忆 ——
     这个仓库为猜名字红过九次，而 `shoot-booking` 里那一句
     `{ new_page_key: key }` 是旧签名，今天已经对不上。 */
  for (const key of pages) await api.rpc("add_project_page", { requested_key: key, new_title: null });
  await api.rpc("set_my_site_slug", { new_slug: slug });
  return { api, email, password, slug, projectId: proj.id };
}

let browser;
let exitCode = 0;
try {
  /* ── 🔴 开跑之前先探一次服务器 ────────────────────────────────────────
     [任务 260] 那一趟整个失败，而失败的样子是假的：两个框是空的、
     一个错误讯息都没有、按钮回到「Log in」—— 看起来完全像产品坏了，
     而真相是 dev server 中途死了。 */
  const probe = await fetch(BASE, { method: "GET" }).catch(() => null);
  if (!probe) {
    console.error(`\n🔴 ${BASE} 连不上 —— 先 npm run dev。\n   （不猜：一份「每一页都坏了」的报告，跟一份「服务器没开」的报告长得一模一样。）`);
    process.exitCode = 2;
    process.exit(2);
  }

  const stamp = Date.now().toString().slice(-7);
  const renoSlug = `reno-${stamp}`;

  console.log(`\n他的客人那一边 —— 390 宽，没有登入过\n${"─".repeat(66)}`);

  /* ── 台面 ────────────────────────────────────────────────────────────
     一家装修公司：一张开给屋主的报价单（有逐项、有分期）、一个供应商。 */
  const boss = await makeOwner("reno", ["customers", "quotations", "projects", "payments", "website"], renoSlug, "renovation", "blueprint");

  /* 🔴 每一句道具的写入当场看错误 —— [任务 259] 付过学费：
     一句不看错误的写入，跟一句没有写过的写入，在报告里长得一模一样，
     而底下每一条红都会看起来像产品坏了。 */
  const must = (label, { data, error }) => {
    if (error) throw new Error(`道具没摆好 · ${label}：${error.message}`);
    return data;
  };

  const P = boss.projectId;
  const homeowner = must(
    "建屋主",
    await boss.api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "customers",
      in_name: "Puan Aminah",
      in_phone: "012-345 6789",
    }),
  );
  const supplier = must(
    "建供应商",
    await boss.api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "suppliers",
      in_name: "Chin Hin Cement",
      in_phone: "016-777 1234",
    }),
  );

  /* ⚠️ 这两支回的是**一整行**，不是一个编号 —— 读原文才知道
     （`returns public.pipeline_records`）。 */
  const quote = must(
    "开那张报价单",
    await boss.api.rpc("add_pipeline_record", {
      in_project_id: P,
      in_module_key: "quotations",
      in_party: "Puan Aminah",
      in_party_id: homeowner?.id ?? null,
      in_title: "Kitchen refit, Taman Ipoh Jaya",
      in_amount_cents: 4850000,
    }),
  );
  const quoteId = quote?.id;
  if (!quoteId) throw new Error("道具没摆好 · 那张单没有编号");

  await boss.api.rpc("set_record_lines", {
    in_record_id: quoteId,
    in_lines: [
      { description: "Hack and dispose old cabinets", qty: 1, unit: "job", unit_price_cents: 320000 },
      { description: "Solid surface top", qty: 3.2, unit: "m", unit_price_cents: 78000 },
      { description: "Plywood carcass, laminate finish", qty: 1, unit: "set", unit_price_cents: 2180000 },
    ],
  });
  await boss.api.rpc("set_record_terms", {
    in_record_id: quoteId,
    in_terms: [
      { description: "Deposit on signing", portion: 30 },
      { description: "On start of work", portion: 40 },
      { description: "On completion", portion: 30 },
    ],
  });

  /* `share_record` 回一整行（`.share_ref`）· `open_party_portal` 回一个 uuid ——
     两支的形状不一样，而两支都读过原文了。 */
  const share = must("开那张单的连结", await boss.api.rpc("share_record", { in_record_id: quoteId }));
  const shareRef = share?.share_ref;
  const portalRef = must("开经销商那条连结", await boss.api.rpc("open_party_portal", { in_party_id: supplier?.id }));

  if (!shareRef) throw new Error("道具没摆好 · share_record 没有回门牌");
  if (!portalRef) throw new Error("道具没摆好 · open_party_portal 没有回门牌");

  browser = await chromium.launch();

  /* ── 把官网上线 ───────────────────────────────────────────────────────
     `set_my_site_published` 要求那一页**存过** —— 一个从来没有被保存过的
     官网上线之后是一张空页，所以那道守卫是对的。存的方法只有一个：
     用真的浏览器按一次「保存设计」。
     ⚠️ 这一段用**另一个上下文**，用完关掉 —— 走陌生人那一边的那个
     浏览器从头到尾不可以有登入 cookie。 */
  const seedCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const desk = await seedCtx.newPage();

  /* 🔴 登不进去的时候把三种分开讲 —— [任务 260] 那一趟卡在登入五分钟，
     图上两个框是空的、一个错误讯息都没有，**看起来完全像产品坏了**，
     而真相是 dev server 中途死了。[任务 257] 又记了第二种（限流被讲成
     「密码不对」）跟第三种（落点太重，本机第一次编译要几分钟）。

     ⚠️ 而这一次自己踩到第四种：`domcontentloaded` 之后**马上**填字按钮，
     那一刻还没接上事件 —— 按下去是一次原生的表单送出，页面自己重载，
     於是 log 上是「navigated to /en/login」三次。用 networkidle，
     而且等那颗按钮真的按得动。 */
  await desk.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  const submit = desk.locator('button[type="submit"]').first();
  await submit.waitFor({ state: "visible", timeout: 60000 });
  await desk.fill('input[type="email"]', boss.email);
  await desk.fill('input[type="password"]', boss.password);
  await submit.click();
  try {
    await desk.waitForURL(/portal/, { timeout: 180000 });
  } catch {
    const alive = await fetch(BASE).then((r) => r.ok || r.status < 500).catch(() => false);
    const said = (await desk.evaluate(() => document.body.innerText)).trim();
    await desk.screenshot({ path: `${OUT}/0-login-stuck.png` }).catch(() => {});
    if (!alive) throw new Error("登不进去 —— **服务器不在了**（不是产品坏了）");
    if (/incorrect|invalid|wrong|不正确|错误|try again/i.test(said))
      throw new Error(`登不进去 —— 画面上真的有一句错误讯息：「${said.slice(0, 120)}」`);
    throw new Error(
      `登不进去 —— 服务器活着、画面上一句错误讯息都没有（${said.length} 个字）。` +
        `多半是这一页还在编译，或者撞到限流。图在 ${OUT}/0-login-stuck.png`,
    );
  }
  await desk.goto(`${BASE}/en/portal/website?design=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await desk.waitForTimeout(4000);
  const more = desk.locator("summary", { hasText: /^More/ }).first();
  if (await more.count()) {
    await more.click({ timeout: 30000 }).catch(() => {});
    await desk.waitForTimeout(400);
  }
  await desk.getByRole("button", { name: /save design/i }).first().click({ timeout: 60000 }).catch(() => {});
  await desk.waitForTimeout(4500);
  const { data: pubWord } = await boss.api.rpc("set_my_site_published", { publish: true });
  await seedCtx.close();
  if (pubWord !== "ok") {
    console.error(`\n🔴 官网上不了线（${String(pubWord)}）—— 道具没摆好，不是产品坏了。停。`);
    process.exitCode = 2;
    throw new Error("seed failed");
  }

  /* ═════════════════════════════════════════════════════════════════════
     从这里开始，那个浏览器没有登入过。
     ⚠️ `reducedMotion: "reduce"` —— 不然滚动进场会停在半路，
     而那张图看起来像我们的对比度坏掉了（[任务 28] 撞过 · [任务 80] 修过）。
     ═════════════════════════════════════════════════════════════════════ */
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  /* 🔴 藏掉我们自己的家具。`next dev` 那颗浮标只存在于开发机上，
     **客户永远看不到它** —— 而它会被算进「几个可按的」，还会印在图上。
     [任务 80] 记过同一件：`check:reachable` 把它算成「遮住控件的东西」，
     而**一把每次跑都喊一次狼的尺没有人看**。 */
  await ctx.addInitScript(() => {
    const css = "nextjs-portal,#__next-build-watcher,[data-nextjs-toast]{display:none!important}";
    const put = () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head?.appendChild(s);
    };
    if (document.head) put();
    else document.addEventListener("DOMContentLoaded", put);
  });

  const page = await ctx.newPage();
  const open = async (url, name) => {
    const t0 = Date.now();
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 }).catch(() => null);
    /* 本机第一次开一条路要编译，而编译中的那一张图跟一张坏掉的图长得一样。
       等它真的安定（`networkidle` 之后再给进场动画一点时间）。 */
    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {});
    return { status: res?.status() ?? 0, ms: Date.now() - t0 };
  };

  /* ── ① 他的官网 ──────────────────────────────────────────────────── */
  head(`① 他的官网  /s/${renoSlug}`);
  const s1 = await open(`${BASE}/s/${renoSlug}`, "1-site");
  if (s1.status >= 400) {
    flag("官网", `打不开 —— ${s1.status}`);
  } else {
    num("官网", `开了 ${(s1.ms / 1000).toFixed(1)} 秒`);
    await askFour(page, "官网", { form: true });
    /* 询价那一块。[任务 197] 修过那几条锚点，所以它的落点是 website-form。 */
    const hasForm = await page.locator("#website-form, #website-booking").count();
    if (!hasForm) soft("官网", "这一套风格的官网上没有询价／订时段那一块（可能是 dropBlocks，不一定是缺陷）");
    else {
      await page.locator("#website-form, #website-booking").first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/1b-site-form.png` }).catch(() => {});
      await askWhenWrong(page, "官网", /send|ask|request|submit|book/i);
    }
  }

  /* ── ② 他客人自己那一张单 ───────────────────────────────────────── */
  head(`② 屋主打开自己那张单  /r/${shareRef}`);
  const s2 = await open(`${BASE}/r/${shareRef}`, "2-record");
  if (s2.status >= 400) {
    flag("那张单", `打不开 —— ${s2.status}`);
  } else {
    num("那张单", `开了 ${(s2.ms / 1000).toFixed(1)} 秒`);
    const a2 = await askFour(page, "那张单", { form: true });

    /* 🔴 漏不漏比好不好看重要。逐项的注解绝不可以出现在客人眼前 ——
       20260905240000 故意把它漏出去看那条守卫红过一次。 */
    const body = await page.evaluate(() => document.body.innerText);
    if (/进价|cost price|our cost/i.test(body)) flag("那张单", "🔴 逐项的注解漏到客人眼前了");
    else ok("那张单", "没有漏成本／注解");
    if (body.includes(quoteId)) flag("那张单", "🔴 那一行的编号印在客人看得到的地方");
    else ok("那张单", "一个编号都没有印出来");

    /* 他真正会按的两颗。 */
    const agree = page.getByRole("button", { name: /agree|accept|同意/i }).first();
    const ask = page.getByRole("button", { name: /change|adjust|question|改/i }).first();
    if (await agree.count()) ok("那张单", "「同意」那一颗在");
    else flag("那张单", "🔴 没有「同意」那一颗 —— 这一页存在的理由就是它");
    if (await ask.count()) ok("那张单", "「我要改一点」那一颗在");
    else soft("那张单", "没有「我要改一点」那一颗");

    /* ── 画面上那个总额，资料库答不答得出来。
       ⚠️ **第一版红的是我的期望**：我拿开单时打的 RM 48,500 去比，
       而 `set_record_lines` **会把逐项的合计写回那一行**（[任务 139] 记过）——
       所以那张单的总额从那一刻起就是逐项加起来的那个数。
       现在去问资料库要那一行现在的金额，不写死一个我记得的数字。 */
    const { data: nowRow } = await boss.api
      .from("pipeline_records").select("amount_cents").eq("id", quoteId).maybeSingle();
    const want = nowRow?.amount_cents;
    const money = (await page.evaluate(() => document.body.innerText)).match(/RM\s?[\d,]+(?:\.\d{2})?/g) || [];
    const cents = money.map((m) => Math.round(parseFloat(m.replace(/[^\d.]/g, "")) * 100));
    num("那张单", `画面上 ${money.length} 个金额 · 资料库说这一张是 ${(want / 100).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
    if (want == null) soft("那张单", "问不到资料库那一行现在多少 —— 这一条跳过");
    else if (cents.includes(want)) ok("那张单", "总额印出来了，而且跟资料库一分不差");
    else flag("那张单", "🔴 画面上找不到资料库说的那个总额", `资料库 ${want} · 画面上 ${cents.join(" / ")}`);
    void a2;
  }

  /* ── ③ 经销商自己那一页 ─────────────────────────────────────────── */
  head(`③ 经销商自己那一页  /p/${portalRef}`);
  const s3 = await open(`${BASE}/p/${portalRef}`, "3-portal");
  if (s3.status >= 400) {
    flag("经销商", `打不开 —— ${s3.status}`);
  } else {
    num("经销商", `开了 ${(s3.ms / 1000).toFixed(1)} 秒`);
    await askFour(page, "经销商", { form: true });

    /* 🔴 那一页故意看不到两样：他欠多少 · 别人的单。 */
    const body = await page.evaluate(() => document.body.innerText);
    if (/owe|outstanding|balance|欠/i.test(body)) flag("经销商", "🔴 那一页讲到了欠款 —— 那条连结动得了钱就是另一个爆炸半径");
    else ok("经销商", "没有讲到他欠多少");
    if (/Puan Aminah/i.test(body)) flag("经销商", "🔴 别人的客户名字漏到这一页上了");
    else ok("经销商", "看不到别人的东西");

    await askWhenWrong(page, "经销商", /send|submit|ask|request|提交/i);
  }

  /* ── ④ 门牌打错了 ───────────────────────────────────────────────── */
  head("④ 他把连结打错了 —— 看到的是人话还是一片白");
  for (const [label, url] of [
    ["官网", `${BASE}/s/nope-${stamp}`],
    ["那张单", `${BASE}/r/00000000-0000-0000-0000-000000000000`],
    ["经销商", `${BASE}/p/00000000-0000-0000-0000-000000000000`],
  ]) {
    const r = await open(url, `4-${label}`);
    const txt = (await page.evaluate(() => document.body.innerText)).trim();
    /* 🔴 判的是**他看到什么**，不是回码。
       实测 `/r/` 跟 `/p/` 回 200 而画面写着
       「This link is not in use. / Ask them to send you a new one.」——
       那是这一题的满分答案，而第一版照回码把它报成了黄的。
       两页都是 noindex，所以 200 也不会被搜寻引擎收走。 */
    const helps = /not in use|no longer|expired|ask them|send you a new|not found|找不到|失效|重新/i.test(txt);
    if (r.status >= 500) flag(`打错-${label}`, `${r.status} —— 一个打错的连结不该是伺服器错`);
    else if (helps) ok(`打错-${label}`, `${r.status}，而且讲了人话跟出路：「${txt.split("\n").slice(0, 2).join(" / ").slice(0, 60)}」`);
    else if (txt.length < 20) flag(`打错-${label}`, `${r.status}，画面上只有 ${txt.length} 个字 —— 他不知道该怎么办`);
    else soft(`打错-${label}`, `${r.status} · 讲了 ${txt.length} 个字，而没有讲出路`, `「${txt.slice(0, 60)}」`);
  }

  /* ── ⑤ 电脑那一边，只印读数不判 ─────────────────────────────────── */
  head("⑤ 电脑那一边（只印读数）");
  const wide = await ctx.newPage();
  for (const [label, url] of [
    ["官网", `${BASE}/s/${renoSlug}`],
    ["那张单", `${BASE}/r/${shareRef}`],
    ["经销商", `${BASE}/p/${portalRef}`],
  ]) {
    await wide.setViewportSize({ width: 1440, height: 950 });
    await wide.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 }).catch(() => {});
    await wide.waitForTimeout(1800);
    await wide.screenshot({ path: `${OUT}/5-wide-${label}.png` }).catch(() => {});
    const a = await wide.evaluate(AUDIT);
    const b = await wide.evaluate(HITTEST);
    num(`电脑-${label}`, `${a.controls} 个可按 · ${a.words} 个字 · 字看不清 ${a.text.length} · 按不动 ${b.length} · 横滚 ${a.sideways}`);
  }
  await wide.close();

  head("─".repeat(66));
  if (found.length === 0) {
    console.log(`他客人那一边走完了 —— ${found.length} 条红。图在 ${OUT}/`);
  } else {
    console.log(`🔴 ${found.length} 条红。图在 ${OUT}/\n`);
    found.forEach((f, i) => console.log(`  ${i + 1}. [${f.where}] ${f.what}`));
    exitCode = 1;
  }
} catch (e) {
  console.error(`\n🔴 走到一半停了：${e.message}`);
  exitCode = exitCode || 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  const stuck = await dropThrowaways(admin, users);
  if (stuck.length) console.error(`⚠️  ${stuck.length} 个临时帐号没删掉`);
  else if (users.length) console.log(`临时帐号删掉了（${users.length} 个）`);
  process.exitCode = exitCode;
}

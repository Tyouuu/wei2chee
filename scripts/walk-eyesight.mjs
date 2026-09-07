/**
 * 一个五十岁的老板，在工地上、阳光下、粗手指 —— **看得清吗 · 按得准吗 · 用得了吗**。
 *
 *   npm run walk:eyesight
 *   TRADE=salon npm run walk:eyesight
 *
 * 老板 2026-09-07：
 *   `每一次排查都要加深排查的力度 或者是不同方向的排查`
 *   `要做研究了 对比了别人的做法 才提出最好的解决方案`
 *
 * ── 它跟另外两支差在哪（三支都要，不是同一份清单的三份）─────────────────
 *
 *   walk:customer   一天的事**走不走得通** —— 按了有没有反应、打的字存不存得下
 *   walk:friction   同一条路**顺不顺** —— 等多久 · 打几个字 · 看得懂吗
 *   **这一支**       同一条路**他的眼睛跟手指过不过得去**
 *
 * 一件事可以完全走得通、完全顺，而**他看不见那条框、按不准那颗点**。
 *
 * ── 🔴 为什么不是「已经有 check:contrast 了」──────────────────────────────
 *
 * 那一支量得很好，而它的范围窄得很具体，三件都要写下来：
 *   ① 它只量**文字**对底 —— 而老花眼看不见的第一样是**边框跟分隔线**，
 *      那是 WCAG 1.4.11（非文字对比），跟 1.4.3 是两条
 *   ② 它只走 **两页**（quotations · website）
 *   ③ 它走的是 **`?design=1`（编辑器画布）** —— 而 `87c3ce4`（2026-09-07 02:15）
 *      之后**每一个新老板一进来就落在他的系统上，不再是编辑器**。
 *      也就是那一支量的是他今天已经看不到的那一边。
 *
 * ── 六项，每一项后面是一个外面真的量过的门槛，不是我发明的 ────────────────
 *
 *   ① 看得见那条框吗      WCAG 2.2 1.4.11 非文字对比 **3:1**
 *   ② 颜色是不是唯一的话   WCAG 2.2 1.4.1 不靠颜色传达
 *   ③ 放大到 200% 会不会坏  WCAG 2.2 1.4.4 调整文字大小
 *   ④ 按得准吗（含间距）   WCAG 2.2 2.5.8 **24×24**（AA 底线）· Apple 44 · Material 48
 *   ⑤ 键盘走得完吗        WCAG 2.2 2.1.2 没有陷阱 · 2.4.11 焦点不被遮住
 *   ⑥ 字够不够大          没有硬门槛 —— **只印读数**，判断是他的
 *
 * ⚠️ 它自己开一个用完就删的帐号，不碰示范帐号。
 * ⚠️ 除了那五条有外部门槛的，其余**只印读数不判分数** ——
 *    一条我发明的门槛，会让这份读数从第一天起就在替他做决定。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const STAMP = Date.now();
const EMAIL = `eye-${STAMP}@formae.test`;
const PASSWORD = `Eye!${STAMP}`;

const TRADES = {
  reno: { trade: "renovation", pages: ["customers", "quotations", "payments", "projects"], who: "Hin Fatt Renovation", job: "quotations" },
  salon: { trade: "beauty", pages: ["customers", "bookings", "payments"], who: "Wei Hair Studio", job: "bookings" },
  hardware: { trade: "retail", pages: ["customers", "inventory", "orders", "payments"], who: "Seng Huat Hardware", job: "orders" },
};
const TRADE = process.env.TRADE || "reno";
const T = TRADES[TRADE];
if (!T) throw new Error(`不认得这一行：${TRADE}（${Object.keys(TRADES).join(" ")}）`);
const OUT = `.screenshots/walk-eyesight/${TRADE}`;
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
let userId = null;
let leadId = null;
dropThrowawayOnExit?.(admin, () => userId);

const found = [];
const BAD = "红";
const ODD = "黄";
const flag = (level, where, what, ev = "") => {
  found.push({ level, where, what, ev });
  console.log(`  ${level === BAD ? "🔴" : "⚠️ "} ${where.padEnd(20)} ${what}${ev ? "\n       " + ev : ""}`);
};
const ok = (where, what) => console.log(`  ✓  ${where.padEnd(20)} ${what}`);
const head = (t) => console.log(`\n${t}`);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});

/* ═══════════════════════════════════════════════════════════════════════
   在浏览器里跑的那一份。颜色的算术让浏览器自己做 ——
   `check-contrast.mjs` 的档头写着为什么：第一版用正则解析 `rgba(...)`，
   而 Tailwind v4 的透明度会算成 `oklab(...)`，於是它对九十二个好好的
   元素报错。canvas 认得每一种写法。
   ═══════════════════════════════════════════════════════════════════════ */
const AUDIT = () => {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
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
  const lum = (r, g, b) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a.r, a.g, a.b);
    const l2 = lum(b.r, b.g, b.b);
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
  /* 往上找第一个真的画了东西的底 —— 一个 `background: transparent` 的
     容器不是背景，它背后那一层才是。 */
  const groundUnder = (el) => {
    let cur = el.parentElement;
    let acc = null;
    while (cur) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c.a > 0.01) {
        acc = acc ? over(acc, c) : c;
        if ((acc.a ?? 1) >= 0.99) return { ...acc, a: 1 };
      }
      cur = cur.parentElement;
    }
    return acc ? { ...acc, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
  };
  const txt = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();

  /* ── ① 看得见那条框吗（WCAG 1.4.11 = 3:1）───────────────────────────
     🔴 **只量他要打字或者要挑东西的那几个**，而这个范围是看图改窄的：
     第一版把每一个 `<button>` 都算进来，於是把排序表头（`Customer ⌃⌄`）
     跟侧栏连结报成「没有边界」——**一个纯文字的按钮，它的字就是那个资讯**，
     而字的对比归 1.4.3 管（`check:contrast` 在量）。一把冤枉人的尺没有人看。

     🔴 **而边界可以不画在它自己身上。** shadcn 的输入框常常是
     `<div class="border"><input class="border-0"></div>` —— 第一版据此把一个
     画面上明明有框的搜寻框报成「没有边界」。往上找两层，而且那一层的框
     要跟它差不多大（不然会一路找到整页的容器，那样每一个都「有边界」）。 */
  const edges = [];
  const edgeOf = (el, bg) => {
    const s = getComputedStyle(el);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      const w = parseFloat(s[`border${side}Width`]);
      const st = s[`border${side}Style`];
      if (w > 0 && st !== "none" && st !== "hidden") {
        const c = parse(s[`border${side}Color`]);
        if (c.a > 0.01) return over(c, bg);
      }
    }
    return null;
  };
  for (const el of document.querySelectorAll("input,select,textarea")) {
    if (!vis(el) || el.type === "hidden") continue;
    if (["checkbox", "radio", "submit", "button", "range", "color"].includes(el.type)) continue;
    const bg = groundUnder(el);
    const own = parse(getComputedStyle(el).backgroundColor);
    const r0 = el.getBoundingClientRect();
    /* 自己 → 往上两层（框差不多大的才算） */
    let border = edgeOf(el, bg);
    let where = border ? "自己" : "";
    let cur = el.parentElement;
    /* 🔴 「差不多大」不可以拿像素差判。第一版写 `+40`，而一个搜寻框的外壳
       里还装着一个放大镜图标跟左右内距 —— 量出来比 input 宽 **46px**，
       於是三个画面上明明有框的搜寻框被报成「没有边界」。
       准的判断是**那一层只包着这一个框**：那它就是这个框的外壳。
       （`record-table.tsx` 的 `SearchField`：边框画在 `<label>` 上，
        `<input>` 自己是 `bg-transparent` 没有边框。） */
    for (let i = 0; i < 2 && !border && cur; i++, cur = cur.parentElement) {
      if (cur.querySelectorAll("input,select,textarea").length !== 1) break;
      const rp = cur.getBoundingClientRect();
      if (rp.width > r0.width * 2 + 80 || rp.height > r0.height * 2 + 24) break;
      const b = edgeOf(cur, bg);
      if (b) {
        border = b;
        where = `包着它的第 ${i + 1} 层`;
      }
    }
    const fill = own.a > 0.01 ? over(own, bg) : null;
    const s0 = getComputedStyle(el);
    const hasRing = s0.boxShadow && s0.boxShadow !== "none";
    const best = Math.max(border ? ratio(border, bg) : 0, fill ? ratio(fill, bg) : 0);
    edges.push({
      tag: el.tagName.toLowerCase(),
      kind: el.type || "",
      label: (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || txt(el)).slice(0, 26),
      hasBorder: !!border,
      where,
      hasFill: !!fill,
      hasRing,
      r: Math.round(best * 100) / 100,
    });
  }

  /* ── ①b 状态药丸的字（WCAG 1.4.3 = 4.5:1）──────────────────────────
     🔴 `check:contrast` 只走两页而且走的是编辑器画布，所以**表格里那几颗
     状态药丸的字，从来没有被任何一把尺量过**。而它们正是他扫一眼在读的东西。 */
  const pills = [];
  for (const el of document.querySelectorAll("span,div,td")) {
    if (!vis(el)) continue;
    if (el.children.length) continue;
    const t = txt(el);
    if (!t || t.length > 22) continue;
    const s = getComputedStyle(el);
    const own = parse(s.backgroundColor);
    if (own.a < 0.15) continue; /* 没有自己的底 = 不是药丸 */
    const r = el.getBoundingClientRect();
    if (r.height > 40 || r.width > 200) continue;
    const bg = groundUnder(el);
    const fill = over(own, bg);
    const fg = over(parse(s.color), fill);
    pills.push({ t, r: Math.round(ratio(fg, fill) * 100) / 100, px: Math.round(parseFloat(s.fontSize)) });
  }

  /* 分隔线 —— 一条 1px 的浅灰线是「这里分成两块」唯一的讯息 */
  const rules = [];
  for (const el of document.querySelectorAll("hr,[role=separator]")) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    const bg = groundUnder(el);
    const own = parse(s.backgroundColor);
    const bc = parse(s.borderTopColor);
    const w = parseFloat(s.borderTopWidth);
    const c = own.a > 0.01 ? over(own, bg) : w > 0 ? over(bc, bg) : null;
    if (c) rules.push({ r: Math.round(ratio(c, bg) * 100) / 100 });
  }

  /* ── ② 颜色是不是唯一的话（WCAG 1.4.1）──────────────────────────────
     一个有颜色、有面积、而里面**一个字都没有**的小东西 —— 那就是纯靠
     颜色讲话。仓库自己判过同一件（任务 105c：状态那四种画法里，只有
     「图标＋词」那一种印出来跟灰阶上还讲得出话）。 */
  const dots = [];
  for (const el of document.querySelectorAll("span,i,em,b,div")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 26 || r.height > 26 || r.width < 4 || r.height < 4) continue;
    if (el.children.length) continue;
    if (txt(el)) continue;
    const s = getComputedStyle(el);
    const own = parse(s.backgroundColor);
    if (own.a < 0.3) continue;
    const bg = groundUnder(el);
    if (ratio(over(own, bg), bg) < 1.25) continue; /* 跟底几乎一样 = 不是在讲话 */
    /* 它旁边（同一个父层里）有没有字 */
    const near = el.parentElement ? txt(el.parentElement).slice(0, 30) : "";
    dots.push({ w: Math.round(r.width), h: Math.round(r.height), near });
  }

  /* ── ④ 按得准吗（WCAG 2.5.8 = 24×24；Apple 44；Material 48）─────────
     🔴 例外那一条要照条文算，不可以拿「框跟框的间隙」代替。原话：
       「Undersized targets … are positioned so that if a 24 CSS pixel diameter
        circle is centered on the bounding box of each, the circles do not
        intersect another target or the circle for another undersized target」
     所以是：**在每一个未达标目标的框中心画一个直径 24 的圆**，
       · 对另一个未达标的 → 两个圆心距 < 24 就相交
       · 对一个达标的     → 圆心到它的框距离 < 12 就相交
     我第一版写「间隙 < 24 算没过」——**那把门槛拉高了一倍**：
     一颗 20×20 的按钮旁边只要 2px 的空地就够（10 + 2 = 12），
     而那一版会把它判成没过。**一把冤枉人的尺没有人看。** */
  const targets = [];
  const clickable = [...document.querySelectorAll("a,button,[role=button],summary,select,input")].filter(
    (el) => vis(el) && !["hidden"].includes(el.type),
  );
  const boxes = clickable.map((el) => {
    const r = el.getBoundingClientRect();
    return { el, r, cx: r.left + r.width / 2, cy: r.top + r.height / 2, under: Math.min(r.width, r.height) < 24 };
  });
  for (const b of boxes) {
    const min = Math.min(b.r.width, b.r.height);
    if (min >= 44) continue; /* 44 是 Apple 的建议，下面只拿来数 */
    let crowded = false;
    let by = "";
    if (b.under) {
      for (const o of boxes) {
        if (o.el === b.el || b.el.contains(o.el) || o.el.contains(b.el)) continue;
        let hit;
        if (o.under) {
          hit = Math.hypot(b.cx - o.cx, b.cy - o.cy) < 24; /* 两个圆相交 */
        } else {
          const dx = Math.max(o.r.left - b.cx, 0, b.cx - o.r.right);
          const dy = Math.max(o.r.top - b.cy, 0, b.cy - o.r.bottom);
          hit = Math.hypot(dx, dy) < 12; /* 圆碰到那个框 */
        }
        if (hit) {
          crowded = true;
          by = (txt(o.el) || o.el.getAttribute("aria-label") || o.el.type || o.el.tagName).slice(0, 18);
          break;
        }
      }
    }
    targets.push({
      t: (txt(b.el) || b.el.getAttribute("aria-label") || b.el.getAttribute("placeholder") || b.el.type || "").slice(0, 22),
      w: Math.round(b.r.width),
      h: Math.round(b.r.height),
      under: b.under,
      crowded,
      by,
    });
  }

  /* ── ⑥ 字够不够大 —— 只印读数 ───────────────────────────────────── */
  const sizes = {};
  let smallest = { px: 99, t: "" };
  for (const el of document.querySelectorAll("p,span,div,td,th,li,label,a,button,h1,h2,h3,h4")) {
    if (!vis(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize));
    sizes[px] = (sizes[px] ?? 0) + 1;
    const t = txt(el);
    if (px < smallest.px && t.length > 3) smallest = { px, t: t.slice(0, 34) };
  }

  return {
    edges,
    pills,
    rules,
    dots,
    targets,
    sizes,
    smallest,
    spill: document.documentElement.scrollWidth > window.innerWidth + 2,
  };
};

/* 键盘走一圈 —— 陷阱（2.1.2）· 焦点被遮住（2.4.11）· 看不看得见（2.4.7） */
const keyboardWalk = async (page, steps = 45) => {
  const seenAt = [];
  let trapped = null;
  let noRing = [];
  let covered = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    const at = await page
      .evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const ring =
          (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow && s.boxShadow !== "none") ||
          s.borderColor !== getComputedStyle(el.parentElement ?? document.body).borderColor;
        /* 焦点被别的东西盖住吗 —— 打它自己的中心点，看回来的是不是它 */
        let hidden = false;
        if (r.width > 2 && r.height > 2) {
          const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
          const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + r.height / 2));
          const hit = document.elementFromPoint(x, y);
          hidden = !!hit && hit !== el && !el.contains(hit) && !hit.contains(el);
        }
        const off = r.bottom < 0 || r.top > window.innerHeight;
        /* 🔴 记号要认得出是**哪一个**元素，不只是「哪一种」。
           第一版写 `tagName + innerText`，而一个 `<input>` 的 innerText 是空的 ——
           於是一张表单上四个文字框的记号全部是 `INPUT:`，一模一样，
           而「连着八次落在同一个」当场被触发。**那是误报，不是陷阱。**
           现在用它在整棵树里的序号，那是唯一的。 */
        const all = [...document.querySelectorAll("*")];
        const label =
          (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 22) || (el.type ? `${el.type} 框` : el.tagName.toLowerCase());
        return {
          k: `${el.tagName}#${all.indexOf(el)}`,
          label,
          /* ⚠️ 日期跟时间的框天生有好几段（日/月/年 · 时/分），Tab 在里面
             一段一段走，而 `activeElement` 从头到尾是同一个元素。
             那不是陷阱，所以这几种要放宽。 */
          multi: ["date", "time", "datetime-local", "month", "week"].includes(el.type),
          ring,
          hidden,
          off,
        };
      })
      .catch(() => null);
    if (!at) continue;
    seenAt.push(at.k);
    if (!at.ring) noRing.push(at.label);
    if (at.hidden && !at.off) covered.push(at.label);
    /* 连着 N 次落在**同一个元素**上 = 出不去。
       一般的框 8 次就够判；日期/时间那几种天生多段，放宽到 12
       （没有一种日期框有十二段）。 */
    const need = at.multi ? 12 : 8;
    const tail = seenAt.slice(-need);
    if (tail.length === need && new Set(tail).size === 1) {
      trapped = at.label;
      break;
    }
  }
  return { stops: seenAt.length, uniq: new Set(seenAt).size, trapped, noRing, covered };
};

let browser;

try {
  /* 🔴 开跑之前先探一次服务器 —— 一份「登入没成功」的报告，
     跟一份「服务器根本不在」的报告，在画面上长得一模一样：
     两个框空的、没有错误讯息、按钮回到「Log in」。
     **这个仓库被这个形状骗过五次**（`walk:figures` 已经装了同一条）。
     而且要在建帐号**之前**探 —— 不然服务器不在还会留一个垃圾帐号。 */
  const probeRes = await fetch(`${BASE}/en/login`, { redirect: "manual" }).catch(() => null);
  if (!probeRes) {
    console.error(`\n🔴 ${BASE} 不回话 —— 先开 npm run dev，再跑这一支。`);
    process.exit(2);
  }

  /* ── 台面：一个刚走完问卷的老板 ─────────────────────────────────────
     ⚠️ 风格**不在这里挑** —— 先设风格，登入那一跳的目标就变成 `/portal`，
     而那一页在本机第一次编译要好几分钟，整支尺会卡在登入页上，
     画面写着「帐号或密码不对」而那句话是假的（任务 257 付过这一次学费）。 */
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  if (!proj?.id) throw new Error("注册没有开出一个 project");
  /* 🔴 **行业不在 `projects` 上，在问卷上**：
     `accounts.lead_id → leads.industry_id → industries`（`get_my_business_context`）。

     少了它，这个帐号落在 `GENERIC_SAMPLE_EN` 上 —— 每一张表印的是
     「Record 001 / Sample content」，而八个行业各自有自己那一套
     （装修是「Taman Desa 3-bedroom refit · Mr Tan」）。
     於是这一支报「示例资料用的是我们的词」**四页**，
     而**产品一个字都没错 —— 错的是台面**：一个真的老板一定走过问卷，
     那才是他拿得到自己那一行的字的路。
     [重点 22d](../docs/founder-points.md)：做展示用的假资料，要跟着那个系统自己走。 */
  const { data: ind } = await admin.from("industries").select("id").eq("slug", T.trade).single();
  if (!ind?.id) throw new Error(`industries 里没有 ${T.trade}`);
  const { data: lead, error: ldErr } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "walk-eyesight" } })
    .select("id")
    .single();
  if (ldErr) throw new Error(`lead: ${ldErr.message}`);
  leadId = lead.id;
  const { error: linkErr } = await admin
    .from("accounts")
    .update({ lead_id: lead.id })
    .eq("id", userId);
  if (linkErr) throw new Error(`accounts.lead_id: ${linkErr.message}`);
  await admin.from("projects").update({ business_name: T.who, system_language: "en" }).eq("id", proj.id);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  head("① 登入");
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (!page.url().includes("/portal")) {
    await shot(page, "0-stuck-on-login");
    /* 🔴 登不进去有三种，而它们在画面上长得一模一样。分开讲，不然下一个人
       会去查一个不存在的产品 bug（任务 257 付过这一次学费）。 */
    const still = await fetch(`${BASE}/en/login`, { redirect: "manual" }).catch(() => null);
    const said = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
    const shown = /Incorrect|incorrect|wrong|错/.test(said);
    const kind = !still
      ? "服务器中途死了 —— 不是产品"
      : shown
        ? "画面上真的写着一句错误讯息"
        : "🔴 画面上一个字都没有 —— 按了没反应";
    throw new Error(`登入没成功（${kind}），还在 ${new URL(page.url()).pathname}`);
  }
  ok("登入", `落在 ${new URL(page.url()).pathname}`);

  /* 挑一套风格（他第一天真的会走的那一步），然后开那几页 */
  const pick = page
    .locator("button:visible, a:visible, [role=button]:visible")
    .filter({ hasText: /^(Ledger|Swiss|Hearth|Counter|Blueprint|Signboard)\b/i })
    .first();
  if (await pick.count()) {
    await pick.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  const { data: st } = await api.from("projects").select("style").single();
  if (!st?.style) await api.rpc("set_project_style", { new_style: "swiss" });
  for (const key of T.pages) await api.rpc("add_project_page", { requested_key: key, new_title: null });

  /* 暖机 —— 把本机第一次编译的时间花掉 */
  head("⓪ 暖机");
  const ROUTES = [...T.pages, `${T.job}/new`, "today"];
  for (const key of ROUTES) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 300000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  ok("暖机", `${ROUTES.length} 条路走过一次`);

  /* ═══ ① 看得见那条框吗（WCAG 1.4.11 = 3:1）═══════════════════════════ */
  head("① 看得见那条框吗 —— 门槛 3:1（WCAG 2.2 · 1.4.11 非文字对比）");
  const faint = [];
  const invisible = [];
  let edgeCount = 0;
  let ruleFaint = 0;
  let ruleCount = 0;
  const pillsAll = [];
  for (const key of ROUTES) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(900);
    const a = await page.evaluate(AUDIT).catch((e) => ({ err: String(e) }));
    if (a.err) {
      flag(BAD, key, "量不到", a.err.slice(0, 120));
      continue;
    }
    for (const e of a.edges) {
      edgeCount++;
      if (!e.hasBorder && !e.hasFill) invisible.push({ key, ...e });
      else if (e.r < 3) faint.push({ key, ...e });
    }
    for (const r of a.rules) {
      ruleCount++;
      if (r.r < 3) ruleFaint++;
    }
    for (const p of a.pills) pillsAll.push({ key, ...p });
    /* 🔴 过关的也要印出读数。一份只印判决的报告，答不了
       「它是不是在读另一个画面」—— 沙龙那一趟报「全过」而装修报「8/8 不及格」，
       两页用的是同一个组件，而我从判决上分不出是哪一边错了。 */
    if (a.edges.length)
      console.log(
        `  ${key.padEnd(16)} ${a.edges.map((e) => `${e.r}:1${e.where ? `(${e.where[0]})` : "(无框)"}`).join(" ")}`,
      );
    await shot(page, `1-${key.replace(/\//g, "-")}`);
  }
  console.log(`  量了 ${edgeCount} 个他要打字或要挑东西的框 · ${ruleCount} 条分隔线`);
  if (invisible.length) {
    const s = invisible.slice(0, 6).map((x) => `${x.key}·${x.label || x.kind || x.tag}`).join(" / ");
    flag(BAD, "边框", `${invisible.length} 个既没有框、也没有自己的底 —— 那个东西在画面上没有边界`, s);
  }
  if (faint.length) {
    const worst = faint.sort((a, b) => a.r - b.r).slice(0, 6);
    flag(
      ODD,
      "边框",
      `${faint.length} 个的边界对底不足 3:1（WCAG 1.4.11）`,
      worst.map((x) => `${x.r}:1 ${x.key}·${x.label || x.kind || x.tag}`).join(" / "),
    );
  }
  if (ruleFaint) flag(ODD, "分隔线", `${ruleFaint}/${ruleCount} 条分隔线对底不足 3:1`);
  if (!invisible.length && !faint.length) ok("边框", "每一个他要打字的框，边界都到得了 3:1");

  /* ①b 状态药丸的字 —— 那几颗从来没有被任何一把尺量过 */
  const pillBad = pillsAll.filter((p) => p.r < 4.5);
  const byText = [...new Map(pillsAll.map((p) => [p.t, p])).values()];
  console.log(`  量了 ${pillsAll.length} 颗状态药丸（${byText.length} 种）`);
  if (pillBad.length) {
    flag(
      ODD,
      "状态药丸",
      `${pillBad.length} 颗的字对它自己的底不足 4.5:1（WCAG 1.4.3）`,
      [...new Map(pillBad.map((p) => [p.t, p])).values()]
        .slice(0, 5)
        .map((p) => `${p.r}:1 ${p.px}px「${p.t}」@${p.key}`)
        .join(" / "),
    );
  } else if (pillsAll.length) {
    ok("状态药丸", `每一颗的字都到得了 4.5:1 —— 最低 ${Math.min(...pillsAll.map((p) => p.r))}:1`);
  }

  /* ═══ ② 颜色是不是唯一的话（WCAG 1.4.1）════════════════════════════ */
  head("② 颜色是不是唯一的话 —— WCAG 2.2 · 1.4.1");
  let dotTotal = 0;
  const lonely = [];
  for (const key of ROUTES) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(700);
    const a = await page.evaluate(AUDIT).catch(() => null);
    if (!a) continue;
    dotTotal += a.dots.length;
    for (const d of a.dots) if (!d.near) lonely.push({ key, ...d });
  }
  console.log(`  量到 ${dotTotal} 个「有颜色、没有字」的小东西`);
  if (lonely.length) {
    flag(
      BAD,
      "只靠颜色",
      `${lonely.length} 个色块旁边一个字都没有 —— 色盲跟灰阶列印读不出来`,
      lonely.slice(0, 5).map((x) => `${x.key} ${x.w}×${x.h}`).join(" / "),
    );
  } else if (dotTotal) {
    ok("只靠颜色", `${dotTotal} 个色点，每一个旁边都有字 —— 拿掉颜色还讲得出话`);
  } else {
    ok("只靠颜色", "没有纯色块在讲话");
  }

  /* ═══ ③ 放大到 200%（WCAG 1.4.4）══════════════════════════════════
     老花眼的第一个动作就是按 Ctrl+ 放大。等价的量法是把视窗缩一半 ——
     浏览器缩放改变的就是视口的 CSS px 宽度。 */
  head("③ 放大到 200% —— WCAG 2.2 · 1.4.4（他老花眼的第一个动作）");
  await page.setViewportSize({ width: 720, height: 475 });
  const zoomBad = [];
  for (const key of ROUTES) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(900);
    const z = await page
      .evaluate(() => {
        const spill = document.documentElement.scrollWidth > window.innerWidth + 2;
        /* 被切掉的字：省略号是设计，一句被硬切一半的句子是坏的 */
        const cut = [...document.querySelectorAll("p,span,div,h1,h2,h3,td,th,li,label,button,a")]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 20 || r.height < 6) return false;
            const s = getComputedStyle(el);
            if (s.visibility === "hidden" || s.display === "none") return false;
            return el.scrollWidth > el.clientWidth + 4 && s.overflow !== "visible";
          })
          .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30))
          .filter(Boolean);
        /* 主要动作还在不在画面里 */
        const main = [...document.querySelectorAll("a,button")].find((el) =>
          /^(New|Add|Save|Record|Create)\b/i.test((el.innerText || "").trim()),
        );
        const mainOff = main ? main.getBoundingClientRect().right > window.innerWidth + 2 : null;
        return { spill, cut: [...new Set(cut)], mainOff };
      })
      .catch(() => null);
    if (!z) continue;
    if (z.spill) zoomBad.push(`${key}：整页横着溢出去`);
    if (z.mainOff) zoomBad.push(`${key}：主要动作被推到画面外`);
    if (z.cut.length) zoomBad.push(`${key}：${z.cut.length} 处字被切（${z.cut.slice(0, 2).join(" · ")}）`);
    await shot(page, `3-zoom200-${key.replace(/\//g, "-")}`);
  }
  if (zoomBad.length) for (const b of zoomBad) flag(ODD, "放大 200%", b);
  else ok("放大 200%", `${ROUTES.length} 页都不横滚、没有字被切、主要动作还在画面里`);
  await page.setViewportSize({ width: 1440, height: 950 });

  /* ═══ ④ 按得准吗（WCAG 2.5.8 = 24×24 · Apple 44 · Material 48）═════
     🔴 2.5.8 的例外：小於 24 但周围有 24 的空地也算过。所以要同时量间距。 */
  head("④ 按得准吗 —— 门槛 24×24（WCAG 2.2 · 2.5.8）· Apple 44 · Material 48");
  for (const [label, vp] of [
    ["电脑 1440", { width: 1440, height: 950 }],
    ["手机 390", { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(vp);
    let under24 = [];
    const small = [];
    let under44 = 0;
    let tiny = 0;
    let total = 0;
    for (const key of ROUTES) {
      await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(700);
      const a = await page.evaluate(AUDIT).catch(() => null);
      if (!a) continue;
      for (const t of a.targets) {
        total++;
        under44++;
        small.push(t);
        if (t.under) tiny++;
        if (t.crowded) under24.push({ key, ...t });
      }
    }
    console.log(`  ${label}：${under44} 个不到 44（Apple 的建议）· 其中 ${tiny} 个不到 24（WCAG 的底线）`);
    /* 🔴 一个「41 个不到 44」而不讲**是哪几个**的读数，没有人接得下去。
       按大小 × 长相分组印出来 —— 同一个尺寸的一群多半是同一个共用件，
       改一处就是一群。只印，不判（44 是 Apple 的建议，不是门槛）。 */
    if (under44) {
      const by = new Map();
      for (const t of small) {
        const k = `${t.w}x${t.h}`;
        if (!by.has(k)) by.set(k, { n: 0, who: new Set() });
        const g = by.get(k);
        g.n++;
        if (t.t) g.who.add(t.t.slice(0, 14));
      }
      const top = [...by].sort((x, y) => y[1].n - x[1].n).slice(0, 8);
      for (const [k, g] of top)
        console.log(`     ${String(g.n).padStart(3)} 个 ${k.padEnd(9)} ${[...g.who].slice(0, 4).join(" · ")}`);
    }
    if (under24.length) {
      flag(
        BAD,
        `按得准·${label}`,
        `${under24.length} 个不到 24×24 而且旁边没有空地 —— 粗手指按不准（WCAG 2.5.8）`,
        under24.slice(0, 5).map((x) => `${x.w}×${x.h}「${x.t}」贴着「${x.by}」@${x.key}`).join(" / "),
      );
    } else {
      ok(`按得准·${label}`, `${tiny} 个不到 24，而每一个周围都有 24 的空地 —— 照 2.5.8 的例外算过`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 950 });

  /* ═══ ⑤ 键盘走得完吗（2.1.2 陷阱 · 2.4.11 焦点被遮住 · 2.4.7 看得见）═══ */
  head("⑤ 键盘走得完吗 —— WCAG 2.2 · 2.1.2 / 2.4.11 / 2.4.7");
  for (const key of [T.pages[0], `${T.job}/new`]) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(900);
    await page.evaluate(() => document.body.focus());
    const k = await keyboardWalk(page);
    console.log(`  ${key.padEnd(16)} 停 ${k.stops} 次 · ${k.uniq} 个不同的落点`);
    if (k.trapped) flag(BAD, `键盘·${key}`, `出不去 —— 连着八次都落在「${k.trapped}」上（WCAG 2.1.2）`);
    if (k.covered.length)
      flag(
        BAD,
        `键盘·${key}`,
        `${k.covered.length} 个落点被别的东西盖住 —— 他看不到自己在哪（WCAG 2.4.11）`,
        [...new Set(k.covered)].slice(0, 4).join(" / "),
      );
    if (k.noRing.length)
      flag(ODD, `键盘·${key}`, `${k.noRing.length} 个落点看不出焦点在哪`, [...new Set(k.noRing)].slice(0, 4).join(" / "));
    if (!k.trapped && !k.covered.length && !k.noRing.length) ok(`键盘·${key}`, "走得完 · 没有陷阱 · 每一站看得见");
  }

  /* ═══ ⑥ 字够不够大 —— 只印读数 ══════════════════════════════════ */
  head("⑥ 字够不够大 —— 没有硬门槛，读数给他判");
  for (const key of ROUTES.slice(0, 4)) {
    await page.goto(`${BASE}/en/portal/${key}`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(700);
    const a = await page.evaluate(AUDIT).catch(() => null);
    if (!a) continue;
    const top = Object.entries(a.sizes)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 4)
      .map(([px, n]) => `${px}px×${n}`)
      .join(" · ");
    console.log(`  ${key.padEnd(16)} 最常用 ${top} · 最小 ${a.smallest.px}px「${a.smallest.t}」`);
  }

  /* ── 判 ──────────────────────────────────────────────────────────── */
  head("判");
  const bad = found.filter((f) => f.level === BAD).length;
  const odd = found.filter((f) => f.level === ODD).length;
  console.log(`  ${bad} 件红 · ${odd} 件黄`);
  console.log(`  图在 ${OUT}/`);
  if (bad) process.exitCode = 1;
} catch (e) {
  console.error("\n🔴 这一趟没走完：", e.message);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  await dropThrowaway(admin, userId);
  /* 那一笔问卷也要收掉 —— 它挂在 console 的「线索」那张表上。 */
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}

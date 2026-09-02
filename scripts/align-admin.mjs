/* 后台这一边的尺 —— 我们那一套 vs 它在抄的那一页，逐项报差异。
 *
 *   npm run align:admin              # 六套全部
 *   npm run align:admin -- ledger    # 只量一套
 *
 * ── 为什么要有它 ──────────────────────────────────────────────────────────
 * 老板 2026-09-02 发了一张贴文：`前端能打开不等于做对了` ·
 * `根据目标截图和当前页面，列出视觉差异…先给修复顺序，修改后重新截图验证`。
 *
 * 那个做法我们**官网那一边有**（`npm run align`，48 项），**后台这一边没有**。
 * 所以官网的差异被逐项钉着，后台的差异只有我用眼睛看 —— 而
 * [重点 24](../docs/founder-points.md) 讲得很清楚：**眼睛判像不像，尺子判有没有再犯。**
 * 后台缺的是第二半，所以同一个差异可以回来第三次。
 *
 * ── 它跟 `npm run align` 差在哪 ───────────────────────────────────────────
 * 那一支量的是**一页官网**：有哪些区段、每段多高、照片多大、动效怎么进场。
 * 一张后台不是那个东西 —— 它是**一条侧栏加一格一格的卡**，所以这一支量的是
 * 外框 · 一屏几块 · 那几块的顺序 · 最大的字是什么 · 字级阶梯 · 有颜色的面积 ·
 * 卡片的圆角内距 · 块与块之间的缝 · 一屏塞了多少字。
 *
 * ⚠️ **同一支探针量两边。** 两边用不同的量法，量出来的差异有一半是量法的差异
 * —— 这个仓库栽过（`align` 的段内留白报 8% 对 1%，查出来是行内元素对块级元素）。
 *
 * ⚠️ **数字只能否决，不能通过**（[重点 24](../docs/founder-points.md)）。
 * 过不过要看它写出来的那张并排图 `.screenshots/align-admin/<风格>.jpg`。
 *
 * ⚠️ **参考页载不到就是失败，不是通过。** 一把「量不到就沉默」的尺，
 * 跟一把说「你没问题」的尺长得一模一样 —— 这个仓库被骗过至少四次。
 */
import { chromium } from "playwright";
/* 从**图**上量的那一支。老板 2026-09-03：`你不能帮我去反用在图片上
   就是利用好我们的尺子`。DOM 那一支每一家写法都不一样，画面是同一种东西 ——
   所以两边的截图用**同一支**像素探针再量一次，跟 DOM 那一支互相印证。 */
import { measureImage } from "./probe-image.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const OUT = ".screenshots/align-admin";
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "tianyou.demo@formae.test";
const PASS = process.env.DEMO_PASSWORD || "FormaeDemo2026!";

/* 我们那一页长在 Puck 的画布里，不是长在 body 上。量 body 等於把
   Formae 自己的编辑器外壳（顶栏、那颗绿色的「确认设计」、dev 的红点）
   算进这一套风格 —— 那是「量到的东西不是画面上的东西」的同一类错。 */
const OURS_ROOT = '[class*="_PuckCanvas-root"]';

// ---------------------------------------------------------------------------
// 探针 —— 两边用同一支
// ---------------------------------------------------------------------------

/**
 * 这一支会被丢进浏览器里跑，所以它不可以引用外面任何东西。
 * 回来的每一栏都要嘛是一个数字，要嘛是一串短词 —— 报告里印得下才有人看。
 */
const PROBE = (rootSel) => {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return { error: "找不到根元素 " + rootSel };
  const R = root.getBoundingClientRect();
  const vis = (e) => {
    const c = getComputedStyle(e);
    if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [...root.querySelectorAll("*")].filter(vis);

  // ---- 外框：侧栏还是顶栏，多宽 -------------------------------------------
  /* 🔴 门槛放宽到 40px，而且高度门槛降到五成。
     六套里**四套连「有没有侧栏」都读不到**，查出来是两个太紧的数字：
       · 我们那一页画在 Puck 的画布里，画布上缘有一条假的浏览器标题条（约 28px），
         所以顶栏的 top 是 28 不是 0 —— 12px 的容差把招牌整条顶栏挡在门外
       · 炉的侧栏底下留了一截，高度只有画布的 57%，六成的门槛差一点点
     十个红里有十个是这两个数字造的，**不是设计的错**。 */
  const EDGE = 40;
  let rail = null;
  for (const e of all) {
    const r = e.getBoundingClientRect();
    if (r.height >= R.height * 0.5 && r.width >= 48 && r.width <= 340 && r.left - R.left < EDGE) {
      if (!rail || r.width < rail.w) rail = { axis: "side", w: Math.round(r.width), el: e };
    }
  }
  if (!rail) {
    for (const e of all) {
      const r = e.getBoundingClientRect();
      if (r.width >= R.width * 0.85 && r.height >= 36 && r.height <= 96 && r.top - R.top < EDGE) {
        rail = { axis: "top", w: Math.round(r.height), el: e };
        break;
      }
    }
  }
  const railGround = rail ? getComputedStyle(rail.el).backgroundColor : "";

  // ---- 内容栏：最宽的那一块，扣掉侧栏 --------------------------------------
  const contentLeft = rail && rail.axis === "side" ? R.left + rail.w : R.left;
  const contentW = R.width - (rail && rail.axis === "side" ? rail.w : 0);

  /* 一屏里的「块」：宽度过内容栏一半、高过 48、而且不是另一块的外壳。
     取最外面那一层 —— 不然一张卡里的每一格都会被数成一块。 */
  const qualifies = (e) => {
    const r = e.getBoundingClientRect();
    return (
      vis(e) &&
      /* 🔴 0.28 → 0.15。Tabler 的仪表盘一行四张卡，每张 326px = 内容栏的 25%，
         **一张都不到 28%**，於是那一层整个不算数，挑到的是外面那几条整行的包装，
         报回来「其他 ×14」。一行四张卡是这种页面最常见的排法，
         门槛必须容得下它。 */
      r.width >= contentW * 0.15 &&
      r.height >= 48 &&
      r.left >= contentLeft - 4 &&
      r.top < R.top + 2200 &&
      !(rail && rail.el.contains(e)) &&
      /* 🔴 第二版报「参考页有 10 块」，而那一页画面上只有一张表。
         查出来是**表格的行**：一行够宽、够高，於是 tbody 变成「装着最多块
         的容器」。一张表是一块，不是十块。 */
      !e.closest("table")
    );
  };
  /* 🔴 第一版取「没有被别人包住的那几个」，而一张后台从头到尾都被一个大 div
     包着 —— 於是整页只报得出 1 块。实拍并排一看，我们那一页画面上明明有四块。
     改成找**装着最多块的那一个容器**，再取它的直接子元素：那才是画面上
     一块挨着一块的那一层。 */
  let holder = null, best = 0;
  for (const e of [root, ...all]) {
    if (e.closest("table")) continue;
    const kids = [...e.children].filter(qualifies);
    /* 平手的时候取**外面那一个** —— 内外两层装着同一批块的时候，
       画面上那一层是外面那层，里面那层只是个包装。 */
    if (kids.length > best || (kids.length === best && best > 0 && e.contains(holder))) {
      best = kids.length;
      holder = e;
    }
  }
  const outer = (holder ? [...holder.children] : [])
    .filter(qualifies)
    .map((e) => ({ e, r: e.getBoundingClientRect() }));
  outer.sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);

  /** 一块是什么：表 / 图 / 数字 / 名单 / 其他。判的是**画面上认得出的东西**。
   *
   * 🔴 第一版把 Tabler 的仪表盘读成「其他 ×14」—— 那一页画面上是四张小走势卡、
   * 一张柱状图、一张地图。门槛设错了两个地方：
   *   · 图要求 svg 高过 56px，而**小走势卡的曲线只有 40px 上下**
   *   · 数字要求字级 ≥20px，而**小走势卡的数字是 18px**
   * 一个把大半张页面判成「其他」的分类器，回报出来的是「四种全对」——
   * 那正是老板看着两张图问「为什么差那么大」的时候，尺子说没事的原因。
   *
   * ⚠️ 顺带回答「官网那把尺不能复用吗」：**试过了，它读不了后台。**
   * `npm run align -- --probe https://free-demo.tailadmin.com/` 自己印出
   * 「段数 1 · 🔴 读到的段太少 —— 这个 DOM 尺子看不懂」。它是照**行销页**
   * 长的：整页宽的区段一段一段往下叠。一张后台是一条侧栏加一格一格的卡，
   * 不是那个形状。**能复用的是它的诚实（读不到就吼），不是它的切法。**
   */
  const kindOf = (e) => {
    if (e.querySelector("table")) return "表";
    /* 画得出形状的东西：走势线、柱子、圆环、地图。**不设高门槛** ——
       一张小走势卡就是一张图，只是它小。 */
    const draws = [...e.querySelectorAll("svg,canvas")].filter((s) => {
      const r = s.getBoundingClientRect();
      /* 图标是 12–24px 见方的东西，图不是。用「够宽」把图标挡在外面，
         而不是用「够高」—— 一条走势线可以很矮，但它一定很宽。 */
      return r.width >= 70 && r.height >= 24;
    });
    if (draws.length) return "图";
    const nums = [...e.querySelectorAll("*")].filter((n) => {
      const t = (n.childNodes.length === 1 && n.textContent) || "";
      return /^[^a-zA-Z]*[\d][\d,. ]{0,}$/.test(t.trim()) &&
        t.trim().length >= 2 &&
        parseFloat(getComputedStyle(n).fontSize) >= 17;
    });
    if (nums.length) return "数字";
    if ([...e.querySelectorAll("li")].length >= 3) return "名单";
    return "其他";
  };
  const blocks = outer.slice(0, 16).map(({ e, r }) => ({
    kind: kindOf(e),
    h: Math.round(r.height),
    w: Math.round(r.width),
  }));

  // ---- 字：最大的那一个是什么，阶梯有几级 ---------------------------------
  const sizes = new Map();
  let biggest = { px: 0, text: "" };
  for (const e of all) {
    const own = [...e.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!own) continue;
    const px = Math.round(parseFloat(getComputedStyle(e).fontSize));
    sizes.set(px, (sizes.get(px) || 0) + own.length);
    if (px > biggest.px) biggest = { px, text: own.slice(0, 24) };
  }
  /* 只算真的铺开的那几级 —— 一个只出现过三个字的字级不是一级，是一次例外。 */
  const steps = [...sizes.entries()].filter(([, n]) => n >= 8).length;
  const biggestIsNumber = /^[^a-zA-Z一-龥]*[\d]/.test(biggest.text);

  // ---- 卡片：圆角、内距、有几成带阴影、有几成带细边 ------------------------
  const cards = all
    .map((e) => ({ e, r: e.getBoundingClientRect(), c: getComputedStyle(e) }))
    .filter(
      ({ r, c }) =>
        r.width > 140 &&
        r.height > 60 &&
        parseFloat(c.borderRadius) > 2 &&
        (c.boxShadow !== "none" || parseFloat(c.borderTopWidth) > 0),
    );
  const med = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)]);
  };
  const cardRadius = med(cards.map(({ c }) => parseFloat(c.borderRadius)));
  /* 🔴 参考页第一次报「内距 0」。框跟内距常常不在同一个元素上（外面那个
     只画边，里面那个才留白），所以自己是 0 的时候问它第一个子元素。
     **一个 0 不是「他们不留白」，是我问错了元素。** */
  const padOf = ({ e, c }) => {
    const own = parseFloat(c.paddingTop) || 0;
    if (own > 0) return own;
    const kid = e.firstElementChild;
    return kid ? parseFloat(getComputedStyle(kid).paddingTop) || 0 : 0;
  };
  const cardPad = med(cards.map(padOf));
  const pct = (n) => (cards.length ? Math.round((n / cards.length) * 100) : 0);
  const withShadow = pct(cards.filter(({ c }) => c.boxShadow !== "none").length);
  const withBorder = pct(cards.filter(({ c }) => parseFloat(c.borderTopWidth) > 0).length);

  // ---- 块与块之间的缝 -----------------------------------------------------
  const gaps = [];
  for (let i = 1; i < outer.length; i++) {
    const g = outer[i].r.top - outer[i - 1].r.bottom;
    if (g >= 0 && g < 200) gaps.push(g);
  }

  // ---- 表格：行多高、栏能不能排、底下有没有页尾 ----------------------------
  /* 这三条是 2026-09-02 **用眼睛在并排图上看出来的**，尺子当时一条都量不到：
     他们的行比我们松、他们的栏头有排序箭头、他们表底下有「每页几笔 + 页码」。
     [重点 24](../docs/founder-points.md)：眼睛看到而尺子量不到的，
     当场变成尺子的一项，不然它会回来第三次。 */
  const table = root.querySelector("table");
  let rowH = null, sortable = 0, tableFoot = "没有";
  if (table) {
    const trs = [...table.querySelectorAll("tbody tr")].filter(vis).slice(0, 12);
    const hs = trs.map((t) => t.getBoundingClientRect().height).filter((h) => h > 8);
    rowH = hs.length ? Math.round(hs.reduce((a, c) => a + c, 0) / hs.length) : null;
    sortable = [...table.querySelectorAll("th")].filter(
      (h) =>
        h.querySelector("button,svg,[role=button]") ||
        h.getAttribute("aria-sort") ||
        /sortable/i.test(h.className || ""),
    ).length;
    /* 页尾：表格底下 160px 之内，有没有一条带「页 / page / rows / 下一页」的东西。 */
    const tb = table.getBoundingClientRect();
    /* 🔴 第一版报「没有」，而参考页明明写着「10 Rows per page · Page 1 of 10」。
       查出来：`find` 是照 DOM 顺序找的，於是先撞到 `<html>` —— 那一整页的字
       当然也包含「rows per」，而它的 top 是 0，几何条件就挡掉了。
       **一个祖先的文字不是这一块的文字。** 改成把所有符合的收齐，取**最小的那一个**。 */
    const feet = all.filter((e) => {
      const r = e.getBoundingClientRect();
      return (
        r.top >= tb.bottom - 8 &&
        r.top < tb.bottom + 200 &&
        r.width > tb.width * 0.4 &&
        r.height < 120 &&
        /page|rows per|next|上一页|下一页|每页/i.test(e.innerText || "")
      );
    });
    feet.sort((a, c) => {
      const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
      return ra.width * ra.height - rc.width * rc.height;
    });
    tableFoot = feet.length ? "有" : "没有";
  }

  // ---- 工具条上有几个可以按的 ---------------------------------------------
  /* 他们那条是「筛一个字 + 两个分面 + 换栏位」四件，我们只有一个框。
     那不是装饰的差别，那是这一页能不能拿来做事的差别。 */
  let tools = 0;
  if (table) {
    const tb = table.getBoundingClientRect();
    tools = all.filter((e) => {
      const r = e.getBoundingClientRect();
      const tag = e.tagName;
      return (
        (tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || e.getAttribute("role") === "combobox") &&
        r.bottom <= tb.top + 4 &&
        r.bottom > tb.top - 90 &&
        r.left >= contentLeft - 4
      );
    }).length;
  }

  // ---- 有没有一颗孤单的按钮 · 页面底下有没有一大块空 ------------------------
  /* 这两条都是 2026-09-03 **用眼睛在 1:1 的裁图上看到的**，而尺子当时十八项
     没有一项在问。[重点 24](../docs/founder-points.md)：眼睛看到而尺子量不到的，
     当场变成尺子的一项，不然它会回来第三次。

     · 孤单的按钮 —— 招牌的标题置中之后，那颗红色的主要按钮浮在正中间一条
       空带上，看起来像画坏了。判法：这颗按钮左右各 140px 之内都没有别的东西，
       而且它自己大致落在容器的正中。
     · 底下的空 —— 中台那一页画到一半就没了，底下留一大块。判法：
       最后一块的下缘离页面底端超过 200px。 */
  let lonely = 0;
  for (const e of all) {
    const t = e.tagName;
    if (t !== "BUTTON" && t !== "A") continue;
    const r = e.getBoundingClientRect();
    if (r.width < 60 || r.height < 24) continue;
    const mid = r.top + r.height / 2;
    /* 左右各看一眼：140px 之内有没有别的看得见的东西。 */
    /* 🔴 第一版问的是「打到的那个元素有没有字」，而 `innerText` 会把**整个
       子树**的字算进去 —— 打在空白上打到的是一个大容器，它当然「有字」，
       於是这条守卫对着它就是为了抓的那颗置中的红按钮回报 0。
       **写完就故意把标题改回置中试了一次，才发现。**
       改成只认**它自己那一层的字**，或者一个图/控件。 */
    const near = (dx) => {
      const x = dx < 0 ? r.left + dx : r.right - dx;
      const el = document.elementFromPoint(Math.max(1, Math.min(window.innerWidth - 1, x)), mid);
      if (!el || el === e || e.contains(el)) return false;
      if (/^(IMG|SVG|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return true;
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join("");
      return own.length > 0;
    };
    const alone = !near(-140) && !near(140);
    const box = e.parentElement ? e.parentElement.getBoundingClientRect() : R;
    const centred = Math.abs((r.left + r.right) / 2 - (box.left + box.right) / 2) < 24 && box.width > 400;
    if (alone && centred) lonely++;
  }
  const lastBottom = outer.length ? Math.max(...outer.map((o) => o.r.bottom)) : R.top;
  const tailGap = Math.max(0, Math.round(R.top + root.scrollHeight - lastBottom));

  // ---- 一屏塞了多少字 -----------------------------------------------------
  const words = (root.innerText.match(/\S+/g) || []).length;

  return {
    rail: rail ? rail.axis : "没有",
    railW: rail ? rail.w : 0,
    railGround,
    blocks: blocks.map((b) => b.kind).join(" → "),
    blockCount: blocks.length,
    /* 🔴 2026-09-02 加的，而且它排在所有尺寸前面。
       老板看着招牌跟 TailAdmin 并排问「为什么每一张都差别那么大」——
       答案不在任何一个尺寸里：**他们那一页由四张图组成，我们那一页由一个数字
       加一张表组成**。八块里只有一块是同一种东西。
       尺子当时十八项，十七项在量尺寸跟颜色，剩下那一项印出顺序**但不判对错**。
       组成不对的时候，调行高是在装修一间盖错的房子。 */
    charts: blocks.filter((b) => b.kind === "图").length,
    tables: blocks.filter((b) => b.kind === "表").length,
    figures: blocks.filter((b) => b.kind === "数字").length,
    lists: blocks.filter((b) => b.kind === "名单").length,
    firstBlock: blocks[0]?.kind ?? "—",
    biggestPx: biggest.px,
    biggestText: biggest.text,
    biggestIsNumber,
    steps,
    cards: cards.length,
    cardRadius,
    cardPad,
    withShadow,
    withBorder,
    gap: med(gaps),
    lonely,
    tailGap,
    rowH,
    sortable,
    tableFoot,
    tools,
    words,
    height: Math.round(root.scrollHeight),
  };
};

// ---------------------------------------------------------------------------
// 有颜色的面积 —— 从截图算，不从 DOM 算
// ---------------------------------------------------------------------------
/* ⚠️ 从 DOM 算这一栏是错的，而且我犯过：现代那几套用 `oklch()` 写颜色，
   `getComputedStyle` 原样回传那一串字，拿正则去抓数字读出来的是废话。
   面积只有逐像素算得准。 */
function oklabChroma(r8, g8, b8) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return Math.hypot(
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  );
}
async function colouredPct(buf) {
  const { data, info } = await sharp(buf)
    .resize({ width: 360, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let hit = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    if (oklabChroma(data[i], data[i + 1], data[i + 2]) > 0.035) hit++;
  }
  return Math.round((hit / total) * 1000) / 10;
}

// ---------------------------------------------------------------------------
// 报告
// ---------------------------------------------------------------------------
const pad = (s, n) => String(s ?? "—").padEnd(n);
const num = (s, n) => String(s ?? "—").padStart(n);

/** 一项一行：名字 · 参考 · 我们 · 判。判不了的印「看图」，不印勾。 */
function line(name, ref, ours, verdict) {
  return `  ${pad(name, 14)} ${num(ref, 18)}   ${num(ours, 18)}   ${verdict}`;
}

/** 差多少算差。**每一条门槛都写着它为什么是这个数**，不然下一个人只能猜。 */
function judge(name, ref, ours) {
  if (ref == null || ours == null) return "?";
  const near = (tol) => (Math.abs(ref - ours) <= tol ? "ok" : "差");
  switch (name) {
    // 侧栏宽差 24px 以内，眼睛看不出来（我们六套之间本来就差 8–40）
    case "侧栏宽": return near(24);
    // 字级阶梯：他们十级我们七级 —— 差两级以上就是「整页没有层次」
    case "字级阶梯": return near(2);
    // 最大的字：差 6px 以内看不出来
    case "最大的字": return near(6);
    // 圆角差 3px 以内看不出来
    case "圆角": return near(3);
    // 卡片内距差 6px 以内看不出来
    case "卡片内距": return near(6);
    // 块与块的缝差 8px 以内看不出来
    case "块间的缝": return near(8);
    // 有颜色的面积：门槛跟 check:register-colour 同一个，7 个百分点
    case "有颜色": return Math.abs(ref - ours) <= 7 ? "ok" : "差";
    // 一屏几块：差两块以上就是另一种版面
    case "一屏几块": return near(2);
    // 一屏几个字：他们 330 我们 199 —— 差三成以上就是密度不同
    case "一屏字数": return ref && Math.abs(ref - ours) / ref <= 0.35 ? "ok" : "差";
    // 表格行高差 6px 以内看不出来；差 10px 以上一屏就少两行
    case "表格行高": return near(6);
    // 栏能不能排：他们四栏能排、我们零栏，就是差
    case "栏能不能排": return ref > 0 && ours === 0 ? "差" : "ok";
    // 工具条：差两件以上就是「这一页能不能拿来做事」的差别
    case "工具条几件": return near(2);
    default: return "?";
  }
}

// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT, { recursive: true });
  const { REGISTER_REFERENCES } = await import("../design-system/register-references.ts");
  const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const regs = want.length ? want : Object.keys(REGISTER_REFERENCES);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });

  await p.goto(`${BASE}/en/login`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', EMAIL);
  await p.fill('input[type="password"]', PASS);
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 60000 });

  /* 他本来穿的那一套，跑完放回去。一把每跑一次就悄悄换掉他风格的尺，
     是有代价的尺（`shoot:registers` 9-02 已经补过同一件）。 */
  await p.goto(`${BASE}/en/portal/styles`, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(3500);
  const ORIGINAL = await p.evaluate(() => {
    const c = [...document.querySelectorAll("li[data-register]")].find(
      (x) => !x.querySelector("button[data-register-use]"),
    );
    return c ? c.getAttribute("data-register") : null;
  });
  console.log(`本来是 ${ORIGINAL ?? "(读不到 —— 跑完不会乱放回去)"}\n`);

  let failed = 0;
  for (const reg of regs) {
    const ref = REGISTER_REFERENCES[reg];
    if (!ref) { console.log(`${reg}: 没有声明参考`); failed++; continue; }

    // ---- 我们那一套 -------------------------------------------------------
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
    if (hit === "miss") { console.log(`${reg}: 画廊里点不到它`); failed++; continue; }
    await p.waitForTimeout(3000);
    await p.goto(`${BASE}${ref.ourPage}`, { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(6500);
    const ours = await p.evaluate(PROBE, OURS_ROOT);
    if (ours.error) { console.log(`${reg}: ${ours.error}`); failed++; continue; }
    const oursShot = await p.locator(OURS_ROOT).first().screenshot({ type: "png" });
    ours.colour = await colouredPct(oursShot);

    // ---- 它在抄的那一页 ---------------------------------------------------
    let theirs = null, theirShot = null;
    try {
      await p.goto(ref.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(6500);
      theirs = await p.evaluate(PROBE, null);
      theirShot = await p.screenshot({ type: "png" });
      theirs.colour = await colouredPct(theirShot);
      /* 载到了一张登入页、或者一张几乎没有字的页，跟没载到是同一件事 ——
         而它们在报告里长得一模一样，所以在这里就挡掉。 */
      if (theirs.words < 60) theirs = { error: `只读到 ${theirs.words} 个字 —— 多半没载到` };
    } catch (e) {
      theirs = { error: String(e).slice(0, 60) };
    }

    console.log(`\n${ref.zh} ${reg}  ←  ${ref.reference}   ${ref.source}`);
    console.log(`  拿的是：${ref.takes}`);
    if (theirs?.error) {
      console.log(`  🔴 参考页读不到：${theirs.error}`);
      console.log(`     ⚠️ 读不到就是失败，不是通过。`);
      failed++;
      continue;
    }

    console.log(`  ${pad("", 14)} ${num("参考", 18)}   ${num("我们", 18)}`);
    /** 组成吻合：把两边的块按种类点名，看有几种数量对得上。
     *  这不是「顺序一样」——顺序可以不一样而仍然是同一种页面；
     *  「他们四张图我们一张」不行。 */
    const kinds = ["图", "表", "数字", "名单"];
    const off = kinds.filter((k) => {
      const a = { 图: theirs.charts, 表: theirs.tables, 数字: theirs.figures, 名单: theirs.lists }[k];
      const b = { 图: ours.charts, 表: ours.tables, 数字: ours.figures, 名单: ours.lists }[k];
      return Math.abs(a - b) > 1;
    });

    /* 图上量的那一份。两边同一支探针，跟 DOM 那一份并排印 ——
       **两份不一样的时候，信图那一份**，因为客人看的是图。 */
    const pxT = await measureImage(theirShot);
    const pxO = await measureImage(oursShot);

    const rows = [
      /* 组成排最前面，因为它决定其余每一项值不值得看。 */
      ["图上几块", pxT.cards, pxO.cards, Math.abs(pxT.cards - pxO.cards) <= 3 ? "ok" : "差"],
      ["一行几块", pxT.perRowMax, pxO.perRowMax, Math.abs(pxT.perRowMax - pxO.perRowMax) <= 1 ? "ok" : "差"],
      ["块宽", pxT.cardWidth, pxO.cardWidth,
        pxT.cardWidth && pxO.cardWidth && Math.abs(pxT.cardWidth - pxO.cardWidth) / pxT.cardWidth <= 0.3 ? "ok" : "差"],
      ["图几张", theirs.charts, ours.charts, Math.abs(theirs.charts - ours.charts) <= 1 ? "ok" : "差"],
      ["表几张", theirs.tables, ours.tables, Math.abs(theirs.tables - ours.tables) <= 1 ? "ok" : "差"],
      ["数字块几个", theirs.figures, ours.figures, Math.abs(theirs.figures - ours.figures) <= 1 ? "ok" : "差"],
      ["名单几个", theirs.lists, ours.lists, Math.abs(theirs.lists - ours.lists) <= 1 ? "ok" : "差"],
      ["组成", `${kinds.length - off.length}/4 种对上`, off.length ? `差在 ${off.join("·")}` : "全对", off.length ? "差" : "ok"],
      ["外框", theirs.rail, ours.rail, theirs.rail === ours.rail ? "ok" : "差"],
      ["侧栏宽", theirs.railW, ours.railW, judge("侧栏宽", theirs.railW, ours.railW)],
      ["一屏几块", theirs.blockCount, ours.blockCount, judge("一屏几块", theirs.blockCount, ours.blockCount)],
      ["第一块是", theirs.firstBlock, ours.firstBlock, theirs.firstBlock === ours.firstBlock ? "ok" : "差"],
      ["最大的字", theirs.biggestPx, ours.biggestPx, judge("最大的字", theirs.biggestPx, ours.biggestPx)],
      ["最大的是数字", theirs.biggestIsNumber ? "是" : "不是", ours.biggestIsNumber ? "是" : "不是",
        theirs.biggestIsNumber === ours.biggestIsNumber ? "ok" : "差"],
      ["字级阶梯", theirs.steps, ours.steps, judge("字级阶梯", theirs.steps, ours.steps)],
      ["有颜色", theirs.colour + "%", ours.colour + "%", judge("有颜色", theirs.colour, ours.colour)],
      ["圆角", theirs.cardRadius, ours.cardRadius, judge("圆角", theirs.cardRadius, ours.cardRadius)],
      ["卡片内距", theirs.cardPad, ours.cardPad, judge("卡片内距", theirs.cardPad, ours.cardPad)],
      ["带阴影", theirs.withShadow + "%", ours.withShadow + "%", "看图"],
      ["带细边", theirs.withBorder + "%", ours.withBorder + "%", "看图"],
      ["块间的缝", theirs.gap, ours.gap, judge("块间的缝", theirs.gap, ours.gap)],
      ["表格行高", theirs.rowH, ours.rowH, judge("表格行高", theirs.rowH, ours.rowH)],
      ["栏能不能排", theirs.sortable, ours.sortable, judge("栏能不能排", theirs.sortable, ours.sortable)],
      ["表格页尾", theirs.tableFoot, ours.tableFoot, theirs.tableFoot === ours.tableFoot ? "ok" : "差"],
      ["工具条几件", theirs.tools, ours.tools, judge("工具条几件", theirs.tools, ours.tools)],
      ["一屏字数", theirs.words, ours.words, judge("一屏字数", theirs.words, ours.words)],
      /* 这两条不跟参考比 —— 它们是**画坏了**，参考有几个不影响我们有没有。 */
      ["孤单的按钮", theirs.lonely, ours.lonely, ours.lonely > 0 ? "差" : "ok"],
      /* ⚠️ 只在**他们那一页填满了而我们没有**的时候才算差。
         参考页自己也常常留一大截（炉 670 · 中台 1300）——
         拿一个绝对值去判，会把「他们也一样」判成我们的错。 */
      ["底下的空", theirs.tailGap, ours.tailGap,
        ours.tailGap > 200 && theirs.tailGap < 120 ? "差" : "ok"],
    ];
    /* 故意不跟的那几项：印「留」，不算进那个数字，而且把理由印出来。
       ⚠️ 它不是消音钮 —— 理由写在 `register-references.ts` 里，守卫盯着。 */
    const kept = new Map((ref.keeps ?? []).map((k) => [k.item, k.why]));
    for (const [n, a, o, v] of rows) {
      const why = kept.get(n);
      console.log(line(n, a, o, v === "差" ? (why ? "留" : "🔴 差") : v));
      if (v === "差" && why) console.log(`  ${" ".repeat(14)} ↳ ${why}`);
    }
    console.log(`  ${pad("顺序", 14)} 参考 ${theirs.blocks}`);
    console.log(`  ${pad("", 14)} 我们 ${ours.blocks}`);
    const bad = rows.filter(([n, , , v]) => v === "差" && !kept.has(n)).length;
    console.log(`  → ${bad} 项对不上${kept.size ? `（另有 ${kept.size} 项是故意不跟的）` : ""}。⚠️ 数字只能否决 —— 过不过看 ${OUT}/${reg}.jpg`);

    // ---- 给眼睛看的图：原尺寸，分段，不缩 -----------------------------------
    /* 老板 2026-09-03：`不要用缩图 一定要放大 每一个细节慢慢复刻`。
       他讲对了 —— 把 1440 宽的两页各缩到一半再并排，画面上一切都还在，
       **而每一个细节都没了**：行高、字重、边框粗细、图标大小，
       全部是要在原尺寸才看得出来的东西。

       所以现在出两种：
         <风格>.jpg        两页并排，**原尺寸**，看全貌
         <风格>-1..3.jpg   横切成三段，**上参考下我们，原尺寸**，看细节
       裁的是同样的 y 范围，所以上下两半讲的是页面上同一个位置。 */
    const shots = { ref: theirShot, ours: oursShot };
    const meta = {
      ref: await sharp(shots.ref).metadata(),
      ours: await sharp(shots.ours).metadata(),
    };
    const W = Math.max(meta.ref.width, meta.ours.width);
    const H = Math.max(meta.ref.height, meta.ours.height);

    /* 全貌：并排，原尺寸。 */
    await sharp({ create: { width: meta.ref.width + meta.ours.width + 24, height: H, channels: 3, background: "#0b0d13" } })
      .composite([
        { input: shots.ref, left: 0, top: 0 },
        { input: shots.ours, left: meta.ref.width + 24, top: 0 },
      ])
      .jpeg({ quality: 82 })
      .toFile(`${OUT}/${reg}.jpg`);

    /* 细节：三段，上下叠，原尺寸。 */
    const SLICES = 3;
    const band = Math.floor(H / SLICES);
    for (let i = 0; i < SLICES; i++) {
      const top = i * band;
      const cut = async (buf, m) => {
        const h = Math.max(0, Math.min(band, m.height - top));
        if (h <= 8) return null;
        return sharp(buf).extract({ left: 0, top, width: m.width, height: h }).toBuffer();
      };
      const [ra, oa] = await Promise.all([cut(shots.ref, meta.ref), cut(shots.ours, meta.ours)]);
      if (!ra && !oa) continue;
      const rm = ra ? await sharp(ra).metadata() : { width: 0, height: 0 };
      const om = oa ? await sharp(oa).metadata() : { width: 0, height: 0 };
      const comp = [];
      if (ra) comp.push({ input: ra, left: 0, top: 0 });
      if (oa) comp.push({ input: oa, left: 0, top: rm.height + 14 });
      await sharp({
        create: { width: W, height: rm.height + om.height + 14, channels: 3, background: "#00beb7" },
      })
        .composite(comp)
        .jpeg({ quality: 86 })
        .toFile(`${OUT}/${reg}-${i + 1}.jpg`);
    }
  }

  if (ORIGINAL) {
    await p.goto(`${BASE}/en/portal/styles`, { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(3000);
    await p.evaluate((w) => document.querySelector(`button[data-register-use="${w}"]`)?.click(), ORIGINAL);
    await p.waitForTimeout(2500);
    console.log(`\n放回 ${ORIGINAL}`);
  }
  await b.close();

  writeFileSync(
    `${OUT}/index.html`,
    `<title>后台对照</title><style>body{background:#0b0d13;color:#eef1f5;font-family:system-ui;padding:24px}
h2{font-size:15px;letter-spacing:.08em;color:#00beb7;margin:26px 0 8px}img{width:100%;border:1px solid #222836;border-radius:8px}</style>` +
      regs.map((r) => `<h2>${r} — 左：参考 · 右：我们</h2><img src="${r}.jpg">`).join(""),
  );
  console.log(`\n→ ${OUT}/index.html   ⚠️ 现在去用眼睛看`);
  if (failed) {
    console.log(`\n🔴 ${failed} 套量不到。`);
    process.exit(1);
  }
}

await main();

/**
 * 反复对齐 —— one register's page beside the template it copies, section by
 * section, both read out of the DOM.
 *
 * 老板 2026-08-27: 「还是抄的不完整 你自己用眼睛去看 完全不对啊 就是你再次对齐看看」
 * then 「等下做剩下的几套都是要反复对齐」.
 *
 * ── WHY A SCRIPT AND NOT AN EYEballing ───────────────────────────────────
 *
 * Three rounds of 「抄得不完整」 were spent fixing whichever difference happened
 * to be in the crop he sent. Putting both pages side by side proved the real
 * problem was structural and invisible in any crop: our 服务 sat where their
 * SECOND section is, so every section below it was one slot out of step the
 * whole way down. No amount of looking at the bottom of the page finds that.
 *
 * What it prints is the thing to look at, not a score:
 *   · both section lists, in order, with heights and photograph counts
 *   · every h1/h2 with its computed size  (this is how 32px vs 50px was found)
 *   · a side-by-side JPG with a rule drawn at every section boundary
 *
 * 用眼睛看的是那张图。数字只是用来找出「哪一段对错了」。
 *
 *   npm run align -- hearth
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { config } from "dotenv";
import fs from "node:fs";
import { execSync } from "node:child_process";

config({ path: ".env.local" });
config();

/* Which template each register copies whole. See docs/founder-tasks.md 33. */
const REF = {
  hearth: "https://www.wix.com/demone2/a-reynolds",
  /* 改了 2026-08-27: Wright & Taylor is a paint COLOUR CONSULTANT -- pretty,
     but a boutique adviser. Newel is an actual residential remodeling
     contractor, which is the trade 台账 is for. Found by opening Wix's
     `industrial` category, which I had never opened and which is entirely our
     market: remodeling, plumbing, auto service, construction. */
  ledger: "https://www.wix.com/demone2/wh-newel",
  swiss: "https://www.wix.com/demone2/wh-leah",
  blueprint: "https://www.wix.com/demone2/wh-law-firm-2",
  signboard: "https://www.wix.com/demone2/brasserie",
  counter: "https://www.wix.com/demone2/wh-kurofude-rest",
  /* The three added 2026-08-27 to fix a MEASURED defect, not to have more:
     with six registers, 图纸 sat in seven of the eight trades' hands and two
     pairs of trades were handed an identical three. Both gaps were on the same
     side -- four of the six argue with FACTS and only one each argues with the
     WORK or with the SIGN. See docs/founder-tasks.md 35. */
  mosaic: "https://www.wix.com/demone2/wh-beauty-shop",
  nocturne: "https://www.wix.com/demone2/kaito-ramen-den",
  shelf: "https://www.wix.com/demone2/wagora",
  /* 服务 had no register built for it: its three were all 「facts」 registers
     with not one photograph of a workman, while 14 of the 19 Malaysian trade
     sites measured in 任务 26 lead with one. */
  crew: "https://plumbzo.framer.website/",
};

const register = process.argv[2] || "hearth";
const url = REF[register];
if (!url) {
  console.error(`no reference for ${register}. known: ${Object.keys(REF).join(", ")}`);
  process.exit(1);
}

const PROJECT = process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2";
const OUT = ".screenshots/align";
fs.mkdirSync(OUT, { recursive: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const layouts = JSON.parse(fs.readFileSync(".screenshots/photos/per-trade.json", "utf8"));

/* ⚠️ The editor autosaves. Snapshot the demo project and put it back, or every
   run quietly rewrites the founder's own preview site. */
const { data: project } = await db
  .from("projects").select("style,palette,site_slug").eq("id", PROJECT).single();
const { data: page } = await db
  .from("project_pages").select("layout_json").eq("project_id", PROJECT).eq("page_key", "website").single();

const restore = async () => {
  await db.from("projects").update({ style: project.style, palette: project.palette }).eq("id", PROJECT);
  await db.from("project_pages").update({ layout_json: page.layout_json })
    .eq("project_id", PROJECT).eq("page_key", "website");
};

await db.from("projects").update({ style: register, palette: null }).eq("id", PROJECT);
await db.from("project_pages").update({ layout_json: layouts[register] })
  .eq("project_id", PROJECT).eq("page_key", "website");

const browser = await chromium.launch();

/* Sections: the outermost full-width children taller than a caption. Nesting
   differs between the two pages, so the rule is 「outermost at each top」 rather
   than a selector, which would only ever fit one of them. */
/* Passed to page.evaluate as real functions, not as eval'd strings: the first
   version built them as template literals and one escape level was lost, so
   `\s` became `s` and every letter s was stripped out of the printed text. */
function readSections(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : null;
  let node = root;
  if (node) while (node && node.children.length <= 2) node = node.children[0];
  const pool = node ? [...node.children] : [...document.querySelectorAll("section,div[id^='comp-']")];
  /* Wix nests wrappers, so 「outermost at each position」 is the rule, and it
     needs the boxes sorted tallest-first at each top or an inner wrapper wins.
     Two ways this went wrong before: without sorting the reference came back
     as 14 sections with six printed twice; rejecting anything that merely
     STARTS inside a taken box swallowed five real siblings and left 5. Only a
     box fully inside another is the same section. */
  const boxes = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    .filter((x) => x.h >= (node ? 60 : 140) && (node || x.w >= 1300))
    .sort((a, b) => a.top - b.top || b.h - a.h);

  const out = [];
  for (const { e, top, h } of boxes) {
    if (out.some((o) => top >= o.top && top + h <= o.top + o.h)) continue;
    out.push({
      top,
      h,
      img: e.querySelectorAll("img,video").length,
      text: (e.innerText || "").trim().split(/\s+/).join(" ").slice(0, 64),
    });
  }
  return out.sort((a, b) => a.top - b.top);
}

/* ── 结构 SHAPE：一段的「里面」有哪些盒子 ───────────────────────────────────

   老板 2026-08-29, 看完六张对照图：「是准确了 可是还不是100%」·
   「我问你有什么解决方法吗 是skills不好用还是什么」.

   不是 skill 的问题。这个档案量的是**整页级**（几段 · 每段多高 · 几张照片 ·
   字多大 · 每段底色），design-md-generator 抽的是 **token 级**（颜色 · 字级 ·
   间距 · 动效）。那一天剩下的每一个差异都落在这两层中间：

     · 他们的导航浮在照片上，我们是照片上面另一条
     · 他们的照片缩在版心里、上面空一段气，我们满边贴着字
     · 他们那一段右边有一颗描边药丸，我们从来没画过
     · 他们的按钮方角，我们圆角
     · 他们的标题贴着页缘、左边距 0，我们有版心边距

   五件里没有一件会改变段高或照片张数，所以尺子印 0，而画面一眼就看得出不像。
   量不到的东西不会因为看得够久就被看到 —— 那一整天就是这个循环。

   所以这里量的是一段**里面有哪些盒子**：每个盒子是图 / 按钮 / 字，左右占这一段
   宽的百分之几、上下在哪、圆角多少。然后一段对一段比。

   ⚠️ 它不判「好不好看」，它判「有没有这个东西、在不在同一个位置」。
   两边的 DOM 完全不同（Wix 的包装层套五层），所以认的是**角色**不是标签，
   而且只收看得见、够大的盒子 —— 一个 4px 的分隔线不是这一段的结构。 */
function readShape(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : null;
  let node = root;
  if (node) while (node && node.children.length <= 2) node = node.children[0];
  const pool = node ? [...node.children] : [...document.querySelectorAll("section,div[id^='comp-']")];
  const secs = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    .filter((x) => x.h >= (node ? 60 : 140) && (node || x.w >= 1300))
    .sort((a, b) => a.top - b.top || b.h - a.h);
  const kept = [];
  for (const b of secs) if (!kept.some((o) => b.top >= o.top && b.top + b.h <= o.top + o.h)) kept.push(b);
  kept.sort((a, b) => a.top - b.top);

  const PAGE = document.documentElement.getBoundingClientRect().width || 1440;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05;
  };
  /* 一个盒子算「按钮」的条件：它是可以点的，有自己的底或框，而且高度像一个控件。
     Wix 的按钮是 <a> 套一个 <span>，我们的是 <a> 自己 —— 认背景/边框比认标签准。 */
  const isButton = (el) => {
    if (!el.matches("a,button,[role=button]")) return false;
    const r = el.getBoundingClientRect();
    if (r.height < 24 || r.height > 96 || r.width < 60) return false;
    const cs = getComputedStyle(el);
    const painted = cs.backgroundColor && !/(^rgba\(0, 0, 0, 0\)$|transparent)/.test(cs.backgroundColor);
    const framed = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
    return painted || framed;
  };
  const ownText = (el) => {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.trim();
  };

  return kept.map((sec) => {
    const sr = sec.e.getBoundingClientRect();
    const boxes = [];
    const push = (el, kind, extra) => {
      const r = el.getBoundingClientRect();
      if (r.width < PAGE * 0.03 || r.height < 10) return;
      const x0 = Math.round((r.left / PAGE) * 100);
      const x1 = Math.round(((r.left + r.width) / PAGE) * 100);
      const y0 = Math.round(((r.top - sr.top) / Math.max(1, sr.height)) * 100);
      const y1 = Math.round(((r.top + r.height - sr.top) / Math.max(1, sr.height)) * 100);
      /* 同一个盒子被包了五层，五层的矩形一样 —— 只留一个。 */
      if (boxes.some((b) => b.kind === kind && Math.abs(b.x0 - x0) <= 1 && Math.abs(b.y0 - y0) <= 1 && Math.abs(b.x1 - x1) <= 1)) return;
      boxes.push({ kind, x0, x1, y0, y1, ...extra });
    };

    for (const el of sec.e.querySelectorAll("*")) {
      if (!vis(el)) continue;
      if (el.matches("img,video")) { push(el, "图"); continue; }
      if (isButton(el)) {
        const rad = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
        push(el, "钮", { rad: rad >= 40 ? "丸" : rad >= 3 ? "圆" : "方" });
        continue;
      }
      const t = ownText(el);
      if (t.length >= 2) push(el, "字", { px: Math.round(parseFloat(getComputedStyle(el).fontSize)) });
    }
    /* 一段里的字块常常几十个（每一行一个）—— 按「左边缘 + 字级」并成一栏，
       那才是排版上的一个东西。 */
    const merged = [];
    for (const b of boxes.sort((a, b2) => a.y0 - b2.y0 || a.x0 - b2.x0)) {
      const same = b.kind === "字" && merged.find((m) => m.kind === "字" && Math.abs(m.x0 - b.x0) <= 2 && m.px === b.px && b.y0 - m.y1 <= 4);
      if (same) { same.y1 = Math.max(same.y1, b.y1); same.x1 = Math.max(same.x1, b.x1); continue; }
      merged.push(b);
    }
    return merged;
  });
}

/* ── 字体 TYPE ─────────────────────────────────────────────────────────────
   SIZE WAS NEVER THE WHOLE AXIS, and reading only the size is what let 満図
   ship 「抄完了」 while wearing the wrong typeface. 2026-08-28, side by side at
   native size: A. Reynolds sets its headings AND its body in a serif; ours was
   a geometric sans throughout. The ruler said 90/50 vs 83/51 and passed it.

   重点 7i names 字体 as one of five axes; a face is the loudest half of that
   axis and it was the half nobody measured. So: family, weight, tracking and
   line height, for headings and for body text — because a page can copy its
   headings and still read as somebody else's if the paragraphs are wrong. */
function readType() {
  const face = (el) => {
    const s = getComputedStyle(el);
    /* The FIRST family is the one that applies; the rest of the stack is what
       happens when it fails to load. Quotes stripped so 「"Playfair Display"」
       and 「Playfair Display」 compare equal. */
    const fam = (s.fontFamily || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    return {
      fam,
      px: Math.round(parseFloat(s.fontSize)),
      w: s.fontWeight,
      lh: Math.round(parseFloat(s.lineHeight) || 0),
      ls: (parseFloat(s.letterSpacing) || 0).toFixed(2),
      /* Serif or not cannot be read off the computed style — it is a property
         of the font file. Measured instead: render one glyph in the page's own
         face and again in a known serif and a known sans, and see which it
         matches. This is the standard font-detection trick and it is the only
         thing here that answers 「衬线还是无衬线」 without a human looking. */
      /* ── 衬线还是无衬线，以及它到底有没有出现在画面上 ──────────────────
         ⚠️ THIS IS THE FIELD THAT STOPPED THIS RULER LYING, 2026-08-28.

         It reported A. Reynolds as a serif page. I looked at the screenshot,
         agreed, and told the founder their design is serif and ours is wrong.
         It is not. `helvetica-w01-light` came back from document.fonts with
         status "error": the webfont could not be fetched from this machine, so
         the browser fell back to Times and BOTH the measurement and the
         picture showed serifs that are not in their design. Their real faces —
         neue-haas-grotesk-display-pro and helvetica — are grotesks, and ours
         already was one. A whole typeface change was one sentence away from
         being made on the strength of a failed download.

         So availability is measured FIRST, and the shape only reported when
         the face is actually on screen. The test is the standard one: set the
         family with monospace behind it, and again with monospace alone. If
         the widths are identical the family resolved to nothing. */
      ...(() => {
        const w = (family, text) => {
          const c = document.createElement("canvas").getContext("2d");
          c.font = `100px ${family}`;
          return c.measureText(text).width;
        };
        const probe = "WWWMMMiiilllQQQ@@@";
        const here = w(`"${fam}", monospace`, probe) !== w("monospace", probe);
        /* ⚠️ NO SERIF/SANS VERDICT IS PRINTED, and that is deliberate.
           A wide-over-narrow glyph ratio was tried: Georgia 3.09, Times 3.13,
           Arial 4.02 — clean. Then the fonts this product actually uses were
           measured and it collapsed: Geist, a sans, came back 3.338;
           Newsreader, a serif, 3.374. The metric cannot separate them, and a
           ruler that prints a confident wrong answer is worse than one that
           prints the family name and lets the eye decide. The eye has the
           picture; give it the name and whether the name reached the screen. */
        return { here };
      })(),
    };
  };
  const heads = [...document.querySelectorAll("h1,h2")]
    .filter((h) => (h.innerText || "").trim())
    .map((h) => ({ t: (h.innerText || "").trim().slice(0, 26), ...face(h) }));
  /* Body: the paragraphs that actually carry prose, not a two-word label. */
  const bodyEls = [...document.querySelectorAll("p,li")]
    .filter((e) => (e.innerText || "").trim().split(/\s+/).length >= 8)
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) >= 12)
    .slice(0, 40);
  const body = [...document.querySelectorAll("p,li")]
    /* ⚠️ 12px 以下的不算正文。瑞士的参考页回报正文 10px，我们 16px，判成对不上 —
       那 10px 是页脚的法务小字，它页面上真正的正文跟我们一样。一个把最小的字
       当成正文的样本，量的是那一页的免责声明。 */
    .filter((e) => (e.innerText || "").trim().split(/\s+/).length >= 8)
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) >= 12)
    .slice(0, 40)
    .map(face);
  const commonest = (arr, key) => {
    const m = {};
    for (const x of arr) m[x[key]] = (m[x[key]] || 0) + 1;
    /* 平手的时候取大的那个。中台 只凑得出两个样本 —— 26px 的第一屏副标跟 13px
       的一行全大写标签 —— 一比一，而 Object.entries 对数字样的键是由小到大，
       所以它安静地选了 13，把一行标签判成了这一页的正文。
       平手不是「小的赢」，平手是「这把尺问错了」；下面 bodyN < 3 会报量不到。 */
    const best = Object.entries(m).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
    return best ? best[0] : "—";
  };
  return {
    heads,
    bodyFam: commonest(body, "fam"),
    bodyPx: commonest(body, "px"),
    bodyLh: commonest(body, "lh"),
    bodyHere: body.length ? body.filter((b) => b.here).length > body.length / 2 : null,
    bodyN: body.length,
    bodySamples: bodyEls.slice(0, 12).map((e, i) => `${body[i]?.px}px  ${(e.innerText || "").trim().slice(0, 34)}`),
  };
}

/* ── 照片：几张、多大、什么比例 ───────────────────────────────────────────
   老板 2026-08-28: 「图片的大小 也是要注意」.

   The section list counts photographs and the anatomy reads the group they sit
   in; neither says how BIG one is, and 「1img」 is equally true of a 1440×810
   band and of a thumbnail. Five of the six references are pages whose pictures
   ARE the argument, so they are not copied until the pictures are the size
   theirs are. */
function readShots(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return [];
  return [...root.querySelectorAll("img,video")]
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + scrollY) };
    })
    /* Below a thumbnail it is a logo, an icon or a spacer — counting those
       would drown the numbers that matter. */
    .filter((x) => x.w >= 120 && x.h >= 90)
    .sort((a, b) => a.top - b.top)
    .map((x) => ({ ...x, ratio: +(x.w / x.h).toFixed(2) }));
}

/* ── 每一段的解剖 ─────────────────────────────────────────────────────────
   The other thing size could not see. 満図's second section is 「Our Expertise」
   — FIVE BORDERED CARDS ON A GREY PANEL, 3 then 2, each with a small icon.
   Ours was a numbered list of four lines. Both are 「a section with a heading」
   and the section list printed them as equals.

   So for each section: what colour it is painted, how much air it has top and
   bottom, and — the part that matters — the repeated group inside it, because
   一排卡片 / 一列清单 / 一张大图 are three different skeletons wearing the same
   height. */
function readAnatomy(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : null;
  let node = root;
  if (node) while (node && node.children.length <= 2) node = node.children[0];
  const pool = node ? [...node.children] : [...document.querySelectorAll("section,div[id^='comp-']")];
  const boxes = pool
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { e, top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) };
    })
    .filter((x) => x.h >= (node ? 60 : 140) && (node || x.w >= 1300))
    .sort((a, b) => a.top - b.top || b.h - a.h);
  const taken = [];
  const hex = (raw) => {
    const m = (raw || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    if (p.length > 3 && !p[3]) return null;
    return "#" + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  };
  /* What colour the section actually IS.
     Three ways a section gets its colour and all three have to be read, or the
     answer is 「—」 for every section, which is what the first version returned
     for the whole reference: Wix paints with a filled DIV stretched inside the
     section, not with a background on the section itself. So: the element's
     own background, else a child that covers it, else the first ancestor that
     declares one. */
  const painted = (el) => {
    const own = hex(getComputedStyle(el).backgroundColor);
    if (own) return own;
    const box = el.getBoundingClientRect();
    if (box.width && box.height) {
      for (const k of el.querySelectorAll("*")) {
        const c = hex(getComputedStyle(k).backgroundColor);
        if (!c) continue;
        const r = k.getBoundingClientRect();
        if (r.width * r.height >= box.width * box.height * 0.8) return c;
      }
    }
    let n = el.parentElement;
    while (n) {
      const c = hex(getComputedStyle(n).backgroundColor);
      if (c) return c;
      n = n.parentElement;
    }
    return "—";
  };
  const out = [];
  for (const { e, top, h } of boxes) {
    if (taken.some((o) => top >= o.top && top + h <= o.top + o.h)) continue;
    taken.push({ top, h });
    /* THE REPEATED GROUP. Walk down looking for the deepest container whose
       children are several boxes of the same width — that is a card row, a
       list, or a gallery, and which of the three it is shows in their shape. */
    let best = null;
    const walk = (n, depth) => {
      if (depth > 14) return;  // Wix nests ten wrappers deep; six stopped on them
      const kids = [...n.children].filter((k) => k.getBoundingClientRect().height > 24);
      if (kids.length >= 2) {
        const r = kids.map((k) => k.getBoundingClientRect());
        const w0 = Math.round(r[0].width);
        const same = r.every((x) => Math.abs(Math.round(x.width) - w0) <= 6);
        const perRow = new Set(r.map((x) => Math.round(x.top))).size;
        if (same && w0 > 90) {
          const cs = getComputedStyle(kids[0]);
          const cand = {
            n: kids.length,
            rows: perRow,
            cols: Math.round(kids.length / Math.max(1, perRow)),
            w: w0,
            bg: hex(cs.backgroundColor) || "透明",
            border: parseFloat(cs.borderTopWidth) ? `${Math.round(parseFloat(cs.borderTopWidth))}px` : "无框",
            radius: Math.round(parseFloat(cs.borderTopLeftRadius)) || 0,
            img: kids[0].querySelectorAll("img,svg,video").length,
          };
          if (!best || cand.n > best.n || (cand.n === best.n && cand.w < best.w)) best = cand;
        }
      }
      for (const k of kids) walk(k, depth + 1);
    };
    walk(e, 0);
    const cs = getComputedStyle(e);
    const im = e.querySelector("img,video");
    out.push({
      top,
      h,
      bg: painted(e),
      padTop: Math.round(parseFloat(cs.paddingTop)) || 0,
      padBottom: Math.round(parseFloat(cs.paddingBottom)) || 0,
      group: best,
      imgRadius: im ? Math.round(parseFloat(getComputedStyle(im).borderTopLeftRadius)) || 0 : null,
      text: (e.innerText || "").trim().split(/\s+/).join(" ").slice(0, 30),
    });
  }
  return out.sort((a, b) => a.top - b.top);
}

/* ── 动效 · 留白 · 颜色（带稳定性分层）──────────────────────────────────────

   The three axes 重点 7i names that `npm run align` could not see. Read off the
   LIVE page with getComputedStyle rather than out of the CSS text: the computed
   value is what actually applies, and it works on any URL — which matters,
   because design-md-generator normalises a URL to its domain root and nine of
   our ten references live on a path under wix.com.

   The stability scoring below is design-md-generator's method (MIT, and a
   method is not copyrightable) with ONE signal replaced. Theirs asks 「on how
   many PAGES does this colour appear」, which needs a crawl of five to eight
   pages. We measure one page, so ours asks 「in how many SECTIONS」 — the same
   question at the scale we work at. A colour in every section is the skeleton;
   a colour in one section is this month's poster.
*/
function readAxes(rootSel) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return null;

  const count = (arr) => {
    const m = {};
    for (const v of arr) m[v] = (m[v] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  /* ── 动效 ─────────────────────────────────────────────────────────────── */
  const durations = [];
  const easings = [];
  const animations = new Map();
  const moved = new Set();
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    for (const d of (s.transitionDuration || "").split(",")) {
      const t = d.trim();
      const ms = t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1000;
      if (ms > 0) durations.push(Math.round(ms));
    }
    for (const f of (s.transitionTimingFunction || "").split(/,(?![^(]*\))/)) {
      const v = f.trim();
      if (v) easings.push(v);
    }
    for (const p of (s.transitionProperty || "").split(",")) {
      const v = p.trim();
      if (v && v !== "all" && v !== "none") moved.add(v);
    }
    if (s.animationName && s.animationName !== "none") {
      for (const n of s.animationName.split(",")) {
        const name = n.trim();
        if (name && name !== "none") animations.set(name, (animations.get(name) || 0) + 1);
      }
    }
  }
  const tierOf = (ms) =>
    ms < 100 ? "micro" : ms < 200 ? "small" : ms < 350 ? "medium" : ms < 600 ? "large" : "xl";
  const tiers = {};
  for (const ms of durations) {
    const k = tierOf(ms);
    if (!tiers[k]) tiers[k] = { values: new Set(), n: 0 };
    tiers[k].values.add(ms);
    tiers[k].n++;
  }

  /* Whether the page honours 减少动效. Reading the stylesheets is the only way
     to see a media query that is not currently matching. Cross-origin sheets
     throw on .cssRules, and that is not a failure — it is a sheet we cannot
     see, and saying so is better than reporting false. */
  let reducedMotion = false;
  let sheetsRead = 0;
  let sheetsBlocked = 0;
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules || [];
      sheetsRead++;
      for (const rule of rules) {
        if (rule.conditionText && /prefers-reduced-motion/.test(rule.conditionText)) {
          reducedMotion = true;
        }
      }
    } catch {
      sheetsBlocked++;
    }
  }

  /* ── 留白 ─────────────────────────────────────────────────────────────── */
  const pads = [];
  const gaps = [];
  for (const el of root.querySelectorAll("*")) {
    if (el.getBoundingClientRect().width < 40) continue;
    const s = getComputedStyle(el);
    for (const v of [s.paddingTop, s.paddingBottom]) {
      const n = Math.round(parseFloat(v));
      if (n >= 4 && n <= 400) pads.push(n);
    }
    for (const v of [s.rowGap, s.columnGap]) {
      const n = Math.round(parseFloat(v));
      if (n >= 4 && n <= 400) gaps.push(n);
    }
  }
  /* The base unit is the largest step most of the values are multiples of —
     4 on almost every modern site, 5 or 8 on some. */
  /* ⚠️ The first version tested every value it had collected and came back with
     「基数 1px」 for both pages, which is the answer you get when the sample
     includes computed values that were never authored -- a 9px padding that is
     really 0.5625rem of an inherited font size, a 41px gap that is a percentage
     of a flexible row. Those are consequences, not decisions.

     So: round to the nearest pixel, keep only values a person would plausibly
     have typed (>= 8px), and require the divisor to explain three quarters of
     them. Reported as 「量不出来」 rather than 1 when nothing does -- 1px is not
     a base unit, it is a failure to find one. */
  const authored = pads.concat(gaps).filter((n) => n >= 8);
  let base = 0;
  for (const cand of [8, 6, 5, 4, 3, 2]) {
    if (authored.length >= 8 && authored.filter((n) => n % cand === 0).length / authored.length > 0.75) {
      base = cand;
      break;
    }
  }

  /* ── 颜色 + 四层稳定性 ────────────────────────────────────────────────── */
  const sections = [];
  {
    let node = root;
    while (node && node.children.length <= 2) node = node.children[0];
    for (const e of node ? node.children : []) {
      if (e.getBoundingClientRect().height >= 60) sections.push(e);
    }
  }
  const seen = new Map();
  /* ⚠️ WEIGHTED BY PAINTED AREA, NOT BY HOW MANY ELEMENTS DECLARE IT.

     The first version counted declarations, and on its first run it classified
     台账's own ground -- #45372a, the colour of the entire page -- as
     「content」, with the signals 「只在 1 段出现 · 只拿来铺底 · 只出现 2 次」.
     All three were true of the DECLARATION and false of the PAGE: we paint the
     ground once on the wrapper and inherit it, while Wix repaints it on every
     section, so the same design decision scored 8 on one page and -35 on the
     other.

     A ruler whose reading depends on how the CSS was authored is measuring the
     author, not the page. Background now counts the element's share of the
     viewport width squared-ish (area / 10000 px²), which is what the eye sees;
     text and border keep counting occurrences, because a hairline's area is
     not what makes it structural. */
  const note = (raw, kind, el) => {
    if (!raw || raw === "none") return;
    const m = raw.match(/rgba?\(([^)]+)\)/);
    if (!m) return;
    const parts = m[1].split(",").map((x) => parseFloat(x));
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts.length > 3 ? parts[3] : 1;
    if (!a) return;
    const hex =
      "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    if (!seen.has(hex)) {
      seen.set(hex, { hex, rgb: [r, g, b], n: 0, usedAs: {}, inSections: new Set() });
    }
    const t = seen.get(hex);
    const r2 = el.getBoundingClientRect();
    const weight = kind === "bg" ? Math.max(1, Math.round((r2.width * r2.height) / 10000)) : 1;
    t.n += weight;
    t.usedAs[kind] = (t.usedAs[kind] || 0) + weight;
    /* A section counts if the painted box CONTAINS it as well as if it sits
       inside it -- the page wrapper contains all of them. */
    const box = el.getBoundingClientRect();
    for (let i = 0; i < sections.length; i++) {
      const sb = sections[i].getBoundingClientRect();
      const inside = sections[i].contains(el);
      const covers = kind === "bg" && box.top <= sb.top + 2 && box.bottom >= sb.bottom - 2;
      if (inside || covers) t.inSections.add(i);
    }
  };
  /* Backgrounds are scanned from the DOCUMENT, not from the frame: our ground
     is painted on the StyleScope wrapper, which is an ANCESTOR of .ds-site, so
     scanning inside the frame missed the single most-seen colour on the page.
     Text and borders stay inside the frame -- the browser chrome around it is
     not the design. */
  for (const el of document.body.querySelectorAll("*")) note(getComputedStyle(el).backgroundColor, "bg", el);
  for (const el of root.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    note(s.color, "text", el);
    note(s.borderTopColor, "border", el);
  }
  const pageArea = Math.max(1, document.body.scrollHeight * root.clientWidth);

  /* Which colours somebody gave a NAME to. A named colour is a decision; an
     unnamed one may be a one-off. */
  const declared = new Set();
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        const st = rule.style;
        if (!st) continue;
        for (let i = 0; i < st.length; i++) {
          const p = st[i];
          if (p.startsWith("--")) declared.add(st.getPropertyValue(p).trim().toLowerCase());
        }
      }
    } catch {
      /* cross-origin */
    }
  }

  const total = Math.max(1, sections.length);
  const colours = [...seen.values()]
    .map((t) => {
      const signals = [];
      let score = 0;
      const cover = t.inSections.size / total;
      if (cover >= 0.8) {
        score += 30;
        signals.push("每一段都有 " + Math.round(cover * 100) + "%");
      } else if (cover >= 0.5) {
        score += 20;
        signals.push("过半的段 " + Math.round(cover * 100) + "%");
      } else if (cover < 0.2) {
        score -= 20;
        signals.push("只在 " + t.inSections.size + " 段出现");
      }

      const dims = Object.keys(t.usedAs).length;
      if (t.usedAs.text || t.usedAs.border) {
        score += 25;
        signals.push("当文字或边框");
      }
      if (dims >= 3) {
        score += 15;
        signals.push(dims + " 种用途");
      }
      if (dims === 1 && t.usedAs.bg) {
        score -= 15;
        signals.push("只拿来铺底");
      }

      if (declared.has(t.hex) || declared.has("rgb(" + t.rgb.join(", ") + ")")) {
        score += 20;
        signals.push("有变量名");
      }

      if (t.n >= 500) {
        score += 20;
        signals.push("出现 " + t.n + " 次");
      } else if (t.n >= 50) {
        score += 10;
        signals.push("出现 " + t.n + " 次");
      } else if (t.n <= 5) {
        score -= 20;
        signals.push("只出现 " + t.n + " 次");
      }

      const r = t.rgb[0];
      const g = t.rgb[1];
      const b = t.rgb[2];
      if (Math.max(r, g, b) - Math.min(r, g, b) <= 25) {
        score += 10;
        signals.push("无彩色");
      }

      /* ⚠️ AREA OVERRIDES EVERY OTHER SIGNAL.

         The scoring signals above all ask 「how was this written?」 — how many
         elements declare it, whether it also colours text, whether it has a
         variable name. Those are good proxies on a page whose CSS repeats
         itself, and they are wrong on a page built out of tokens: our ground
         is authored ONCE and inherited, so it scored 「只在 1 段出现 · 只拿来铺底」
         and came back as 「content」 — the colour of the entire page, filed as
         this month's poster.

         Painted area cannot be gamed by authoring style. A colour covering a
         third of the page IS the design, however few rules declare it. */
      const areaShare = (t.usedAs.bg || 0) * 10000 / pageArea;
      if (areaShare >= 0.33) { score = Math.max(score, 60); signals.push("铺满 " + Math.round(areaShare * 100) + "% 的页面"); }
      else if (areaShare >= 0.08) { score = Math.max(score, 30); signals.push("铺了 " + Math.round(areaShare * 100) + "% 的页面"); }

      const layer =
        score >= 60 ? "infrastructure" : score >= 30 ? "system" : score >= 0 ? "campaign" : "content";
      return {
        area: Math.round(areaShare * 100),
        hex: t.hex,
        n: t.n,
        usedAs: t.usedAs,
        sections: t.inSections.size,
        layer,
        score,
        signals,
      };
    })
    .sort((a, b) => b.n - a.n);

  return {
    motion: {
      tiers: Object.entries(tiers)
        .map(([k, v]) => ({ tier: k, ms: [...v.values].sort((a, b) => a - b), n: v.n }))
        .sort((a, b) => a.ms[0] - b.ms[0]),
      easings: count(easings).slice(0, 4),
      properties: [...moved].slice(0, 8),
      animations: [...animations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      reducedMotion,
      sheetsRead,
      sheetsBlocked,
    },
    space: {
      baseUnit: base,
      sample: (() => {
        const m = {};
        for (const n of pads.concat(gaps)) m[n] = (m[n] || 0) + 1;
        return Object.entries(m).map(([k, v]) => [Number(k), v]).sort((a, b) => b[1] - a[1]).slice(0, 20);
      })(),
      padScale: [...new Set(pads)].sort((a, b) => a - b).slice(0, 14),
      gapScale: [...new Set(gaps)].sort((a, b) => a - b).slice(0, 14),
      topPads: count(pads).slice(0, 5),
    },
    colours: colours.slice(0, 12),
    sectionCount: sections.length,
  };
}

/* ── 动效 MOTION：真的动了什么，不是宣告了什么 ─────────────────────────────

   老板 2026-08-29: 「动效只量了「宣告了什么」，没量「真的动了什么」…
   你看看要这么去修」.

   readAxes 读的是 CSS 文本里的 transition-duration 跟 easing —— 那是**写了
   什么**。一条写了 400ms 的 transition，可能挂在一个从来不变的属性上；一段
   滚动进场，可能整页只有第一屏有。两者印出来的数字一模一样。

   这里量的是**位置真的变了多少**，做法是把页面当成一个访客来用：

     · 进场：先滚到顶，记下还在视窗外那些块的 opacity 跟 transform；把它们滚
       进视窗、等它演完，再记一次。变了的就是会进场的块，位移是量出来的 px。
     · hover：用真的鼠标停在第一颗按钮跟第一张图上（CSS 的 :hover 只有真的
       指针触发得了，dispatchEvent 不行），前后各读一次 transform / 阴影 /
       底色 / filter。

   ⚠️ 它量不到「好不好看」，只量「有没有动、动多远」。判断一套风格的动效对不对
   还是眼睛的事（重点 7c）。 */
async function probeMotion(p, rootSel) {
  try {
    /* 回到顶端，让还没进场的块回到它们的起点。reload 比 scrollTo(0) 干净：
       已经播过一次的进场动画不会倒带。 */
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2600);

    const before = await p.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) return [];
      const vh = window.innerHeight;
      const out = [];
      let i = 0;
      for (const el of root.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        /* 只看还在视窗下面、而且够大的块 —— 第一屏的东西已经演完了。 */
        if (r.top < vh + 40 || r.height < 60 || r.width < 200) continue;
        el.setAttribute("data-motion-probe", String(i));
        const cs = getComputedStyle(el);
        out.push({ i, op: Number(cs.opacity), tf: cs.transform, top: Math.round(r.top + scrollY) });
        i++;
        if (i >= 60) break;
      }
      return out;
    }, rootSel);

    for (let y = 0; y < 12; y++) {
      await p.evaluate((k) => window.scrollTo(0, k * window.innerHeight * 0.7), y);
      await p.waitForTimeout(260);
    }
    await p.waitForTimeout(1200);

    const after = await p.evaluate(() =>
      [...document.querySelectorAll("[data-motion-probe]")].map((el) => {
        const cs = getComputedStyle(el);
        return { i: Number(el.getAttribute("data-motion-probe")), op: Number(cs.opacity), tf: cs.transform };
      }),
    );

    const shift = (a, b) => {
      /* ⚠️ 「none」不是「量不到」，是「没有位移」—— 当成单位矩阵。

         第一版在这里回传一个常数 60，理由是「none → matrix 也是动」。跑出来
         台账 · 图纸 · 満図 三套整整齐齐都是「位移 60px」—— 那不是量出来的，
         那是我自己写的哨兵，印出来跟一个真的读数一模一样。这个仓库反覆栽在
         同一件事上：一把坏掉的尺照样印出一个看起来可信的数字。 */
      const num = (t) => (t && t !== "none" ? t.replace(/^matrix\w*\(|\)$/g, "").split(",").map(Number) : [1, 0, 0, 1, 0, 0]);
      const A = num(a), B = num(b);
      const ax = A.length === 6 ? A[4] : A[12], ay = A.length === 6 ? A[5] : A[13];
      const bx = B.length === 6 ? B[4] : B[12], by = B.length === 6 ? B[5] : B[13];
      return Math.round(Math.hypot((bx ?? 0) - (ax ?? 0), (by ?? 0) - (ay ?? 0)));
    };
    const byI = new Map(after.map((x) => [x.i, x]));
    let entered = 0, faded = 0, maxShift = 0;
    for (const b of before) {
      const a = byI.get(b.i);
      if (!a) continue;
      const d = shift(b.tf, a.tf);
      const fade = a.op - b.op > 0.15;
      if (fade) faded++;
      if (d >= 4 || fade) entered++;
      maxShift = Math.max(maxShift, d);
    }

    /* hover —— 真的把指针停上去。 */
    const hover = async (sel) => {
      const h = await p.$(sel);
      if (!h) return null;
      const read = () => h.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { tf: cs.transform, sh: cs.boxShadow, bg: cs.backgroundColor, fl: cs.filter, op: cs.opacity };
      });
      try {
        await h.scrollIntoViewIfNeeded({ timeout: 3000 });
        const a = await read();
        await h.hover({ timeout: 3000 });
        await p.waitForTimeout(700);
        const b = await read();
        const bits = [];
        if (shift(a.tf, b.tf) >= 2 || (a.tf !== b.tf && a.tf !== "none")) bits.push("变形");
        if (a.sh !== b.sh) bits.push("阴影");
        if (a.bg !== b.bg) bits.push("底色");
        if (a.fl !== b.fl) bits.push("滤镜");
        if (Math.abs(Number(a.op) - Number(b.op)) > 0.05) bits.push("淡");
        return bits.length ? bits.join("+") : "不动";
      } catch {
        return null;
      }
    };
    /* ⚠️ 「第一个 a[href]」不是「第一颗按钮」。Wix 的页面第一个连结是顶栏里
       一个透明的文字连结，停上去当然什么都不动，而那一格会印出「量不到」或者
       「不动」—— 两个都是假的。用跟 readShape 同一条规则挑：可以点的、有自己
       的底或框、高度像一个控件。挑到了就在它身上做记号再 hover。 */
    const tagged = await p.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) return { btn: false, img: false };
      let btn = false, img = false;
      for (const el of root.querySelectorAll("a,button,[role=button]")) {
        const r = el.getBoundingClientRect();
        if (r.height < 24 || r.height > 96 || r.width < 60) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const painted = cs.backgroundColor && !/(^rgba\(0, 0, 0, 0\)$|transparent)/.test(cs.backgroundColor);
        const framed = parseFloat(cs.borderTopWidth) > 0;
        if (!painted && !framed) continue;
        el.setAttribute("data-hover-probe", "btn");
        btn = true;
        break;
      }
      for (const el of root.querySelectorAll("img")) {
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 120) continue;
        el.setAttribute("data-hover-probe", "img");
        img = true;
        break;
      }
      return { btn, img };
    }, rootSel);
    const btn = tagged.btn ? await hover('[data-hover-probe="btn"]') : "没有这种按钮";
    const img = tagged.img ? await hover('[data-hover-probe="img"]') : "没有够大的图";

    return { probed: before.length, entered, faded, maxShift, btn, img };
  } catch {
    return null;
  }
}

async function shoot(target, rootSel, wait, file) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await p.goto(target, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toolbar]{display:none!important}" }).catch(() => {});
  await p.waitForTimeout(wait);
  // Lazy images only load once they have been in view.
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(2500);
  const secs = await p.evaluate(readSections, rootSel);
  const type = await p.evaluate(readType);
  const axes = await p.evaluate(readAxes, rootSel);
  const anat = await p.evaluate(readAnatomy, rootSel);
  const shots = await p.evaluate(readShots, rootSel);
  const shape = await p.evaluate(readShape, rootSel);
  await p.screenshot({ path: `${OUT}/${file}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
  const move = await probeMotion(p, rootSel);
  await p.close();
  return { secs, type, axes, anat, shots, shape, move };
}

try {
  const theirs = await shoot(url, null, 7000, `${register}-ref`);
  const ours = await shoot(`http://localhost:3000/s/${project.site_slug}`, ".ds-site", 2500, `${register}-ours`);

  /* ── 一份差异清单，不是一份读数 ────────────────────────────────────────────
     老板 2026-08-28: 「那就重写全部的尺子 确保能复刻到一模一样」「如果复刻不到
     就补尺子 看看到底哪里没有测量好」.

     The old report printed both sides and left the comparing to whoever read
     it, which is how four registers shipped with matching section counts and
     entirely different colours: nothing in the output ever said 「这一项不一样」.

     Every line below is a CHECK with a verdict. A check that cannot be made
     says 量不到 rather than passing quietly — an unmeasured axis is where the
     next difference will hide, and the founder's instruction is that the gap
     itself is the finding. */
  const marks = [];
  const check = (axis, name, theirsV, oursV, ok) => {
    marks.push({ axis, name, ok });
    const flag = ok === null ? "?" : ok ? "OK" : "XX";
    console.log(
      `  ${flag}  ${name.padEnd(16)} 模版 ${String(theirsV).padEnd(30)} 我们 ${oursV}`,
    );
  };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  const row = (s, i) => `${String(i + 1).padStart(2)}  ${String(s.h).padStart(5)}px  ${String(s.img).padStart(2)}img  ${s.text}`;
  const sum = (l) => l.reduce((a, s) => a + s.h, 0);
  console.log(`\n参考 ${url}\n${theirs.secs.map(row).join("\n")}\n  = ${theirs.secs.length} 段 ${sum(theirs.secs)}px`);
  console.log(`\n我们 ${register}\n${ours.secs.map(row).join("\n")}\n  = ${ours.secs.length} 段 ${sum(ours.secs)}px`);

  /* ── 1 版面 LAYOUT ─────────────────────────────────────────────────────── */
  console.log("\n版面 LAYOUT");
  /* ⚠️ 顶栏不算一段。Wix folds its navigation into the first section's box and
     ours is a sibling, so an identical page reads as 「他们 6 段，我们 7 段」 — a
     difference the ruler was creating rather than finding. Anything under 120px
     at the very top is chrome. */
  const bodySecs = (l) => (l.length && l[0].h < 120 ? l.slice(1) : l);
  const ts = bodySecs(theirs.secs);
  const os_ = bodySecs(ours.secs);
  check("版面", "段数", ts.length, os_.length, near(ts.length, os_.length, 1));
  check("版面", "整页高", `${sum(theirs.secs)}px`, `${sum(ours.secs)}px`,
    near(sum(theirs.secs), sum(ours.secs), sum(theirs.secs) * 0.25));
  /* ── 段均高 —— 最晚才量到的一项，而它是最大的那个差 ────────────────────────
     老板 2026-08-28，看完三张对照图：「根本不一样哦 简直不能说是模版抄出来的」·
     「我叫你对齐的东西 你完全没有去对齐啊」. He was right and nothing in the
     checklist could see it: 段数 matched, 整页高 was inside tolerance, 段间 was
     0 on both sides — and their sections were two and a half times as tall as
     ours. A page of the same eight arguments in thin strips is not that page.

         招牌  他们段均 1434px  我们 617px   2.3 倍
         图纸        900        549        1.6
         台账 / 瑞士 / 中台                  1.3

     Height per section is where a reference's air actually lives, and it was
     the one number nobody had asked for. */
  const mean = (l) => (l.length ? Math.round(l.reduce((a, s) => a + s.h, 0) / l.length) : 0);
  check("版面", "段均高", `${mean(ts)}px`, `${mean(os_)}px`, mean(ts) === 0 || mean(os_) / mean(ts) >= 0.8);

  /* ── 逐段的高度，一段对一段 ────────────────────────────────────────────────
     老板 2026-08-29, holding up 台账 while this checklist reported 0 差异:
     「你自己用眼睛看 一样吗」. It was not. Their Recent Projects is 2198px of tidy
     grid; ours had become 4442px of enormous tiles — TWICE their section — and
     every check passed, because 段均高 is an average and one section at double
     size hides inside it when the others are short.

     An average is not a comparison. Each section is compared to its opposite
     number now, and a section more than 40% out is a failure on its own. */
  for (let i = 0; i < Math.min(ts.length, os_.length); i++) {
    const a = ts[i].h;
    const b = os_[i].h;
    const ok = a === 0 || (b / a >= 0.6 && b / a <= 1.6);
    if (!ok) check("版面", `第${i + 1}段高`, `${a}px`, `${b}px`, false);
    else marks.push({ axis: "版面", name: `第${i + 1}段高`, ok: true });
  }

  const imgs = (l) => l.reduce((a, s) => a + s.img, 0);
  check("版面", "照片张数", imgs(theirs.secs), imgs(ours.secs), near(imgs(theirs.secs), imgs(ours.secs), 3));

  /* ── 2 照片 SHOTS —— 大小，不只是张数 ──────────────────────────────────── */
  const band = (l) => ({
    wide: l.filter((x) => x.w >= 1200).length,
    half: l.filter((x) => x.w >= 500 && x.w < 1200).length,
    small: l.filter((x) => x.w < 500).length,
    tallest: l.length ? Math.max(...l.map((x) => x.h)) : 0,
  });
  const bt = band(theirs.shots);
  const bo = band(ours.shots);
  console.log("\n照片 SHOTS");
  check("照片", "满宽的", bt.wide, bo.wide, near(bt.wide, bo.wide, 1));
  check("照片", "半幅的", bt.half, bo.half, near(bt.half, bo.half, 2));
  check("照片", "最高一张", `${bt.tallest}px`, `${bo.tallest}px`, near(bt.tallest, bo.tallest, 220));
  console.log(`      模版 ${theirs.shots.slice(0, 7).map((x) => `${x.w}×${x.h}`).join(" ") || "无"}`);
  console.log(`      我们 ${ours.shots.slice(0, 7).map((x) => `${x.w}×${x.h}`).join(" ") || "无"}`);

  /* ── 3 字体 TYPE ───────────────────────────────────────────────────────── */
  const h1 = (t) => (t.heads[0] || {});
  console.log("\n字体 TYPE");
  check("字体", "标题字体", h1(theirs.type).fam ?? "—", h1(ours.type).fam ?? "—", null);
  check("字体", "标题字级", `${h1(theirs.type).px}px`, `${h1(ours.type).px}px`,
    near(h1(theirs.type).px || 0, h1(ours.type).px || 0, 12));
  check("字体", "标题字重", h1(theirs.type).w ?? "—", h1(ours.type).w ?? "—",
    String(h1(theirs.type).w) === String(h1(ours.type).w));
  check("字体", "正文字体", theirs.type.bodyFam, ours.type.bodyFam, null);
  if (process.env.ALIGN_DEBUG) {
    console.log("      模版样本 " + (theirs.type.bodySamples || []).join(" | "));
    console.log("      我们样本 " + (ours.type.bodySamples || []).join(" | "));
  }
  /* ⚠️ 样本少於三段就不判。一页上只有两段够长的文字，「最常见的正文字级」量的
     不是这一页的正文，是这两段里比较小的那一个 —— 而它一样会印出一个数字，
     跟一把好尺印出来的一模一样。少於三段本身也是一个读数：这一页几乎没有
     可以读的整段文字，那件事该用眼睛看，不该由这一行冒充回答。 */
  const thinSample = (theirs.type.bodyN ?? 0) < 3 || (ours.type.bodyN ?? 0) < 3;
  check("字体", "正文字级", `${theirs.type.bodyPx}px`, `${ours.type.bodyPx}px`,
    thinSample ? null : near(Number(theirs.type.bodyPx) || 0, Number(ours.type.bodyPx) || 0, 3));
  if (thinSample) {
    console.log(`      （够长的整段文字：模版 ${theirs.type.bodyN} 段 · 我们 ${ours.type.bodyN} 段 —— 少於三段，这一项不判）`);
  }
  if (h1(theirs.type).here === false) {
    console.log("      ⚠️ 模版的字这台机器没载入到 —— 上面那两行字体名是宣告的，不是画面上的");
  }

  /* ── 4 颜色 COLOR —— 面积，不是声明次数 ───────────────────────────────── */
  /* ── 结构 SHAPE：一段里面有哪些盒子，一段对一段 ──────────────────────────
     老板 2026-08-29: 「是准确了 可是还不是100%」. 剩下的每一个差异都在一段的
     里面，而上面每一项量的都是一段的外面。readShape 的注解写了那五个实例。

     判什么：这一段有几个图 / 几颗按钮 / 几栏字，配对得上的那些左右位置差多少。
     不判什么：好不好看、字写什么、照片拍的是什么。 */
  console.log("\n结构 SHAPE  （一段里面有哪些盒子，图 · 钮 · 字）");
  {
    const bodyShape = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
    const TS = bodyShape(theirs.shape ?? [], theirs.secs);
    const OS = bodyShape(ours.shape ?? [], ours.secs);
    const line = (bs) =>
      bs
        .slice(0, 9)
        .map((b) => (b.kind === "钮" ? `钮${b.rad}` : b.kind) + ` ${b.x0}–${b.x1}`)
        .join("  ") || "（空）";
    const count = (bs, k) => bs.filter((b) => b.kind === k).length;
    /* ── 版心：内容从页面的百分之几开始，到百分之几结束 ──────────────────
       这一条是这把尺第一次跑就抓到的、而且最大的一件：瑞士 整页的内容跑
       7%–93%，我们 14%–86%。两边各差 7 个点，那不是某一段的事，是版心
       本身窄了 200px。段高一样、张数一样、字级一样，所以以前每一项都过。 */
    const edge = (SS) => {
      const l = [], r = [];
      for (const bs of SS) {
        if (!bs.length) continue;
        l.push(Math.min(...bs.map((b) => b.x0)));
        r.push(Math.max(...bs.map((b) => b.x1)));
      }
      if (!l.length) return null;
      l.sort((a, b) => a - b); r.sort((a, b) => a - b);
      return [l[Math.floor(l.length / 2)], r[Math.floor(r.length / 2)]];
    };
    const et = edge(TS), eo = edge(OS);
    if (et && eo) {
      check("结构", "版心", `${et[0]}%–${et[1]}%`, `${eo[0]}%–${eo[1]}%`,
        Math.abs((et[1] - et[0]) - (eo[1] - eo[0])) <= 6);
    }

    for (let i = 0; i < Math.max(TS.length, OS.length); i++) {
      const t = TS[i];
      const o = OS[i];
      if (!t || !o) {
        console.log(`  --  第${i + 1}段  ` + (!t ? "模版没有这一段" : "我们没有这一段"));
        marks.push({ axis: "结构", name: `第${i + 1}段结构`, ok: null });
        continue;
      }
      /* 一段里几十栏字是内容长短的事，不是设计的事 —— 只判图跟按钮的个数，
         字那一栏印出来给眼睛看。张数差一个之内算对上：一张图被包成两个盒子、
         或者他们多一行小字，都不该判成「结构不同」。 */
      const dImg = Math.abs(count(t, "图") - count(o, "图"));
      const dBtn = Math.abs(count(t, "钮") - count(o, "钮"));
      /* 圆角是形状不是装饰：方角的按钮跟药丸是两个设计（重点 7c）。 */
      const rads = (bs) => [...new Set(bs.filter((b) => b.kind === "钮").map((b) => b.rad))].sort().join("");
      const dRad = count(t, "钮") && count(o, "钮") && rads(t) !== rads(o);
      /* 最宽的那张图占这一段多宽 —— 满边（≥96%）跟缩在版心里（≈90%）
         是两个决定，而两个都不改变段高，所以上面每一项都看不到。 */
      const widest = (bs) => bs.filter((b) => b.kind === "图").reduce((m, b) => Math.max(m, b.x1 - b.x0), 0);
      const dSpan = widest(t) && widest(o) ? Math.abs(widest(t) - widest(o)) : 0;
      const bad = [];
      if (dImg > 1) bad.push(`图 ${count(t, "图")}对${count(o, "图")}`);
      if (dBtn > 1) bad.push(`钮 ${count(t, "钮")}对${count(o, "钮")}`);
      if (dRad) bad.push(`钮的圆角 ${rads(t)}对${rads(o)}`);
      if (dSpan > 12) bad.push(`最宽的图 ${widest(t)}%对${widest(o)}%`);
      const ok = bad.length === 0;
      console.log(`  ${ok ? "OK" : "XX"}  第${i + 1}段  ${ok ? "" : "← " + bad.join(" · ")}`);
      console.log(`        模版 ${line(t)}`);
      console.log(`        我们 ${line(o)}`);
      marks.push({ axis: "结构", name: `第${i + 1}段结构`, ok });
    }
  }

  /* ── 颜色，逐段量，而且判在同一张表里 ────────────────────────────────────
     老板 2026-08-28: 「就是每个颜色 分段去测量」.

     Two holes closed at once. Colour used to be PRINTED and never judged — and
     colour is exactly where four registers went out with matching section
     counts and a different page. And a whole-page average can match while every
     section is wrong: 40% white / 25% dark is equally true of 「a white page
     with two dark bands」 and of 「a dark page with two white bands」, which are
     opposite designs. So the unit is the SECTION, and the verdict lands here
     rather than in a second command nobody runs. */
  try {
    const out = execSync(`python scripts/align-palette.py ${register}`, {
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    console.log("\n颜色 COLOR  （逐段量截图，按铺出来的面积）");
    for (const raw of out.split("\n")) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      console.log("  " + line.trim());
      const m = /^(OK|XX|--)\\s+第(\d+)段/.exec(line.trim());
      if (m) marks.push({ axis: "颜色", name: `第${m[2]}段底色`, ok: m[1] === "OK" ? true : m[1] === "--" ? null : false });
    }
  } catch (e) {
    console.log("\n颜色 COLOR  量不到 —— align-palette.py 跑不起来：" + String(e).slice(0, 90));
    marks.push({ axis: "颜色", name: "逐段底色", ok: null });
  }
  console.log("\n颜色 COLOR  （声明层，仅供参考）");
  const stack = (a) => {
    if (!a) return "—";
    const by = {};
    for (const c of a.colours) (by[c.layer] = by[c.layer] || []).push(c.hex);
    return ["infrastructure", "system"].filter((l) => by[l]).map((l) => `${l}: ${by[l].slice(0, 4).join(" ")}`).join(" | ");
  };
  console.log(`      模版 ${stack(theirs.axes)}`);
  console.log(`      我们 ${stack(ours.axes)}`);

  /* ── 5 动效 MOTION ─────────────────────────────────────────────────────── */
  const tiers = (a) => (a ? a.motion.tiers.map((x) => `${x.tier}${x.ms.join("/")}`).join(" ") : "—");
  const ease = (a) => (a && a.motion.easings[0] ? a.motion.easings[0][0] : "—");
  /* ⚠️ 比「最常出现的那一档」，不是比最长的那一档。台账的参考页有一个 600ms 的
     过渡出现十次，跟 200/300ms 出现六十八次 —— 拿最长的去比，我们把主要那一档
     调成跟他们一样之后反而被判成对不上。一页的动效是它重复最多的那个长度。 */
  const dominant = (a) => {
    if (!a || !a.motion.tiers.length) return 0;
    const top = [...a.motion.tiers].sort((x, y) => y.n - x.n)[0];
    return top.ms[Math.floor(top.ms.length / 2)] ?? 0;
  };
  console.log("\n动效 MOTION");
  check("动效", "时长", tiers(theirs.axes), tiers(ours.axes), near(dominant(theirs.axes), dominant(ours.axes), 90));
  check("动效", "缓动", ease(theirs.axes), ease(ours.axes), ease(theirs.axes) === ease(ours.axes));
  check("动效", "减少动效", theirs.axes?.motion.reducedMotion, ours.axes?.motion.reducedMotion,
    Boolean(theirs.axes?.motion.reducedMotion) === Boolean(ours.axes?.motion.reducedMotion));

  /* 上面三项读的是**宣告**，下面三项读的是**真的动了什么**。
     一条挂在从来不变的属性上的 400ms transition，跟一段真的会滑进来的区块，
     在上面三项里印出来一模一样。 */
  {
    const t = theirs.move, o = ours.move;
    const enter = (m) =>
      !m ? "量不到" : m.entered === 0 ? `不动（试了 ${m.probed} 块）` : `${m.entered}/${m.probed} 块 · 位移 ${m.maxShift}px${m.faded ? " · 淡入" : ""}`;
    /* 判「有没有」而不是「几块」—— 块数是这一页有多少区段的事。
       位移差 20px 以内算同一种进场：24 跟 32 是同一个手势，24 跟 0 不是。 */
    const has = (m) => Boolean(m && m.entered > 0);
    check("动效", "滚动进场", enter(t), enter(o),
      t && o ? has(t) === has(o) && (!has(t) || Math.abs(t.maxShift - o.maxShift) <= 20) : null);
    check("动效", "按钮 hover", t?.btn ?? "量不到", o?.btn ?? "量不到",
      t?.btn && o?.btn ? t.btn === o.btn : null);
    check("动效", "图片 hover", t?.img ?? "量不到", o?.img ?? "量不到",
      t?.img && o?.img ? t.img === o.img : null);
  }

  /* ── 6 留白 SPACE ──────────────────────────────────────────────────────── */
  const gaps = (secs) => secs.slice(1).map((s2, i2) => s2.top - (secs[i2].top + secs[i2].h));
  const biggestGap = (secs) => Math.max(0, ...gaps(secs).filter((g) => g >= 0));
  console.log("\n留白 SPACE");
  check("留白", "段间最大", `${biggestGap(theirs.secs)}px`, `${biggestGap(ours.secs)}px`,
    near(biggestGap(theirs.secs), biggestGap(ours.secs), 24));
  const inset = (l) => (l.length ? Math.min(...l.map((x) => x.pad ?? 0)) : 0);
  /* ── 段内的气：一段里内容上下各留多少 ──────────────────────────────────
     这一项换掉了「间距基数」，而换掉的理由是量出来的（2026-08-29）。

     基数那一项六套全部回报「量不到」，我原本以为是尺子写坏了。把样本印出来
     才知道是问题本身错了：

       模版（Wix）  15×9  7×8  10×8  27×7  11×6  20×6  32×6  4×4  24×4  8×2  12×2  31×2
       我们         20×19 8×14 96×12 11×8  10×6  31×6  6×4  24×3  9×2  16×2  18×2  23×2

     15 · 7 · 27 · 11 · 31 不是任何东西的倍数。Wix 是**拖出来的**，不是照阶梯
     排出来的，所以那一页根本没有基数。design-md-generator 报得出「基数 4」是
     因为它读**写在 CSS 里的值**；我们读**算出来的值**，而 rem 乘根字号跟
     百分比的行会算出 11 跟 31。同一根轴，两个不同的问题。

     留白在这种页面上真正的决定是：**一段里，内容的上下各空掉这一段的百分之
     几**。它是设计的一部分（他们的 Our Story 是一句话浮在一大片气里），而且
     两边可比 —— readShape 已经把每个盒子相对这一段的 y 位置量出来了。 */
  {
    const bodyAir = (l, secsL) => (secsL.length && secsL[0].h < 120 ? l.slice(1) : l);
    const air = (SS) => {
      const top = [], bot = [];
      for (const bs of SS) {
        if (bs.length < 2) continue;
        top.push(Math.max(0, Math.min(...bs.map((b) => b.y0))));
        bot.push(Math.max(0, 100 - Math.max(...bs.map((b) => b.y1))));
      }
      if (!top.length) return null;
      const mid = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
      return [mid(top), mid(bot)];
    };
    const at = air(bodyAir(theirs.shape ?? [], theirs.secs));
    const ao = air(bodyAir(ours.shape ?? [], ours.secs));
    check("留白", "段内的气", at ? `上 ${at[0]}% 下 ${at[1]}%` : "量不到", ao ? `上 ${ao[0]}% 下 ${ao[1]}%` : "量不到",
      at && ao ? Math.abs(at[0] - ao[0]) <= 8 && Math.abs(at[1] - ao[1]) <= 8 : null);
    if (process.env.ALIGN_DEBUG) {
      const show = (a) => (a?.space.sample ?? []).map(([v, n]) => `${v}×${n}`).join(" ");
      console.log("      间距样本 模版 " + show(theirs.axes));
      console.log("      间距样本 我们 " + show(ours.axes));
    }
  }

  /* ── 结论 ──────────────────────────────────────────────────────────────── */
  const bad = marks.filter((m) => m.ok === false);
  const unknown = marks.filter((m) => m.ok === null);
  console.log(
    `\n对不上的 ${bad.length} 项：${bad.map((b) => b.name).join(" · ") || "无"}` +
      `\n量不到的 ${unknown.length} 项：${unknown.map((b) => b.name).join(" · ") || "无"}` +
      `\n⚠️ 「量不到」不是「过关」—— 下一个差异就藏在那几项里。`,
  );

  fs.writeFileSync(`${OUT}/${register}.json`, JSON.stringify({ url, theirs, ours }, null, 1));

  console.log(`\n对照图 → ${OUT}/${register}.jpg （用眼睛看这一张，不是看上面的数字）`);
} finally {
  await browser.close();
  await restore();
}

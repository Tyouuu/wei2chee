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

function readType() {
  return [...document.querySelectorAll("h1,h2")]
    .map((h) => ({
      t: (h.innerText || "").trim().slice(0, 26),
      px: Math.round(parseFloat(getComputedStyle(h).fontSize)),
    }))
    .filter((x) => x.t);
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
      padScale: [...new Set(pads)].sort((a, b) => a - b).slice(0, 14),
      gapScale: [...new Set(gaps)].sort((a, b) => a - b).slice(0, 14),
      topPads: count(pads).slice(0, 5),
    },
    colours: colours.slice(0, 12),
    sectionCount: sections.length,
  };
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
  await p.screenshot({ path: `${OUT}/${file}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
  await p.close();
  return { secs, type, axes };
}

try {
  const theirs = await shoot(url, null, 7000, `${register}-ref`);
  const ours = await shoot(`http://localhost:3000/s/${project.site_slug}`, ".ds-site", 2500, `${register}-ours`);

  const row = (s, i) => `${String(i + 1).padStart(2)}  ${String(s.h).padStart(5)}px  ${String(s.img).padStart(2)}img  ${s.text}`;
  const sum = (l) => l.reduce((a, s) => a + s.h, 0);
  console.log(`\n参考 ${url}\n${theirs.secs.map(row).join("\n")}\n  = ${theirs.secs.length} 段 ${sum(theirs.secs)}px`);
  console.log(`\n我们 ${register}\n${ours.secs.map(row).join("\n")}\n  = ${ours.secs.length} 段 ${sum(ours.secs)}px`);
  console.log(`\n字级 TYPE   参考 ${theirs.type.map((t) => t.px).join("/")}`);
  console.log(`           我们 ${ours.type.map((t) => t.px).join("/")}`);

  /* ── 五根轴的另外两根 ─────────────────────────────────────────────────────
     重点 7i: 版面 · 字体 · 颜色 · 动效 · 留白. The first two are printed above
     and the third is the section list; these are the two this ruler was blind
     to until 2026-08-28, which is exactly why 台账's first pass matched the
     section counts and still looked nothing like its reference. */
  const motion = (a) => {
    if (!a) return "—";
    const t = a.motion.tiers.map((x) => `${x.tier} ${x.ms.join("/")}ms×${x.n}`).join(" · ");
    const e = a.motion.easings.map(([v, n]) => `${v}×${n}`).join(" · ");
    const an = a.motion.animations.map(([n2, c]) => `${n2}×${c}`).join(" · ") || "无";
    const rm =
      a.motion.sheetsBlocked && !a.motion.reducedMotion
        ? `读不到（${a.motion.sheetsBlocked} 张外站样式表）`
        : a.motion.reducedMotion
          ? "有"
          : "没有";
    return [
      t || "没有过渡",
      `           缓动 ${e || "—"}`,
      `           动的属性 ${a.motion.properties.join(" ") || "—"}`,
      `           keyframe ${an}`,
      `           减少动效 ${rm}`,
    ].join("\n");
  };
  console.log(`\n动效 MOTION 参考 ${motion(theirs.axes)}`);
  console.log(`\n           我们 ${motion(ours.axes)}`);

  const space = (a, secs) => {
    if (!a) return "—";
    const between = secs
      .slice(1)
      .map((s2, i2) => s2.top - (secs[i2].top + secs[i2].h))
      .filter((g) => g >= 0);
    return `基数 ${a.space.baseUnit ? a.space.baseUnit + "px" : "量不出来"} · 段间 ${between.join("/") || "0"} · 内距常用 ${a.space.topPads
      .map(([v, n]) => `${v}×${n}`)
      .join(" ")}`;
  };
  console.log(`\n留白 SPACE  参考 ${space(theirs.axes, theirs.secs)}`);
  console.log(`           我们 ${space(ours.axes, ours.secs)}`);

  /* ── 四层稳定性 ──────────────────────────────────────────────────────────
     design-md-generator's method (MIT; a method is not copyrightable), with its
     「how many pages」 signal replaced by 「how many sections」 because we measure
     one page. It answers one question — 「will this value still be correct in
     six months?」 — and that is the question I failed on 任务 26: I read one
     PROMOTIONAL screenshot as a rule, wrote 「prices go on the first screen」,
     shipped it, and 19 trading sites later 0 of 19 agreed. RM60 was a campaign
     value. This is the check that would have caught it before it shipped. */
  const stack = (a) => {
    if (!a) return "—";
    const by = {};
    for (const c of a.colours) (by[c.layer] = by[c.layer] || []).push(c);
    return ["infrastructure", "system", "campaign", "content"]
      .filter((l) => by[l])
      .map((l) => `${l} ${by[l].length}：` + by[l].slice(0, 5).map((c) => c.hex).join(" "))
      .join("\n           ");
  };
  console.log(`\n颜色 COLOR  参考 ${stack(theirs.axes)}`);
  console.log(`\n           我们 ${stack(ours.axes)}`);

  const campaign = (a, who) => {
    const c = (a?.colours || []).filter((x) => x.layer === "campaign" || x.layer === "content");
    if (!c.length) return;
    console.log(`\n⚠️ ${who}这几个颜色像「这个月的海报」不像设计 —— 抄之前先想六个月后还在不在：`);
    for (const x of c.slice(0, 4)) console.log(`   ${x.hex}  ${x.layer}  ${x.signals.join(" · ")}`);
  };
  campaign(theirs.axes, "参考：");
  campaign(ours.axes, "我们：");

  fs.writeFileSync(`${OUT}/${register}.json`, JSON.stringify({ url, theirs, ours }, null, 1));
  console.log(`\n对照图 → ${OUT}/${register}.jpg （用眼睛看这一张，不是看上面的数字）`);
} finally {
  await browser.close();
  await restore();
}

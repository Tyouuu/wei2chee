// Reads every piece of text a customer can see and reports two things it can
// only find by looking at the pixels.
//
//   npm run check:contrast
//
// WHY IT EXISTS. 漆 was the first register whose ground is a colour and 砖 the
// first whose ground is a pattern, and between them they exposed a class of
// fault that nineteen near-white registers had hidden: a record table with no
// surface of its own, a page title sitting on the ground rather than in a
// panel, and pulled sections that paint no background at all because upstream
// they sit on a page body that already does.
//
// None of those threw. 146 tests were green through every one of them. The
// only thing that finds them is reading what is actually painted, which is
// what this does — walking up to the first ancestor that paints something
// opaque rather than trusting the class that was meant to.
//
// TWO CHECKS, because contrast alone is not enough. The second one REPORTS
// rather than fails: a 26px page title over a figure at 20% opacity is a
// judgement somebody can make, and a 13px table row over the same figure is
// not. The size is printed so the difference is readable at a glance.
//
// 砖's first render had its tile showing straight through a table's data rows
// and every ratio still passed. A figure belongs around the work, never under
// it — that is the rule the registers state for themselves, and this is it as
// a check.
//
// Needs `npm run dev` on :3000 and the renovation demo account.

import { chromium } from "playwright";

const AUDIT = () => {
  // LET THE BROWSER DO THE COLOUR MATH.
  //
  // The first version parsed `rgba(...)` with a regex and returned null for
  // anything else — so every Tailwind v4 opacity modifier, which computes to
  // `oklab(0.98 0.0008 0.008 / 0.8)`, was invisible to it. The walker then
  // skipped a perfectly good 80%-ivory header and reported its text as sitting
  // four ancestors further up: 92 phantom failures, and the bug was in here.
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  const parse = (s) => {
    if (!s || s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = s;
    ctx.globalCompositeOperation = "copy";
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
  };
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const scope = document.querySelector(".ds-ground");
  // Only walk for a pattern when the register actually has one. Without this
  // the second check costs a getComputedStyle per ancestor per text node on
  // every register, and on the website page that ran past ten minutes.
  const groundIsPatterned = scope
    ? getComputedStyle(scope).getPropertyValue("--canvas-image").trim() !== "none"
    : false;

  const canvas = document.querySelector("[data-editor-canvas]") ?? document.body;
  const out = [];
  const patterned = [];

  for (const el of canvas.querySelectorAll("*")) {
    if (el.children.length) continue;
    const t = el.textContent?.trim();
    if (!t || t.length > 40) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const fg = parse(cs.color);
    if (!fg) continue;

    // ── 1. contrast against what is ACTUALLY behind it ────────────────────
    let painter = el, bg = { r: 255, g: 255, b: 255, a: 1 }, hitPattern = null;
    while (painter && painter !== document.documentElement) {
      const pcs = getComputedStyle(painter);
      if (groundIsPatterned && !hitPattern && pcs.backgroundImage !== "none") {
        hitPattern = painter;
      }
      const pc = parse(pcs.backgroundColor);
      if (pc.a > 0.5) { bg = pc; break; }
      painter = painter.parentElement;
    }
    const L1 = lum(fg.r, fg.g, fg.b), L2 = lum(bg.r, bg.g, bg.b);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 4.5) {
      out.push({ t: t.slice(0, 26), ratio: +ratio.toFixed(2), fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, size: cs.fontSize });
    }

    // ── 2. text sitting on a figure ───────────────────────────────────────
    // Reported only when the pattern was reached BEFORE any opaque surface —
    // a card painted over the floor is exactly what should happen.
    if (hitPattern && (!painter || hitPattern === painter || bg.a === 0)) {
      patterned.push({ t: t.slice(0, 26), size: cs.fontSize, on: `${hitPattern.tagName}.${(hitPattern.className || "").toString().slice(0, 40)}` });
    }
  }
  return { out, patterned };
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 40000 });

for (const [tag, url] of [["quotations", "/zh/portal/quotations?design=1"], ["website", "/zh/portal/website?design=1"]]) {
  await p.goto("http://localhost:3000" + url, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(8000);
  const { out, patterned } = await p.evaluate(AUDIT);
  console.log(`\n=== ${tag}: ${out.length} under 4.5:1 | ${patterned.length} on a bare pattern`);
  for (const x of out.slice(0, 10)) {
    console.log(`  ${String(x.ratio).padStart(5)}  ${x.size.padStart(6)}  ${x.fg} on ${x.bg}  "${x.t}"`);
  }
  for (const x of patterned.slice(0, 10)) console.log(`  pattern  ${x.size.padStart(6)}  "${x.t}"  on ${x.on}`);
}
await b.close();

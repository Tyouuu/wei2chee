/**
 * 那些 landing kit 到底有哪些区段 —— 数出来，不是看图猜。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * The founder, 2026-08-27: 「我不是给你了很多github 做landing pages 的skills了吗
 * 还是开源项目 你忘记了吗 我是说看看如何融合 随便也去看看国外的landing pages是
 * 怎么去做的」. He is right that they were given and right that they were not
 * mined -- .screenshots/kits/ held seven pictures, two of which turned out to
 * be Vercel's own 404 page photographed and filed as a kit.
 *
 * ── WHAT IS TAKEN FROM THEM, AND WHAT IS NOT ──────────────────────────────
 *
 * Measured on 2026-08-27 against 19 trading Malaysian SME sites (see
 * shoot-market.mjs), these kits and this market DISAGREE about proportion: the
 * kits set a hero at 56-72px and a rhythm at 96-128px, and this market sets
 * 38px and something much tighter. Taking both from GitHub is what produced a
 * customer website with SaaS proportions, and it was wrong.
 *
 *   FROM THE KITS   有哪些区段 -- the vocabulary. Which sections a marketing
 *                   page is even made of, and which ones we simply do not have.
 *   FROM THE MARKET 多大、多宽、多密 -- and what goes in the first screen.
 *
 * So this script counts SECTIONS AND THEIR KINDS. It deliberately does not
 * recommend a type scale; shoot-market.mjs owns that question.
 *
 *   npm run shoot:kits
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

/* Live demos rather than clones. Five `npm install`s answer the same question
   these do, several minutes slower, and the demo is what the maintainers
   actually ship. Two of the seven originally screenshotted are gone -- their
   deployments 404 -- which is itself worth having found. */
const SOURCES = [
  ["tailark", "https://tailark.com", "kit", "MIT · Radix base, our own stack"],
  ["launch-ui", "https://www.launchuicomponents.com", "kit", "MIT · shadcn + Tailwind"],
  ["bigspring", "https://bigspring-light.vercel.app", "kit", "MIT · Themefisher"],
  ["shadcn-landing", "https://shadcn-landing-page.vercel.app", "kit", "MIT · nobruf"],
  ["magicui", "https://magicui.design", "kit", "MIT · animation-led"],
  // 国外的 landing pages, the ones the kits are imitating. Included so the
  // comparison is against the originals rather than against the copies.
  ["linear", "https://linear.app", "product", "the reference every kit copies"],
  ["stripe", "https://stripe.com", "product", "the other one"],
  ["framer", "https://www.framer.com", "product", "a website builder's own page"],
];

const OUT = ".screenshots/kits";
mkdirSync(OUT, { recursive: true });

/** Runs in the page. Walks the top-level sections a reader scrolls through and
 *  says what KIND each one is, from what a reader can see. */
const INVENTORY = () => {
  const vw = innerWidth;
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.height > 40 && cs.display !== "none" && cs.visibility !== "hidden";
  };

  /* THE SCROLLED-THROUGH SECTIONS ARE NOT ALWAYS `main > *`.
     Half these pages wrap everything in two or three layout divs. So the run
     is found by descending while there is only one tall child -- the same
     trick that finds the real content column in a screenshot. */
  let host = document.querySelector("main") || document.body;
  for (let i = 0; i < 6; i++) {
    const kids = [...host.children].filter(seen);
    const tall = kids.filter((el) => el.getBoundingClientRect().height > innerHeight * 0.25);
    if (kids.length === 1) host = kids[0];
    else if (tall.length === 1 && kids.length <= 3) host = tall[0];
    else break;
  }

  const kindOf = (el) => {
    const text = (el.innerText || "").trim();
    const imgs = [...el.querySelectorAll("img, svg, video")].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 24 && r.height > 16;
    });
    const inputs = el.querySelectorAll("input, textarea, select").length;
    const heads = [...el.querySelectorAll("h2, h3")].filter(seen);
    const buttons = el.querySelectorAll("a[class*=button], button, [role=button]").length;
    const r = el.getBoundingClientRect();

    if (inputs > 1) return "form";
    if (el.querySelector("details, summary") || el.querySelectorAll("[aria-expanded]").length >= 3)
      return "accordion";
    if (/\$\s?\d|\/\s?(mo|month|year)|per month|RM\s?\d/i.test(text) && heads.length >= 2)
      return "pricing";
    if (el.querySelector("blockquote") || /[""]/.test(text) || /★|⭐/.test(text)) return "quote";
    // A logo wall: many images, almost no words.
    if (imgs.length >= 4 && text.length < 200) return "logos";
    // A stat band: three or four short number-plus-label pairs.
    const nums = text.split("\n").filter((l) => /^[+\-$]?[\d.,]+[%+xKMB]?$/i.test(l.trim()));
    if (nums.length >= 3 && text.length < 400) return "stats";
    if (heads.length >= 3) return "cards";
    // Mostly a picture.
    const area = imgs.reduce((a, n) => {
      const b = n.getBoundingClientRect();
      return a + b.width * b.height;
    }, 0);
    if (area > r.width * r.height * 0.35) return "media";
    if (heads.length <= 1 && buttons >= 1 && text.length < 320) return "cta-band";
    if (heads.length >= 1) return "prose";
    return "other";
  };

  const sections = [...host.children].filter(seen).map((el) => {
    const r = el.getBoundingClientRect();
    const h = el.querySelector("h1, h2, h3");
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      kind: el.tagName === "HEADER" || el.tagName === "NAV" ? "nav" : el.tagName === "FOOTER" ? "footer" : kindOf(el),
      heading: h ? (h.innerText || "").replace(/\s+/g, " ").trim().slice(0, 44) : "",
      height: Math.round(r.height),
      padTop: Math.round(parseFloat(cs.paddingTop)),
    };
  });

  const px = (sel) => {
    const el = [...document.querySelectorAll(sel)].filter(seen)[0];
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0;
  };
  const paras = [...document.querySelectorAll("p")].filter(seen).filter((p) => (p.innerText || "").length > 120);
  const widths = paras.map((p) => Math.round(p.getBoundingClientRect().width)).sort((a, b) => a - b);

  return {
    vw,
    sections,
    h1: px("h1"),
    h2: px("h2"),
    body: px("p"),
    paraWidth: widths.length ? widths[Math.floor(widths.length / 2)] : 0,
  };
};

const b = await chromium.launch();
const rows = [];
for (const [name, url, group, note] of SOURCES) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(5000);
    // Scroll the whole page so lazy sections mount before they are counted.
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      scrollTo(0, 0);
    });
    await p.waitForTimeout(1200);
    const data = await p.evaluate(INVENTORY);
    rows.push({ name, url, group, note, ...data });
    await p.screenshot({ path: `${OUT}/${name}-top.png` });
    console.log(`ok   ${name}  ${data.sections.length} sections`);
  } catch (e) {
    console.log(`FAIL ${name} ${String(e).split("\n")[0].slice(0, 70)}`);
  }
  await p.close();
}
await b.close();
writeFileSync(`${OUT}/inventory.json`, JSON.stringify(rows, null, 1));

console.log("\n── 一页由哪些区段组成 ──────────────────────────────────────");
for (const r of rows) {
  console.log(`\n${r.name}  (${r.group} · ${r.note})`);
  console.log(`  h1 ${r.h1}px · h2 ${r.h2}px · 正文 ${r.body}px · 行宽 ${r.paraWidth}px`);
  console.log(
    "  " +
      r.sections
        .map((s) => (s.heading ? `${s.kind}「${s.heading}」` : s.kind))
        .join(" → "),
  );
}

const tally = new Map();
for (const r of rows) for (const s of r.sections) tally.set(s.kind, (tally.get(s.kind) ?? 0) + 1);
console.log("\n── 区段种类，出现几次 ──────────────────────────────────────");
for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(10)} ${n}`);

/* WHAT WE HAVE, so the gap is a list rather than an impression. Kept here
   rather than imported because this is a plain .mjs and the block registry is
   TSX -- and because the point of the list is to be READ next to the tally. */
const OURS = {
  nav: "SiteBar",
  media: "SiteHero 的图 / PhotoFrame",
  cards: "SiteFeatures",
  quote: "SiteTestimonials",
  "cta-band": "SiteCta",
  accordion: "FoldSection",
  form: "EnquiryForm",
  footer: "SiteFoot",
  prose: "InfoRows / MarkList",
  pricing: "InfoRows（价目）",
};
console.log("\n── 我们缺的 ────────────────────────────────────────────────");
for (const [k] of [...tally].sort((a, b) => b[1] - a[1])) {
  if (!OURS[k]) console.log(`  ${k.padEnd(10)} 没有`);
}
console.log("\n（其余都有：" + Object.entries(OURS).map(([k, v]) => `${k}=${v}`).join(" · ") + "）");

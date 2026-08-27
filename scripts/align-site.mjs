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
  ledger: "https://www.wix.com/demone2/wright-and-taylor",
  swiss: "https://www.wix.com/demone2/wh-leah",
  blueprint: "https://www.wix.com/demone2/wh-law-firm-2",
  signboard: "https://www.wix.com/demone2/brasserie",
  counter: "https://www.wix.com/demone2/wh-kurofude-rest",
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
  await p.screenshot({ path: `${OUT}/${file}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
  await p.close();
  return { secs, type };
}

try {
  const theirs = await shoot(url, null, 7000, `${register}-ref`);
  const ours = await shoot(`http://localhost:3000/s/${project.site_slug}`, ".ds-site", 2500, `${register}-ours`);

  const row = (s, i) => `${String(i + 1).padStart(2)}  ${String(s.h).padStart(5)}px  ${String(s.img).padStart(2)}img  ${s.text}`;
  const sum = (l) => l.reduce((a, s) => a + s.h, 0);
  console.log(`\n参考 ${url}\n${theirs.secs.map(row).join("\n")}\n  = ${theirs.secs.length} 段 ${sum(theirs.secs)}px`);
  console.log(`\n我们 ${register}\n${ours.secs.map(row).join("\n")}\n  = ${ours.secs.length} 段 ${sum(ours.secs)}px`);
  console.log(`\n字级  参考 ${theirs.type.map((t) => t.px).join("/")}`);
  console.log(`      我们 ${ours.type.map((t) => t.px).join("/")}`);

  fs.writeFileSync(`${OUT}/${register}.json`, JSON.stringify({ url, theirs, ours }, null, 1));
  console.log(`\n对照图 → ${OUT}/${register}.jpg （用眼睛看这一张，不是看上面的数字）`);
} finally {
  await browser.close();
  await restore();
}

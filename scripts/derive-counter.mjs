// Derives design-system/tokens/counter.css from blueprint.css.
//
//   node scripts/derive-counter.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/blueprint.css";
const OUT = "design-system/tokens/counter.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 中台 (Counter) — the register for a business that opens twenty rows a day
   and needs to see all of them.

   WHERE IT CAME FROM. Ant Design Pro (38.7k, MIT) and vue-element-admin
   (90.2k, MIT), photographed 2026-08-25. Between them they are the look that
   most Chinese-speaking Malaysian SMEs have already used, because it is what
   every 进销存 and every 车行系统 sold in this market is built on. A dealer who
   has run Autocount or a 中文 ERP recognises this page before they read it,
   which is worth more than any amount of novelty.

   WHAT MAKES IT A REGISTER AND NOT 台账 IN BLUE, measured against the fifteen:

     1. A DEEP NAVY SIDEBAR WITH A SOLID BLUE ACTIVE ROW. 台账 uses a 64px
        icon rail; 蓝图 a #142744 column with a tinted active row; this one is
        #001529 with the active row FILLED in #1677ff and the label turned
        white. A filled active row is a different navigational object from a
        tinted one -- it says "you are here" at a glance across a page with
        forty lines on it.

     2. TWO-PIXEL CORNERS AND NO SHADOW ANYWHERE. Of the fifteen, 台账 is 4px
        borderless, 瑞士 and 单据-era registers are square with rules, 蓝图 is
        12px with a faint lift. Nothing was 2px-with-a-border-and-no-shadow,
        which is the exact object antd draws and the reason its tables can sit
        edge to edge without the page turning into a stack of trays.

     3. THE DENSEST BODY IN THE SET. row 34px, card padding 12px, base 13px.
        台账 is the current floor at 32px rows but pairs it with a paper canvas
        and no fill; this pairs the density with a filled chrome, which is what
        makes it read as software rather than as a ledger.

     4. THE GROUND IS GREY, NOT PAPER AND NOT BLUE. #f0f2f5 is antd's own, and
        it is the only near-neutral grey ground in the set -- every other light
        register tints its canvas warm or blue.

   WHO IT IS FOR. Wholesalers, dealer networks, car workshops, spare-parts
   shops, anyone whose day is a list. Specifically the SIM-card master dealer
   this product's module catalogue was rebuilt around: forty dealers, monthly
   reconciliation, 2% commission, and a screen that has to show all of it.

   AVOID for a business whose customers see the page. This is a back office in
   the most literal sense and it has no warmth to spend on a stranger. */`;

const at = css.indexOf("/* Blueprint —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("blueprint.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── 1. deep navy chrome, filled active row ──────────────────────────────
  "--color-nav-bg": "#001529",
  "--color-nav-bg-deep": "#000c17",
  "--color-nav-fg": "#b7c3d1",
  "--color-nav-fg-dim": "#5c6b7e",
  "--color-nav-border": "#0b2136",
  "--color-nav-hover": "#0b2136",
  "--color-nav-active": "#1677ff",
  "--color-nav-accent": "#ffffff",

  // ── 2. two-pixel corners, a border, no shadow at all ────────────────────
  "--radius-sm": "2px",
  "--radius-md": "2px",
  "--radius-lg": "2px",
  "--radius-control": "2px",
  "--radius-xs": "2px",
  "--border-card-width": "1px",
  "--shadow-card": "none",
  "--shadow-raised": "none",
  "--shadow-overlay": "0 6px 16px rgba(0, 0, 0, 0.08)",

  // ── 3. the densest body in the set ──────────────────────────────────────
  "--row-h": "34px",
  "--pad-card": "12px",
  "--pad-cell-y": "7px",
  "--text-base": "13px",
  "--leading-body": "1.55",

  // ── 4. a neutral grey ground ────────────────────────────────────────────
  "--color-canvas": "#f0f2f5",
  "--color-ink-950": "#e9ebef",
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#fafafa",
  "--color-ink-800": "#ebedf0",
  "--color-ink-700": "#d9dce0",
  "--color-paper": "#0f1826",
  "--color-paper-dim": "#6b7688",

  // antd's own blue and status ramp, because half this market already reads
  // these three colours as "ok / careful / wrong" without being told.
  "--color-primary": "#1677ff",
  "--color-primary-deep": "#0958d9",
  "--color-primary-soft": "#e6f0ff",
  "--color-jade": "#00a870",
  "--color-jade-bright": "#00a870",
  "--color-jade-chart": "#00a870",
  "--color-brass": "#d48806",
  "--color-brass-bright": "#d48806",
  "--color-brass-chart": "#faad14",
  "--color-clay": "#f5222d",
  "--color-clay-bright": "#f5222d",
  "--color-clay-deep": "#cf1322",

  // Labels stay sentence case. Uppercase Latin above a dense Chinese table
  // fights the CJK, which has no case to match it.
  "--label-transform": "none",
  "--tracking-label": "0.01em",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);

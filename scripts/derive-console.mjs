// Derives design-system/tokens/console.css from blueprint.css.
//
//   node scripts/derive-console.mjs
//   npm run build:tokens
//
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/blueprint.css";
const OUT = "design-system/tokens/console.css";

let css = readFileSync(SRC, "utf8");

const HEADER = `/* 仪表盘 (Console) — the register for an owner who opens the system to read
   NUMBERS, not to read records.

   WHERE IT CAME FROM. Eleven competitors' dashboards were photographed at
   1440x950 on 2026-08-25 and put beside our own sixteen. Three of them are one
   family and none of the sixteen was in it: Tabler (41.5k, MIT), AdminLTE
   (45.6k, MIT) and ngx-admin (25.7k, MIT) all draw the same object — a white
   sidebar, a near-white slate ground, 4px corners, a shadow you can only see
   at the edge of a card, and colour spent entirely on the figures.

   WHAT MAKES IT A REGISTER AND NOT BLUEPRINT IN ANOTHER BLUE, measured against
   the fifteen others:

     1. THE SIDEBAR IS WHITE. Nine of the sixteen put a dark column down the
        left, four put a bar across the top, and the three that keep it light
        (墨, 瑞士, 大字) are all typographic registers with no fill anywhere.
        A LIGHT sidebar with a TINTED active row is the shape every dense
        console in this market actually uses, and nothing here had it.

     2. THE GROUND IS COOL AND THE CARDS ARE WHITE. Blueprint's canvas is a
        blue-tinted paper at #f3f7fe with cards at the same warmth; this one
        sits the cards a full step above a slate ground, which is what makes
        eight tiles read as eight objects rather than as one panel with rules
        in it. The card/ground luminance ratio here is 1.09 against Blueprint's
        1.02 -- small numbers, and the whole difference between a dashboard and
        a document.

     3. FOUR-PIXEL CORNERS WITH A VISIBLE BORDER. 台账 is 4px and borderless
        under a hairline table; 蓝图 is 12px with a border. Square-ish AND
        outlined AND shadowed is a third object, and it is the one a business
        owner recognises from every accounting package they have already used.

     4. LABELS ARE SMALL CAPS. Blueprint sets --label-transform: none. Every
        console in that family sets its KPI labels in tracked uppercase, which
        is what lets a 25px figure sit directly under an 11px word without the
        two competing.

   WHO IT IS FOR. A business that counts things every day and wants to see the
   count first: a workshop with jobs in progress, a dealer network with monthly
   reconciliation, a clinic with today's bookings, a wholesaler watching stock.
   The register to AVOID for a business whose page a customer sees -- this is a
   back office and it looks like one.

   PAIRS WITH StatRow's 「有底色图案」 and TrendChart's card. See
   design-system/components/stat-row.tsx for why that row exists at all. */`;

const at = css.indexOf("/* Blueprint —");
const end = css.indexOf("@theme", at);
if (at < 0 || end < 0) throw new Error("blueprint.css header not found");
css = css.slice(0, at) + HEADER + "\n" + css.slice(end);

const MOVES = {
  // ── 1. a white sidebar with a tinted active row ─────────────────────────
  "--color-nav-bg": "#ffffff",
  "--color-nav-bg-deep": "#f8fafc",
  "--color-nav-fg": "#3b4b60",
  "--color-nav-fg-dim": "#94a3b8",
  "--color-nav-border": "#e2e8f0",
  "--color-nav-hover": "#f1f5f9",
  "--color-nav-active": "#eaf2fe",
  "--color-nav-accent": "#1663d6",

  // ── 2. slate ground, white cards ────────────────────────────────────────
  "--color-canvas": "#f1f5f9",
  "--color-ink-950": "#e9eef5",
  "--color-ink-900": "#ffffff",
  "--color-ink-850": "#f8fafc",
  "--color-ink-800": "#e2e8f0",
  "--color-ink-700": "#cbd5e1",
  "--color-paper": "#12263f",
  "--color-paper-dim": "#5b6b80",

  // ── 3. four-pixel corners, a real border, a shadow at the edge ──────────
  "--radius-sm": "3px",
  "--radius-md": "4px",
  "--radius-lg": "4px",
  "--radius-control": "4px",
  "--border-card-width": "1px",
  "--shadow-card": "0 1px 2px rgba(16, 32, 64, 0.06)",
  "--shadow-raised": "0 2px 6px rgba(16, 32, 64, 0.09)",
  "--shadow-overlay": "0 8px 24px rgba(16, 32, 64, 0.14)",

  // ── 4. small caps on labels ─────────────────────────────────────────────
  "--label-transform": "uppercase",
  "--tracking-label": "0.06em",

  // ── the console's own blue, and figures that carry the colour ───────────
  "--color-primary": "#1663d6",
  "--color-primary-deep": "#1250b0",
  "--color-primary-soft": "#eaf2fe",
  "--color-jade": "#0f8f5c",
  "--color-jade-bright": "#128f5c",
  "--color-jade-chart": "#16a06a",
  "--color-brass": "#a06a12",
  "--color-brass-bright": "#b8791b",
  "--color-brass-chart": "#d99420",
  "--color-clay": "#c03a26",
  "--color-clay-bright": "#d0432f",
  "--color-clay-deep": "#9c2c1b",

  // Tighter than Blueprint's, because a console shows more of everything.
  "--row-h": "38px",
  "--pad-card": "15px",
};

for (const [token, value] of Object.entries(MOVES)) {
  const re = new RegExp(`(^  ${token}\\s*:\\s*)([^;]+)(;)`, "m");
  if (!re.test(css)) throw new Error(`token not found in ${SRC}: ${token}`);
  css = css.replace(re, `$1${value}$3`);
}

writeFileSync(OUT, css);
console.log(`wrote ${OUT} (${Object.keys(MOVES).length} tokens moved)`);

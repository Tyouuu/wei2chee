// Derives design-system/tokens/brut.css from swiss.css.
//
// The same method the file headers already describe for swiss (from bare) and
// soft (from hearth): take the closest existing register and change only the
// axes that make the new one a different register. Doing it by script rather
// than by hand is what keeps the ~120 tokens that should NOT change from
// drifting -- the whole point of the exercise is that ONE axis moved.
//
//   node scripts/derive-brut.mjs
//
// Then run `npm run build:tokens` to regenerate the scoped copy the style
// picker mounts, and the sync test to check it.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design-system/tokens/swiss.css";
const OUT = "design-system/tokens/brut.css";

let css = readFileSync(SRC, "utf8");

// Backticks inside the comment are written as ` so this stays one plain
// template literal.
const T = "`";

const HEADER = [
  "/* 粗野 (Brut) — the register with weight.",
  "",
  "   WHERE IT CAME FROM. uiprompt.site's published brief for Neo-Brutalism,",
  "   rendered into tokens. Its own words: \"thick strokes, large rounded or hard",
  "   blocks\", \"bold/mono type\", \"clearly offset shadows\", \"solid fills\",",
  "   \"2-4px strokes\", \"avoid heavy glass/gradients\", and a mood of \"loud,",
  "   playful yet structured -- like colorful blocks assembling the UI\".",
  "",
  "   (The site went offline the day after this was harvested; the brief survives",
  "   in docs/style-briefs/ and in the Wayback snapshot it was recovered from.",
  "   That is the argument for harvesting rather than bookmarking.)",
  "",
  "   WHY IT EXISTS, MEASURED. On 2026-08-22 the ten registers were compared",
  "   token by token and then looked at side by side. The numbers said they were",
  "   distinct: no two shared an accent, a canvas, a density or an elevation. The",
  "   PICTURE said six of eight read the same. The audit found why -- every",
  "   register was a polite light card:",
  "",
  "     border-card-width   0px x3, 1px x5, 2px x1",
  "     shadow-raised       none, or a 1-2px lift, except Soft's relief",
  "",
  "   Density, colour, radius and type were all well covered. WEIGHT was not",
  "   covered at all. This register is that axis and nothing else.",
  "",
  "   THE THREE MOVES. Borders are BLACK rather than a light grey -- " + T + "--color-ink-800" + T,
  "   holds the same value as " + T + "--color-paper" + T + " here, which in every other register",
  "   would be a bug. They are 3px. And the shadow has no blur: " + T + "4px 4px 0" + T + ", a",
  "   hard offset that reads as a printed second impression rather than as light.",
  "",
  "   WHY THE CORNERS ARE ROUNDED AND NOT SQUARE. Swiss and 单据 already took",
  "   radius to zero, and a third square register would be a repaint of one of",
  "   them. Neo-Brutalism's own brief allows both (\"large rounded or hard",
  "   blocks\"); chunky is the reading that is not already taken, and a 12px",
  "   radius under a 3px stroke is unmistakably a different object from a 0px",
  "   corner under a 1px hairline.",
  "",
  "   WHO IT IS FOR. The trades whose customers are young and whose competition",
  "   is an Instagram page: bubble tea, nail salons, streetwear, a barber, a",
  "   tuition centre for kids. The register a business picks when looking",
  "   established is worth less to it than looking like it has an opinion.",
  "",
  "   THE RISK, STATED. This is the only register in the set that can look wrong",
  "   for a business rather than merely unfashionable -- a 40-year-old trading",
  "   company in this would read as a joke. That is a reason to have it, not a",
  "   reason to soften it: a register that offends nobody differentiates nobody,",
  "   and the other ten are already there for everyone else.",
  "",
  "   Derived from swiss.css by scripts/derive-brut.mjs for its flatness and its",
  "   uppercase labels, with weight put back everywhere Swiss took it out. */",
].join("\n");

css = css.replace(/\/\* 瑞士 \(Swiss\)[\s\S]*?\*\//, HEADER);

const set = (name, value) => {
  const re = new RegExp("(" + name.replace(/-/g, "\\-") + ":\\s*)[^;]+;", "g");
  const before = css;
  css = css.replace(re, "$1" + value + ";");
  if (css === before) console.warn("no change:", name);
};

// The ground: warm poster paper, not Swiss's cool grey and not Hearth's pink
// cream. Cards stay pure white so the black stroke around them is the loudest
// thing on the page.
set("--color-canvas", "#f4f1e8");
set("--color-ink-950", "#e6e1d2");
set("--color-ink-900", "#ffffff");
set("--color-ink-850", "#faf8f2");
// The move the whole register turns on: borders are ink, not a tint of it.
set("--color-ink-800", "#18181b");
set("--color-ink-700", "#3f3f46");

set("--color-paper", "#18181b");
set("--color-paper-dim", "#52525b");

// Hot magenta -- the hue nobody else has. 印章's plum is the same family two
// shades down and reads as heritage; this one reads as a sticker.
set("--color-primary", "#e0006c");
set("--color-primary-deep", "#b30056");
set("--color-primary-soft", "#ffe1ef");
set("--color-on-primary", "#ffffff");

// The nav rail goes black, because a 3px black border around a navy rail is two
// dark things arguing.
set("--color-nav-bg", "#18181b");
set("--color-nav-bg-deep", "#000000");
set("--color-nav-fg", "#fafafa");
set("--color-nav-fg-dim", "#a1a1aa");
set("--color-nav-hover", "#f4f1e8");
set("--color-nav-active", "#ffe1ef");
set("--color-nav-border", "#3f3f46");
set("--color-nav-accent", "#e0006c");

// Type: the heaviest in the set. Nothing else goes past 700.
set("--fw-regular", "400");
set("--fw-medium", "600");
set("--fw-semibold", "800");
set("--fw-display", "900");
set(
  "--font-ui",
  'var(--font-brut-latin), var(--font-hei-cjk), "PingFang SC",\n    "Microsoft YaHei", system-ui, sans-serif',
);

set("--tracking-body", "-0.008em");
set("--tracking-sm", "-0.01em");
set("--tracking-title", "-0.03em");
set("--tracking-title-lg", "-0.04em");
set("--tracking-label", "0.06em");

set("--text-micro", "11px");
set("--text-xs", "12px");
set("--text-sm", "13.5px");
set("--text-base", "15px");
set("--text-lg", "17px");
set("--text-title", "22px");
set("--text-hero", "40px");
set("--leading-tight", "1.2");
set("--leading-body", "1.6");

// Chunky, not sharp. See the header for why this is not a third square
// register.
set("--radius-xs", "6px");
set("--radius-sm", "8px");
set("--radius-md", "12px");
set("--radius-lg", "16px");
set("--radius-control", "10px");
set("--radius-pill", "999px");

set("--pad-card", "20px");
set("--pad-card-lg", "28px");
set("--pad-control-x", "14px");
set("--pad-control-y", "10px");
set("--pad-cell-x", "14px");
set("--pad-cell-y", "13px");
set("--gap-stack", "18px");
set("--gap-inline", "12px");
set("--row-h", "50px");
set("--control-h", "40px");

// The other two moves. A shadow with no blur is a second impression, not light.
set("--border-card-width", "3px");
set("--hairline", "2px");
set("--shadow-card", "4px 4px 0 #18181b");
set("--shadow-raised", "4px 4px 0 #18181b");
set("--shadow-overlay", "6px 6px 0 #18181b");
set("--border-subtle", "rgba(24, 24, 27, 0.55)");
set("--border-strong", "rgba(24, 24, 27, 1)");

// Swiss halves its hairline on a dense display so a hairline stays a hairline.
// Here 2px is a stated stroke width, and thinning it would quietly turn this
// register back into one of the polite ones.
css = css.replace(
  /@media \(min-resolution: 192dpi\) \{\s*:root \{\s*--hairline: 0\.5px;\s*\}\s*\}/,
  "/* No retina halving -- see scripts/derive-brut.mjs. 2px here is a stated\n   stroke width, not a rendering artefact, and has to survive a dense display. */",
);

// The offset shadow is already the object's edge, so the focus ring sits
// outside both and is thicker to match everything else.
css = css.replace(
  /:focus-visible \{[\s\S]*?\}/,
  [
    ":focus-visible {",
    "  outline: none;",
    "  box-shadow:",
    "    0 0 0 3px var(--color-ink-900),",
    "    0 0 0 6px var(--color-primary);",
    "  border-radius: 10px;",
    "}",
  ].join("\n"),
);

writeFileSync(OUT, css);
console.log("wrote", OUT, css.length, "bytes");

/**
 * Pulls colour palettes from tweakcn and writes them as design-system palettes.
 *
 * WHY THIS EXISTS
 *
 * A customer could pick from three styles. Each is a complete look -- Ledger is
 * tight/sharp/rust, Hearth is loose/round/teal, Blueprint is precise/technical/
 * blue -- and each took real design work, which is why there were three and not
 * thirty. The founder has asked repeatedly how to get 21st.dev's sense of
 * variety without being a marketplace.
 *
 * The answer is that a "style" is two decisions wearing one name. Measured on
 * the three token files: 52 of the ~125 tokens are STRUCTURE (type scale,
 * weights, tracking, radii, padding, row heights, shadows) and 75 are COLOUR.
 * Structure is what took the design work. Colour is data.
 *
 * So the three stay exactly as they are and become the 版式 -- and a palette is
 * a file that overrides only the colour half. 3 layouts x N palettes.
 *
 * WHY IT ONLY HAS TO SET 28 TOKENS
 *
 * The shadcn contract added to each token file on 2026-08-21 (`--background:
 * var(--color-canvas)` and the rest) is aliases, not values. Both classes land
 * on the same element, so an alias declared in `.ledger` resolves against
 * whatever `--color-canvas` is at use time -- which is the palette's. Setting
 * the 28 colour tokens components actually read is therefore enough to carry
 * the entire contract with it. That bridge was built to let shadcn components
 * IN; this is the same door used in the other direction.
 *
 * WHY THE CONTRAST GATE IS NOT OPTIONAL
 *
 * tweakcn's palettes are designed against shadcn's own components. The roles
 * line up with ours, but nothing guarantees that a given theme's
 * muted-foreground clears AA on its own card, and a palette that ships an
 * unreadable table is worse than having three styles. Every candidate is
 * measured with the WCAG relative-luminance formula on all three of its own
 * surfaces and DROPPED if it fails. The report says which and why.
 *
 * Source: https://tweakcn.com/r/themes/{name}.json -- jnsahaj/tweakcn,
 * Apache-2.0. Values are copied, not derived; the attribution is written into
 * every generated file.
 *
 *   node scripts/build-palettes.mjs           # regenerate
 *   node scripts/build-palettes.mjs --check   # fail if the output is stale
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "design-system", "palettes");

/**
 * The palettes offered, and why each one earns a slot.
 *
 * Not all 36 that tweakcn publishes. A style picker is a decision a business
 * owner makes in under a minute, and thirty-six swatches is not a wider choice
 * than nine, it is the same choice made harder. These are chosen to be
 * genuinely far apart from each other and from the three native palettes --
 * and to be plausible for a Malaysian SME rather than for a developer's side
 * project, which rules out doom-64, cyberpunk and retro-arcade however good
 * they look.
 */
const WANTED = [
  ["supabase", "青绿", "干净的绿，像 Supabase 后台"],
  ["vercel", "极简黑", "黑白灰，没有一点多余颜色"],
  ["claude", "陶土", "暖橙陶土色，柔和不刺眼"],
  ["amber-minimal", "琥珀", "琥珀黄，账本和单据的感觉"],
  ["nature", "森绿", "深绿配米白，沉稳"],
  ["ocean-breeze", "海蓝", "浅海蓝，清爽"],
  ["vintage-paper", "旧纸", "泛黄纸张，老字号的味道"],
  ["clean-slate", "石板灰", "冷灰蓝，中性专业"],
  ["mocha-mousse", "可可", "深棕奶咖，温暖厚重"],
  ["graphite", "石墨", "纯灰阶，让数据自己说话"],
];

/** How a tweakcn theme's shadcn variables become this design system's colour
 *  tokens. The inverse of the bridge in design-system/tokens/*.css -- read that
 *  file's "THE shadcn/ui CONTRACT" block alongside this. */
const MAP = {
  "--color-canvas": "background",
  "--color-ink-950": "muted",
  "--color-ink-900": "card",
  "--color-ink-850": "accent",
  "--color-ink-800": "border",
  "--color-ink-700": "input",

  "--color-paper": "foreground",
  "--color-paper-dim": "muted-foreground",

  "--color-primary": "primary",
  "--color-primary-deep": "ring",
  "--color-primary-soft": "accent",
  "--color-on-primary": "primary-foreground",
  "--color-on-dark": "sidebar-foreground",

  // The four status meanings keep their names and take this palette's chart
  // ramp, so "positive" is still one idea across every style even though it is
  // a different green in each.
  "--color-jade": "chart-2",
  "--color-jade-bright": "chart-2",
  "--color-jade-chart": "chart-2",
  "--color-brass": "chart-3",
  "--color-brass-bright": "chart-3",
  "--color-brass-chart": "chart-3",
  "--color-clay": "destructive",
  "--color-clay-bright": "destructive",
  "--color-clay-deep": "destructive",
  "--color-slate": "chart-5",
  "--color-slate-bright": "chart-5",
  "--color-info": "chart-1",
  "--color-info-bright": "chart-1",
  "--color-medal-gold": "chart-3",
  "--color-medal-silver": "chart-5",
  "--color-medal-bronze": "chart-4",

  "--color-nav-bg": "sidebar",
  "--color-nav-bg-deep": "sidebar",
  "--color-nav-fg": "sidebar-foreground",
  "--color-nav-fg-dim": "sidebar-foreground",
  "--color-nav-hover": "sidebar-accent",
  "--color-nav-active": "sidebar-accent",
  "--color-nav-border": "sidebar-border",
  "--color-nav-accent": "sidebar-primary",
};

/** Foregrounds that must be legible, and the surfaces they sit on. */
const CONTRAST_PAIRS = [
  ["--color-paper", "--color-canvas", 4.5],
  ["--color-paper", "--color-ink-900", 4.5],
  ["--color-paper-dim", "--color-canvas", 4.5],
  ["--color-paper-dim", "--color-ink-900", 4.5],
  ["--color-primary", "--color-ink-900", 3.0],
  ["--color-on-primary", "--color-primary", 4.5],
  ["--color-nav-fg", "--color-nav-bg", 4.5],
];

// --- colour maths ----------------------------------------------------------

/** oklch(L C H) / oklch(L C H / A) / hsl(...) / #hex -> {r,g,b} 0-255.
 *  tweakcn emits oklch almost everywhere, so that is the path that matters. */
function parseColor(css) {
  const s = String(css).trim();
  if (s.startsWith("#")) {
    const h = s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1);
    const n = parseInt(h.slice(0, 6), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const ok = s.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (ok) {
    let L = Number.parseFloat(ok[1]);
    if (ok[1].endsWith("%")) L /= 100;
    return oklchToRgb(L, Number.parseFloat(ok[2]), Number.parseFloat(ok[3]));
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  return null;
}

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  return { r: enc(lr), g: enc(lg), b: enc(lb) };
}

function luminance({ r, g, b }) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const A = parseColor(a), B = parseColor(b);
  if (!A || !B) return null;
  const l1 = luminance(A), l2 = luminance(B);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** oklch string -> {L, C, H} so a value can be darkened without leaving its
 *  own hue. Returns null for anything not in oklch, which is the signal to
 *  stop rather than to guess. */
function readOklch(css) {
  const m = String(css).trim().match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  let L = Number.parseFloat(m[1]);
  if (m[1].endsWith("%")) L /= 100;
  return { L, C: Number.parseFloat(m[2]), H: Number.parseFloat(m[3]) };
}

const fmtOklch = ({ L, C, H }) => `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;

/**
 * Walks a colour's LIGHTNESS until it clears `min` against `bg`, holding chroma
 * and hue exactly.
 *
 * This is a repair, not an invention, and the distinction is the whole point:
 * Supabase green stays Supabase green, it just stops being 1.54:1 as body text.
 * The three hand-written styles already do this by hand -- ledger.css says in
 * so many words that its rust was picked at the lightness that clears its own
 * ground. Dropping a palette over one mechanical failure would throw away a
 * designer's colour choice to avoid doing arithmetic.
 *
 * Direction is chosen by which way the background sits, so it darkens on a
 * light ground and lightens on a dark one. Gives up after 60 steps rather than
 * looping, and returns null so the caller drops the palette honestly.
 */
function fitContrast(value, bg, min) {
  if (contrast(value, bg) >= min) return { value, changed: false };
  const c = readOklch(value);
  if (!c) return null;
  const bgLum = luminance(parseColor(bg));
  const step = bgLum > 0.35 ? -0.01 : 0.01;
  for (let i = 0; i < 60; i++) {
    c.L = Math.min(1, Math.max(0, c.L + step));
    const next = fmtOklch(c);
    if (contrast(next, bg) >= min) return { value: next, changed: true };
  }
  return null;
}

/** For a fill, the readable label is whichever of the palette's own two
 *  extremes wins -- never a hardcoded white, which is what produced 3.90:1
 *  labels in several of tweakcn's own themes. */
function bestOn(fill, candidates) {
  let best = null, bestRatio = 0;
  for (const c of candidates) {
    if (!c) continue;
    const r = contrast(c, fill);
    if (r > bestRatio) { bestRatio = r; best = c; }
  }
  return { value: best, ratio: bestRatio };
}

// --- generation ------------------------------------------------------------

async function fetchTheme(name) {
  const res = await fetch(`https://tweakcn.com/r/themes/${name}.json`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  const light = json?.cssVars?.light;
  if (!light) throw new Error(`${name}: no light palette`);
  return light;
}

/** The class name a palette gets. CSS Modules camel-cases hyphenated class
 *  names in the generated .d.ts, so the source class is written camel too --
 *  otherwise `styles.paletteAmberMinimal` silently resolves to undefined and
 *  the palette applies nothing at all. */
function className(name) {
  return "palette" + name.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

function toCss(name, zh, blurb, vars, resolved, fixes) {
  const lines = [];
  for (const token of Object.keys(MAP)) {
    const v = resolved[token];
    if (v) lines.push(`  ${token}: ${v};`);
  }
  // nav-fg-dim has no counterpart -- sidebar-foreground at 68% is what every
  // hand-written style uses for the same job, and color-mix keeps it tied to
  // the palette rather than freezing a value.
  if (vars["sidebar-foreground"]) {
    lines.push(
      `  --color-nav-fg-dim: color-mix(in oklab, ${vars["sidebar-foreground"]} 68%, ${vars["sidebar"] ?? vars["background"]});`,
    );
  }
  return `/* ${zh} (${name}) -- ${blurb}
 *
 * GENERATED by scripts/build-palettes.mjs. Do not edit by hand.
 * Source: https://tweakcn.com/r/themes/${name}.json
 * jnsahaj/tweakcn, Apache-2.0. Values copied, roles remapped onto this design
 * system's token names -- see the MAP in the generator for the correspondence.
 *
 * Colour ONLY. Type scale, weights, radii, density and shadows all stay with
 * whichever 版式 class this is combined with, which is what makes 3 x N work.
 *${fixes.length ? "\n * CONTRAST REPAIRS (lightness only, hue and chroma held exactly):\n *   " + fixes.join("\n *   ") : "\n * No contrast repairs needed: every pair cleared AA as published."}
 */
.${className(name)} {
${lines.join("\n")}
}
`;
}

async function main() {
  const check = process.argv.includes("--check");
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const kept = [], dropped = [], repaired = [];
  for (const [name, zh, blurb] of WANTED) {
    let vars;
    try {
      vars = await fetchTheme(name);
    } catch (err) {
      dropped.push([name, String(err.message)]);
      continue;
    }

    const resolved = {};
    for (const [token, key] of Object.entries(MAP)) if (vars[key]) resolved[token] = vars[key];

    // REPAIR BEFORE JUDGING.
    // Three mechanical failures show up across tweakcn's set, and every one of
    // them is arithmetic rather than taste: an accent too light to read as
    // text, a muted-foreground a hair under AA, and a fill label they hardcoded
    // to white. Dropping a palette over any of those throws away a designer's
    // colour choice to avoid doing the sum. Hue and chroma are held exactly, so
    // Supabase green stays Supabase green -- it just stops being 1.54:1.
    const fixes = [];
    const repair = (token, bg, min, label) => {
      const got = fitContrast(resolved[token], resolved[bg], min);
      if (!got) return false;
      if (got.changed) {
        fixes.push(`${label} ${contrast(resolved[token], resolved[bg]).toFixed(2)}->${contrast(got.value, resolved[bg]).toFixed(2)}`);
        resolved[token] = got.value;
      }
      return true;
    };

    let repairable = true;
    // Read as text in eight components, so it answers to the text threshold.
    repairable &&= repair("--color-primary", "--color-ink-900", 4.5, "primary");
    repairable &&= repair("--color-primary-deep", "--color-ink-900", 4.5, "primary-deep");
    repairable &&= repair("--color-paper-dim", "--color-canvas", 4.5, "paper-dim/canvas");
    repairable &&= repair("--color-paper-dim", "--color-ink-900", 4.5, "paper-dim/card");
    repairable &&= repair("--color-nav-fg", "--color-nav-bg", 4.5, "nav-fg");

    // The fill label is CHOSEN from the palette's own extremes rather than
    // nudged, because a button label wants to be one of the two ends, not a
    // grey that happens to pass.
    if (repairable) {
      const on = bestOn(resolved["--color-primary"], [
        resolved["--color-on-primary"],
        resolved["--color-canvas"],
        resolved["--color-paper"],
        "#ffffff",
      ]);
      if (on.value && on.value !== resolved["--color-on-primary"]) {
        fixes.push(`on-primary ${contrast(resolved["--color-on-primary"], resolved["--color-primary"]).toFixed(2)}->${on.ratio.toFixed(2)}`);
        resolved["--color-on-primary"] = on.value;
      }
    }

    const fails = [];
    if (!repairable) fails.push("not expressible in oklch, cannot repair");
    for (const [fg, bg, min] of CONTRAST_PAIRS) {
      const r = contrast(resolved[fg], resolved[bg]);
      if (r === null) { fails.push(`${fg} on ${bg}: unparseable`); continue; }
      if (r < min) fails.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`);
    }
    if (fails.length) { dropped.push([name, fails.join("; ")]); continue; }
    if (fixes.length) repaired.push([name, fixes.join(", ")]);

    const css = toCss(name, zh, blurb, vars, resolved, fixes);
    const path = join(OUT_DIR, `${name}.css`);
    if (check) {
      const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
      if (existing !== css) {
        console.error(`STALE: ${name}.css differs from the generator's output.`);
        process.exit(1);
      }
    } else {
      writeFileSync(path, css);
    }
    kept.push([name, zh]);
  }

  console.log(`kept ${kept.length}: ${kept.map(([n, z]) => `${z}(${n})`).join(", ")}`);
  if (repaired.length) {
    console.log(`repaired ${repaired.length}:`);
    for (const [n, what] of repaired) console.log(`  ${n} -- ${what}`);
  }
  if (dropped.length) {
    console.log(`dropped ${dropped.length}:`);
    for (const [n, why] of dropped) console.log(`  ${n} -- ${why}`);
  }
  if (check) console.log("up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

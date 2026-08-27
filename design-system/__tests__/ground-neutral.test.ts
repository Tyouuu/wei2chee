import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 底色一律是中性。
 *
 * ── THE RULE, AND WHERE THE NUMBER COMES FROM ─────────────────────────────
 *
 * The founder, 2026-08-27: 「不要做那么多花哨的颜色 你可以去深度research一下 那些
 * 成熟跟好看的landing pages都不是用这些花哨的颜色…这些鲜艳的颜色只会是配色 跟着
 * 就没有人会使用来当底色」, and when the reply was that a coloured ground might
 * still hold on a dashboard: 「我觉得在后台也站不住」.
 *
 * Two independent samples say the same thing.
 *
 *   TEN LANDING PAGES, 2026-08-27, dominant colour of a 1440px screenshot:
 *     #080808  linear · framer · shopify · tailark · launch-ui
 *     #f8f8f8  stripe · vercel · notion · figma · intercom
 *     chroma of that ground: 0.000 on all ten.
 *
 *   NINE BUSINESS SYSTEMS, 2026-08-26 (docs/founder-tasks.md task 16):
 *     grounds 9/9 neutral, primaries 9/9 coloured.
 *
 * The colour is real in both samples -- peak chroma 0.193 on stripe, 0.235 on
 * our own 粗野 -- and it lives in the accent. Never in the page.
 *
 * ── WHY A TEST AND NOT A NOTE ─────────────────────────────────────────────
 *
 * 漆 shipped as 「the first register whose GROUND is a colour」 with a written
 * argument for it, and it was wrong for eleven days without anything catching
 * it. A rule the founder has to restate is a rule that belongs in the build.
 *
 * The threshold is 0.02, not 0.000: 瓷's cream sits at 0.018 and 宣纸's warm
 * paper at 0.013, and a ground with a hint of hue is what every good neutral
 * has. What is excluded is a ground that is a COLOUR -- 漆's oxblood was 0.112,
 * six times the widest thing here.
 */

const TOKENS = "design-system/tokens";
const PALETTES = "design-system/palettes";
const LIMIT = 0.02;

/** sRGB hex or an `oklch(l c h)` literal -> OKLab chroma. Both forms appear:
 *  the register files are hand-written hex, the palette files are generated
 *  oklch by build-palettes.mjs. */
function chromaOf(value: string): number | null {
  const ok = value.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)/);
  if (ok) return Number(ok[2]);

  const hex = value.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hex) return null;
  let h = hex[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(A, B);
}

/** First declaration of each `--token: <colour>;` in a stylesheet. */
function firstValues(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of css.split(/\r?\n/)) {
    const m = line.match(/^\s*(--[a-z0-9-]+):\s*([^;]+);/);
    if (m && !(m[1] in out)) out[m[1]] = m[2].trim();
  }
  return out;
}

const files = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => [f.replace(".css", ""), readFileSync(join(dir, f), "utf8")] as const);

describe("the page ground is never a colour", () => {
  it("holds for every 风格", () => {
    const over: string[] = [];
    for (const [name, css] of files(TOKENS)) {
      const c = chromaOf(firstValues(css)["--color-canvas"] ?? "");
      if (c === null) continue;
      if (c > LIMIT) over.push(`${name} ${c.toFixed(3)}`);
    }
    expect(over, `a register's ground is a colour (limit ${LIMIT})`).toEqual([]);
  });

  it("holds for every 配色", () => {
    const over: string[] = [];
    for (const [name, css] of files(PALETTES)) {
      const c = chromaOf(firstValues(css)["--color-canvas"] ?? "");
      if (c === null) continue;
      if (c > LIMIT) over.push(`${name} ${c.toFixed(3)}`);
    }
    expect(over, `a palette's ground is a colour (limit ${LIMIT})`).toEqual([]);
  });

  it("still lets the accent be a colour", () => {
    // The other half of the finding, and the half that keeps the library from
    // going grey: every reference that has a neutral ground has a saturated
    // primary. A register whose primary went neutral too would have thrown the
    // colour away rather than moved it.
    const flat: string[] = [];
    for (const [name, css] of files(TOKENS)) {
      const c = chromaOf(firstValues(css)["--color-primary"] ?? "");
      if (c === null) continue;
      // 工作室 is deliberately achromatic -- its whole argument is that colour
      // appears only on the rise-and-fall pills. It is the one exception and
      // it is named, not tolerated by a loose threshold.
      if (name === "studio") continue;
      if (c < 0.05) flat.push(`${name} ${c.toFixed(3)}`);
    }
    expect(flat, "a register threw its colour away instead of moving it").toEqual([]);
  });
});

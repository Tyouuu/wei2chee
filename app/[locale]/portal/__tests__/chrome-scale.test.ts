import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";

/**
 * THE GATE.
 *
 * `chrome.module.css` has always defined a full scale -- --text-micro through
 * --text-hero, --radius-xs through --radius-pill -- written carefully, with
 * comments explaining each value. It did not hold. Measured on 2026-08-21,
 * before this file existed:
 *
 *   var(--text-*) used ........ 41 times
 *   text-[Npx] hardcoded ...... 96 times   (70% of all sizing)
 *
 * and the hardcoded values were mostly not even ON the scale: text-[12.5px]
 * sixteen times, text-[12px] eight, text-[17px] six, rounded-[9px] twelve --
 * that last one sitting between --radius-md and --radius-lg without existing
 * in the token file at all. The result measured in a real browser was fifteen
 * font sizes and seven radii on one product.
 *
 * Nothing had gone wrong with the design system. Nothing was STOPPING a
 * `text-[12.5px]` from being merged, so over four rounds of work the code
 * drifted off its own scale one plausible-looking number at a time.
 *
 * So this is the point of the test, and it is worth being blunt about it:
 * redefining the scale without adding this gate would buy about three weeks
 * before there were fifteen sizes again -- just different ones. The scale is
 * only a scale if something enforces it.
 *
 * NOT a lint rule, because a lint rule is a thing you can add `eslint-disable`
 * to in the moment you are in a hurry, which is exactly the moment this
 * happened.
 */

const SIZE = /\btext-\[[0-9.]+(px|rem|em)\]/g;
const RADIUS = /\brounded-(?:[a-z]+-)?\[[0-9.]+(px|rem|em)\]/g;

/**
 * Files the chrome's scale governs: the signed-in product, and only that.
 *
 * Two neighbours are deliberately OUT, for the same reason in both cases --
 * the tokens are not in scope there, so a var(--text-sm) written in one of
 * them resolves to nothing and silently collapses to the inherited size. That
 * is worse than a hardcoded value, not better, and it is exactly what happened
 * when this rule was first written too broadly: the login headline was put on
 * var(--text-hero), rendered at body size, and a browser screenshot was the
 * only thing that caught it.
 *
 *   design-system/     answers to design-system/tokens/*.css and to whichever
 *                      style the CUSTOMER picked -- a different scale with a
 *                      different owner, resolved inside the sheet.
 *   components/auth-*  sits on the marketing side of the sign-in boundary and
 *                      is styled from app/globals.css, which has no --text-*
 *                      of its own (Tailwind v4 owns those names there).
 */
function chromeFiles(): string[] {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
  return tracked.filter(
    (f) => f.endsWith(".tsx") && f.includes("app/[locale]/portal/") && !f.includes("__tests__"),
  );
}

describe("Formae's chrome stays on its own scale", () => {
  const files = chromeFiles();

  it("finds the chrome files at all", () => {
    // Guards the glob: if this ever returned nothing, every test below would
    // pass vacuously while the drift resumed.
    expect(files.length).toBeGreaterThan(15);
  });

  it("hardcodes no font size", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      for (const m of src.match(SIZE) ?? []) offenders.push(`${f}: ${m}`);
    }
    expect(
      offenders,
      `Use a token: [font-size:var(--text-micro|xs|sm|base|lg|title|hero)].\n` +
        `Seven sizes is the whole scale — if none of them is right, the fix is\n` +
        `to change the scale in chrome.module.css, not to opt out of it here.\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("hardcodes no border radius", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      for (const m of src.match(RADIUS) ?? []) offenders.push(`${f}: ${m}`);
    }
    expect(
      offenders,
      `Use a token: rounded-[var(--radius-xs|sm|md|lg|control|pill)].\n` + offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("the scale itself", () => {
  const css = readFileSync(
    join(process.cwd(), "app", "[locale]", "portal", "chrome.module.css"),
    "utf8",
  );

  const px = (name: string) => {
    const m = css.match(new RegExp(`--${name}:\\s*([0-9.]+)px`));
    return m ? Number.parseFloat(m[1]) : NaN;
  };

  it("keeps a workhorse of at least 14px", () => {
    // Measured: both references run 14px as their most-used size; this chrome
    // ran 13px, a full step small AND a full weight light.
    expect(px("text-sm")).toBeGreaterThanOrEqual(14);
  });

  it("keeps a real jump between the workhorse and the display size", () => {
    // Durable goes 14 -> 72 (5.1x) with three text elements on the fold. This
    // chrome went 13 -> 40 (2.9x) and read flat. The jump IS the hierarchy;
    // intermediate steps never produced one.
    expect(px("text-hero") / px("text-sm")).toBeGreaterThanOrEqual(3.5);
  });

  it("keeps every step apart enough to read as a step", () => {
    // 13, 14 and 16 were all in heavy use at once. One pixel apart does not
    // read as two levels, it reads as one level set carelessly.
    const scale = ["text-micro", "text-xs", "text-sm", "text-base", "text-lg", "text-title"].map(px);
    for (let i = 1; i < scale.length; i++) {
      expect(scale[i] - scale[i - 1], `${scale[i - 1]}px -> ${scale[i]}px is not a step`).toBeGreaterThanOrEqual(1);
      expect(scale[i], `${scale[i - 1]}px -> ${scale[i]}px`).toBeGreaterThan(scale[i - 1]);
    }
  });

  it("defaults to weight 500, not 400", () => {
    // 21st.dev runs weight 500 on 462 of 468 text nodes on /components and 584
    // of 588 on /s/card. Hierarchy there is carried by ink colour and position,
    // never by bold. Formae ran 400 with a lot of 600 -- lighter AND noisier.
    expect(css).toMatch(/--fw-regular:\s*500/);
  });
});

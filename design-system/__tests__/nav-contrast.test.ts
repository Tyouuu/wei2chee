import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every word in every register's sidebar has to be readable.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 *
 * 任务 24 records a guard for exactly this -- 「改成对 token 档做单元测试，不用
 * 浏览器，十七套全查」 -- written after four registers shipped a rail whose
 * 「you are here」 row could not be read. That guard is not in this repo. Either
 * it never landed or it was lost, and the comment describing it outlived it,
 * which is the failure this codebase keeps naming: a comment claiming a guard
 * stops the next person looking.
 *
 * What it cost: 中台's whole sidebar -- brand line, all seven nav items, the
 * owner's name and his role -- shipped at 3.39:1 on #001529, at 13px. The
 * token file's own comment above the value claims 「fg-dim 6.44:1」. Measured
 * by check:contrast in a browser on 2026-08-31: nineteen strings under 4.5:1,
 * every one of them the same pair.
 *
 * ── WHY THE TOKEN FILES AND NOT A BROWSER ─────────────────────────────────
 *
 * check:contrast has to log in, and it only ever measures the ONE register the
 * demo account happens to be wearing that minute. Six registers, one measured.
 * These are the values themselves, so all six are checked on every commit and
 * nothing has to be running.
 */

const DIR = join(process.cwd(), "design-system", "tokens");

const hex = (h: string): [number, number, number] => {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

const luminance = (c: [number, number, number]) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(hex(a)), luminance(hex(b))];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/** One register's token values, as written. Only literal hex is read: a value
 *  that is `var(--something)` is somebody else's to check, and guessing what
 *  it resolves to is how a ruler starts reporting numbers about nothing. */
function tokensOf(file: string): Record<string, string> {
  const css = readFileSync(join(DIR, file), "utf8");
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--color-nav-[a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const FILES = readdirSync(DIR).filter((f) => f.endsWith(".css"));

describe("every register's sidebar", () => {
  it("has one file per register and finds their rail colours", () => {
    // If this ever reads zero files the tests below all pass vacuously --
    // which is how a ruler goes quiet without anybody noticing.
    expect(FILES.length).toBeGreaterThan(3);
    for (const f of FILES) {
      expect(Object.keys(tokensOf(f)).length, `${f} declares no rail colours`).toBeGreaterThan(0);
    }
  });

  it.each(FILES)("%s: the rail's own words clear AA", (file) => {
    const t = tokensOf(file);
    const bg = t["--color-nav-bg"];
    if (!bg) return;
    for (const key of ["--color-nav-fg", "--color-nav-fg-dim"]) {
      const fg = t[key];
      if (!fg) continue;
      /* 4.5:1. The dim colour carries the section headings, the owner's name
         and his role -- 13px and 11.5px, which is not large text by any
         definition, so the large-text 3:1 allowance does not apply to it. */
      expect(
        Number(contrast(fg, bg).toFixed(2)),
        `${file} ${key} ${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(FILES)("%s: and on the row that says where you are", (file) => {
    const t = tokensOf(file);
    const active = t["--color-nav-active-bg"] ?? t["--color-nav-bg-deep"];
    const fg = t["--color-nav-fg"];
    if (!active || !fg) return;
    /* 粗野 shipped white on #ffe1ef here -- 1.17:1 on the one row whose entire
       job is to tell him which page he is on (任务 24). */
    expect(
      Number(contrast(fg, active).toFixed(2)),
      `${file} --color-nav-fg on ${active}`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

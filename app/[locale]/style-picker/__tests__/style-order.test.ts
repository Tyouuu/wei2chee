import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STYLE_ORDER } from "../style-column";

/**
 * A register nobody can choose.
 *
 * Swiss and Soft shipped on 2026-08-22 with token files, a generated scope
 * module, a migration widening `projects_style_check`, an entry in the editor's
 * own switcher and a card on the styles page. And no new customer could pick
 * either one, because the list of registers was written out by hand in five
 * places and two of them -- the public style picker and `style-select`, which
 * is the page a customer lands on immediately after signing up -- were never
 * updated.
 *
 * Nothing failed. The build passed, the types passed, 127 tests passed. It was
 * found by looking at the rendered picker and counting eight columns.
 *
 * There is one list now. This asserts it against the filesystem, which is the
 * only authority that cannot drift: a register exists exactly when its token
 * file does.
 */
describe("every register that exists can be chosen", () => {
  const onDisk = readdirSync(join(process.cwd(), "design-system", "tokens"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => f.replace(/\.css$/, ""))
    .sort();

  it("offers exactly the registers that have token files", () => {
    expect([...STYLE_ORDER].sort()).toEqual(onDisk);
  });

  it("is the only copy of the list", () => {
    // A second hand-written array of style names anywhere under app/ or lib/ is
    // the bug returning. Matched loosely on purpose -- any array literal that
    // names three or more registers in a row is one.
    const roots = ["app", "lib", "design-system"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "__tests__") continue;
          walk(p);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (p.endsWith(join("style-picker", "style-column.tsx"))) continue;
        const src = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        // Three or more quoted register names separated only by commas.
        const names = onDisk.join("|");
        const re = new RegExp(`"(?:${names})"\\s*,\\s*"(?:${names})"\\s*,\\s*"(?:${names})"`);
        if (re.test(src)) offenders.push(p);
      }
    };
    for (const r of roots) walk(join(process.cwd(), r));
    expect(offenders, "a second hand-written register list").toEqual([]);
  });
});

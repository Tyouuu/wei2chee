import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

/**
 * Every section must render the copy it is handed.
 *
 * See copy-override.test.tsx for the five blocks that did not. That test names
 * them; this one sweeps the whole library, because `no-unused-vars` -- which
 * found those five -- can only see one shape of the bug. A block that reads
 * SOME of the merged copy while rendering module-scope data for the rest is
 * the same defect and lint is blind to it.
 *
 * Method: replace every string leaf in the block's own exported `copy` with a
 * sentinel, render, and look for the sentinel. Non-text strings are left alone
 * -- a url turned into prose can throw inside a component that parses it, and
 * an icon name turned into prose renders nothing.
 */

const SENTINEL = "ZZQXCOPYPROBE";

/*
  WHAT THE HARNESS CANNOT JUDGE, WITH THE REASON EACH ONE WAS CHECKED.

  Not a list of accepted defects -- a list of blocks this method cannot reach a
  verdict on. Each was opened and read.
*/
const CANNOT_JUDGE = {
  /* Its team table is not server-rendered at all (it sits behind a tab), so the
     probe has nothing to find. It lands here rather than in not-server-rendered
     because the discriminator matched "Ada Lovelace" -- which appears in the
     markup as a hard-coded `value=` on the profile form, coincidentally the
     same name as the first team member. A false positive of the comparison,
     confirmed by mutating only teamMembers[].name and finding no trace. */
  blind: ["settings-3"],

  /* Thrown by the harness or by the probe, not by the block.
       - Tooltip needs a TooltipProvider, which the app supplies and this
         bare renderToStaticMarkup does not.
       - The others read a capitalised string as a LOOKUP KEY ("Default",
         "Outline"), which the probe rewrites; the map then misses. Lowercase
         keys are already skipped, capitalised ones are indistinguishable from
         prose without reading each component. */
  threw: [
    "app-shell-1",
    "app-shell-2",
    "roadmap-4",
    "sidebar-1",
    "sidebar-2",
    "table-2",
  ],
};

function probe(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === "string") {
    if (/^(https?:|\/|#|data:|mailto:)/.test(value)) return value;
    if (/^[A-Z][a-zA-Z]*Icon$|^Icon[A-Z]|^Ri[A-Z]/.test(value)) return value;
    /* A single lowercase word is almost always a KEY, not prose: `tone:
       "active"`, `variant: "secondary"`, `status: "dot"`. Rewriting those does
       not test anything -- it just makes the component look up a value that is
       not there and throw, which is the probe failing, not the block. Real copy
       has a space or a capital in it. */
    if (/^[a-z][a-z0-9_-]*$/.test(value)) return value;
    return `${SENTINEL} ${value}`;
  }
  if (Array.isArray(value)) return value.map((v) => probe(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, probe(v, depth + 1)]),
    );
  }
  return value;
}

/** The first string the probe WOULD have rewritten, so the two renders can be
 *  compared on the same leaf. */
function firstProbeableString(value: unknown, depth = 0): string | null {
  if (depth > 8) return null;
  if (typeof value === "string") return probe(value) === value ? null : value;
  if (Array.isArray(value)) {
    for (const v of value) {
      const hit = firstProbeableString(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const hit = firstProbeableString(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

const modules = import.meta.glob("./*.tsx", { eager: false }) as Record<
  string,
  () => Promise<{ default?: unknown; copy?: unknown }>
>;

const names = Object.keys(modules)
  .filter((p) => !p.includes(".test.") && !p.includes("/_"))
  .sort();

describe("section copy reaches the page", () => {
  /* Two hundred sections, each rendered once and a few of them twice. The
     5s default is not enough and a timeout here reads as a defect. */
  it("reports every block that ignores its copy", { timeout: 120_000 }, async () => {
    const blind: string[] = [];
    const notRendered: string[] = [];
    const threw: string[] = [];
    const noCopy: string[] = [];
    let ok = 0;

    for (const path of names) {
      const mod = await modules[path]();
      const name = path.replace("./", "").replace(".tsx", "");
      if (typeof mod.default !== "function" || !mod.copy || typeof mod.copy !== "object") {
        noCopy.push(name);
        continue;
      }
      try {
        const html = renderToStaticMarkup(
          createElement(mod.default as React.ComponentType<{ copy?: unknown }>, {
            copy: probe(mod.copy),
          }),
        );
        if (html.includes(SENTINEL)) {
          ok++;
        } else {
          /*
            NOT EVERY MISSING SENTINEL IS A DISCARDED EDIT.

            A block whose copy is all image URLs has nothing for the probe to
            rewrite, and one whose text lives inside a Radix portal -- a command
            dialog, a select's items, a collapsed panel -- renders none of it to
            static markup, edited or not. Guessing which is which by reading
            each component is how a baseline fills up with reasons nobody
            checked.

            So ask the block instead: render it AGAIN with its own untouched
            defaults and look for the same leaf. If the default does not appear
            either, this markup never carried that text and there is nothing to
            conclude. If the default DOES appear and the probed one does not,
            the override was dropped -- and that is the defect.
          */
          const leaf = firstProbeableString(mod.copy);
          const withDefaults = renderToStaticMarkup(
            createElement(mod.default as React.ComponentType<{ copy?: unknown }>, {
              copy: mod.copy,
            }),
          );
          if (leaf && withDefaults.includes(leaf)) blind.push(name);
          else notRendered.push(name);
        }
      } catch (e) {
        threw.push(`${name}: ${String((e as Error).message).slice(0, 70)}`);
      }
    }

    console.log(
      `\n  ok ${ok} · blind ${blind.length} · threw ${threw.length} · no copy ${noCopy.length}` +
        (blind.length ? `\n  BLIND: ${blind.join(", ")}` : "") +
        (threw.length ? `\n  THREW: ${threw.join(" | ")}` : ""),
    );
    /* The gate: nothing NEW may go blind or throw. A block that starts
       ignoring its copy tomorrow fails here, which is the whole point -- six of
       them had been doing it silently for months. */
    expect(blind.sort()).toEqual(CANNOT_JUDGE.blind.sort());
    expect(threw.map((t) => t.split(":")[0]).sort()).toEqual(CANNOT_JUDGE.threw.sort());
  });
});

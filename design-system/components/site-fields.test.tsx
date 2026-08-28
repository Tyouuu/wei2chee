import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { puckConfig } from "@/design-system/editor/puck-config";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { MODULE_KEYS } from "@/lib/portal/module-catalog";

/**
 * Every word an owner types into their public site must reach the page.
 *
 * WHY. `SiteHero` declares an `eyebrow` field — 「地区 · 行业」 — types it and
 * receives it, and no JSX in the file uses it. A comment further down describes
 * what it used to render, so a refactor dropped it: the owner fills in their
 * area and trade on the FIRST SCREEN of their public website and it never
 * appears. Nothing threw. It surfaced only because `no-unused-vars` happened to
 * notice an unused destructured prop once the lint gate was configured, which
 * is luck rather than a gate.
 *
 * WHY THE PROPS COME FROM buildPageLayout AND NOT FROM `defaultProps`. The
 * first attempt rendered each component with its Puck defaultProps plus one
 * sentinel and reported 28 dead fields — which was the harness failing, not the
 * product: SiteFeatures' defaultProps carry only `items`, and rendered alone it
 * returns an empty string. buildPageLayout is what actually produces a
 * customer's website, so its output is what a field has to survive.
 *
 * text / textarea only, deliberately: those are the fields an owner types words
 * into, and "my words are not on my website" is what this is about. Arrays,
 * selects and custom fields carry structure, ids and colour tokens.
 */

const SENTINEL = "ZZQXFIELDPROBE";

/*
  NOT ASKED OF EVERY COMPONENT.

  SiteBlock renders one of the 200 pulled sections; its words come from `copy`,
  which copy-reaches-page.test.tsx already sweeps. RailNav is Formae's own
  chrome rather than the customer's words, and it calls usePathname(), which is
  null outside Next's router -- every field on it throws here. What it says is
  our copy, governed by the locale, and check:en walks it in a real browser.
*/
const NOT_THIS_TEST = new Set(["SiteBlock", "RailNav"]);

/*
  CONDITIONAL, NOT DROPPED -- each one opened and confirmed.

  A field that renders only when the data says so is not a lost word. They are
  listed with the condition rather than assumed, because "it is probably
  conditional" is how a real defect gets waved through.
*/
const ONLY_UNDER_CONDITIONS = new Set([
  // filter-chips.tsx puts the clear-all link behind `chips.length > 1`, and a
  // generated page carries one chip.
  "FilterChips.clearAllHref",
  "FilterChips.clearAllLabel",
  // listbox.tsx: `selected?.label ?? placeholder ?? …`. The generated page has
  // a selection, so the placeholder is correctly absent.
  "Listbox.placeholder",
  // trend-chart.tsx uses it inside the Recharts tooltip formatter, which exists
  // on hover and never in static markup.
  "TrendChart.unit",
]);


/* A phone field is sanitised to digits before it is used -- FloatingContact
   does `number.replace(/[^\d]/g, "")` to build a wa.me link -- so a sentinel
   made of letters cannot survive it. Probe those with digits instead. */
const DIGIT_SENTINEL = "0199887766";
const looksNumeric = (v: string) => /^[\d\s+()-]{6,}$/.test(v);

/* The value to look for, given what is already in the field. */
const probeFor = (current: string) =>
  looksNumeric(current)
    ? { value: DIGIT_SENTINEL, expect: DIGIT_SENTINEL }
    : { value: `${SENTINEL} ${current}`, expect: SENTINEL };

type Field = { type?: string };
type Entry = {
  fields?: Record<string, Field>;
  render?: (props: Record<string, unknown>) => React.ReactElement;
};
type Node = { type: string; props: Record<string, unknown> };

const components = (puckConfig.components ?? {}) as unknown as Record<string, Entry>;

/*
  NOT ONLY THE WEBSITE.

  The public site is where a dropped word is most expensive, but the owner edits
  their internal pages too, and a field that never renders is exactly as
  invisible there. MODULE_KEYS is the closed catalogue the generator builds
  from, so walking it means a module added tomorrow is covered without anyone
  remembering this file exists.
*/
const CTX = {
  industry: {
    slug: "renovation",
    name_zh: "装修/承包商",
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: ["Customer", "Quotation", "Project", "Payment"],
    suggested_modules: [],
  },
  lang: "en",
} as never;

/** Flattened: the shell nests pages inside slots, and a field that only ever
 *  renders three levels down is still a field the owner typed into. */
function walk(nodes: Node[] | undefined, out: Node[] = []): Node[] {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    out.push(n);
    for (const v of Object.values(n.props ?? {})) {
      if (Array.isArray(v)) walk(v as Node[], out);
    }
  }
  return out;
}

const pages = MODULE_KEYS.map((key) => ({
  key,
  nodes: walk(
    (buildPageLayout(key, CTX, "Xingfa Renovation", "en") as unknown as { content: Node[] })
      .content,
  ),
}));

describe("public site fields reach the page", () => {
  it("reports every text field the page ignores", { timeout: 120_000 }, () => {
    const dropped: string[] = [];
    const threw: string[] = [];
    let checked = 0;

    for (const { key: pageKey, nodes } of pages)
    for (const node of nodes) {
      if (NOT_THIS_TEST.has(node.type)) continue;
      const entry = components[node.type];
      if (typeof entry?.render !== "function" || !entry.fields) continue;
      // Narrowed once here so the closure below does not have to re-prove it.
      const render = entry.render;

      for (const [key, field] of Object.entries(entry.fields)) {
        if (field?.type !== "text" && field?.type !== "textarea") continue;
        // Only probe what this page actually carries: a field the generator
        // left empty is not a dropped word, it is an empty field.
        if (typeof node.props[key] !== "string" || !node.props[key]) continue;
        checked++;
        const { value, expect: want } = probeFor(node.props[key] as string);
        try {
          const shows = (extra: Record<string, unknown> = {}) =>
            renderToStaticMarkup(
              render({ ...node.props, ...extra, [key]: value }),
            ).includes(want);

          /* A field can belong to ONE SHAPE. SiteFeatures' `noteHeading` renders
             beside the heading in some variants and not in others, and the page
             the generator produced happens to use one of the others -- which is
             a field that is conditional, not a field that is dropped. So when
             the generated shape does not show it, try the shapes the editor
             itself offers before calling it lost. */
          let seen = shows();
          if (!seen) {
            const shapeField = ["shape", "variant", "layout"].find(
              (f) => (entry.fields?.[f] as { options?: { value: unknown }[] })?.options,
            );
            const options =
              (entry.fields?.[shapeField ?? ""] as { options?: { value: unknown }[] })?.options ?? [];
            for (const opt of options) {
              if (shows({ [shapeField as string]: opt.value })) { seen = true; break; }
            }
          }
          if (!seen && !ONLY_UNDER_CONDITIONS.has(`${node.type}.${key}`)) {
            dropped.push(`${pageKey}/${node.type}.${key}`);
          }
        } catch (e) {
          threw.push(`${pageKey}/${node.type}.${key}: ${String((e as Error).message).slice(0, 60)}`);
        }
      }
    }

    console.log(
      `\n  checked ${checked} · dropped ${dropped.length} · threw ${threw.length}` +
        (dropped.length ? `\n  DROPPED: ${dropped.join(", ")}` : "") +
        (threw.length ? `\n  THREW: ${threw.join(" | ")}` : ""),
    );
    /*
      A DEBT, NOT AN ACCEPTED STATE.

      SiteHero.eyebrow is a live defect: the owner's 「地区 · 行业」 is typed on
      the first screen of their public website and never rendered. It is listed
      here only so this gate can run and catch the NEXT one — see
      docs/founder-tasks.md task 51. This list must shrink to nothing; anything
      joining it is a new field that stopped reaching the page.

      Not fixed in this commit because site-hero.tsx belongs to the other
      session working in this same tree today, and two sessions writing one file
      is how work gets lost.
    */
    expect({ dropped: [...new Set(dropped)].sort(), threw }).toEqual({
      dropped: ["website/SiteHero.eyebrow"],
      threw: [],
    });
  });
});

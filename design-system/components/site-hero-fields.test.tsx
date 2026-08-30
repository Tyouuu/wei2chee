import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { puckConfig } from "@/design-system/editor/puck-config";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { heroDeadFields } from "./site-hero";
import { TEXT_FIELDS_BY_COMPONENT } from "@/lib/portal/layout-ops";
import { SITE_COMPOSITION, NEUTRAL_SKELETON } from "@/lib/templates/site-composition";

/**
 * `heroDeadFields` says which words never reach the first screen. This renders
 * every layout and checks that it is telling the truth.
 *
 * WHY IT IS NOT ENOUGH THAT site-fields.test.tsx EXISTS. That gate asks 「does
 * this field render in ANY shape?」 and passes if one shape shows it. A customer
 * is not on any shape, they are on ONE — the one their register chose — and on
 * three of these the headline has no slot. So that gate was green while
 * 「把第一屏那句大标题改成…」 wrote a prop, reported 「改了 1 处」, and moved
 * nothing. `eval:browser` found it on 2026-08-31; this is what holds it down.
 *
 * The direction matters: the list may not claim a field is dead that actually
 * renders EITHER. A refusal the customer did not need is its own broken
 * promise, and it would send them away from a field that works.
 */

const SENTINEL = "ZZHEROPROBE";
const PHOTO = "https://example.test/site-photos/x.jpg";

type Entry = {
  fields?: Record<string, { type?: string }>;
  render?: (p: Record<string, unknown>) => React.ReactElement;
};
type Node = { type: string; props: Record<string, unknown> };

const hero = (puckConfig.components as unknown as Record<string, Entry>).SiteHero;

/* The props a real customer's first screen carries, not defaultProps: a hero
   rendered from its defaults alone is a different component from the one on
   anybody's website. Same reasoning as site-fields.test.tsx. */
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

function findHero(nodes: Node[] | undefined): Node | null {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object") continue;
    if (n.type === "SiteHero") return n;
    for (const v of Object.values(n.props ?? {})) {
      if (Array.isArray(v)) {
        const hit = findHero(v as Node[]);
        if (hit) return hit;
      }
    }
  }
  return null;
}

const base = findHero(
  (buildPageLayout("website", CTX, "Xingfa Renovation", "en") as unknown as { content: Node[] })
    .content,
);

/** Text fields carrying words on a generated page. A field the generator left
 *  empty is not a lost word, it is an empty field. */
const probed = (TEXT_FIELDS_BY_COMPONENT.SiteHero ?? [])
  .filter((k) => typeof base?.props?.[k] === "string" && base.props[k]);

/* A phone number is stripped to digits before it is used, so a letter sentinel
   cannot survive it -- probe those with digits. Dropping the field instead
   would leave the one word on this screen a stranger actually dials untested. */
const looksNumeric = (v: string) => /^[\d\s+()-]{6,}$/.test(v);
const probe = (k: string) =>
  looksNumeric(String(base?.props?.[k]))
    ? { value: "0199887766", want: "0199887766" }
    : { value: `${SENTINEL} ${base?.props?.[k]}`, want: SENTINEL };

describe("SiteHero tells the truth about which of its fields render", () => {
  it("has a hero to probe", () => {
    expect(base, "buildPageLayout('website') produced no SiteHero").toBeTruthy();
    expect(probed.length).toBeGreaterThan(3);
  });

  /* Every layout a customer can actually be on, times the one other input
     those branches switch on. Read off SITE_COMPOSITION rather than listed, so
     a register added tomorrow is covered without anyone remembering this file
     exists — and so a layout NOBODY uses is not held to a contract nobody
     depends on. */
  const layouts = [
    ...new Set([
      ...Object.values(SITE_COMPOSITION).map((c) => c.hero),
      NEUTRAL_SKELETON.hero,
    ]),
  ].sort();

  for (const layout of layouts) {
    for (const photo of ["", PHOTO]) {
      it(`${layout}${photo ? " + photo" : ""}`, () => {
        const seen: string[] = [];
        for (const key of probed) {
          const { value, want } = probe(key);
          const html = renderToStaticMarkup(
            hero!.render!({ ...base!.props, layout, photo, [key]: value }),
          );
          if (!html.includes(want)) seen.push(key);
        }
        expect(seen.sort()).toEqual(heroDeadFields({ layout, photo }).sort());
      });
    }
  }
});

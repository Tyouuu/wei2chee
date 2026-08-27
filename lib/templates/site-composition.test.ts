import { describe, it, expect } from "vitest";
import { SITE_COMPOSITION, composeSite, siteSkeleton } from "./site-composition";
import { LANDING_TEMPLATES } from "./landing-templates";
import {
  buildPageLayout,
  landingContentFor,
  pagesForIndustry,
  type BusinessContext,
} from "./industry-template";
import { STYLE_BRIEFS } from "@/lib/portal/design-doc";
import { VARIANTS } from "@/design-system/editor/variants";

/**
 * 官网骨架的尺子。
 *
 * The dashboard composition got a test like this after a whole class of
 * failure went unnoticed for days: `prefer` is a Record<string, string>, so a
 * register naming a variant that does not exist is invisible to TypeScript and
 * silently means "no opinion". A register naming a SECTION that no template
 * builds would fail the same way -- quietly, as "that register just looks like
 * 图纸" -- which is exactly the complaint this whole layer exists to answer.
 */

const MOVABLE = [
  "services",
  "work",
  "prices",
  "flow",
  "reviews",
  "cta",
  "areas",
  "faq",
  "promise",
  "hours",
  "creds",
  "story",
];

const renovation: BusinessContext = {
  industry: {
    slug: "renovation",
    name_zh: "装修/承包商",
    labels: { customer: "客户", order: "项目", staff: "师傅" },
    default_workflow: ["Customer", "Quotation", "Approval", "Deposit", "Project", "Final Payment"],
    suggested_modules: ["Customer", "Quotation", "Project", "Payment"],
  },
};

type Node = { type: string; props: Record<string, unknown> };

const websiteFor = (style: string | null) =>
  (buildPageLayout("website", renovation, "兴发装修", "zh", undefined, style) as unknown as {
    content: Node[];
  }).content;

const idsOf = (nodes: Node[]) => nodes.map((n) => String(n.props.id));
const sectionsOf = (nodes: Node[]) =>
  idsOf(nodes)
    .map((id) => id.replace(/^website-/, ""))
    .filter((k) => MOVABLE.includes(k));

describe("SITE_COMPOSITION", () => {
  it("covers every register in the library", () => {
    for (const style of Object.keys(STYLE_BRIEFS)) {
      expect(SITE_COMPOSITION[style], `${style} has no website skeleton`).toBeDefined();
    }
  });

  it("orders every movable section exactly once", () => {
    // Partial orders are legal to the composer -- unlisted sections fall back
    // to the template's own position -- but a partial order means the register
    // has NO OPINION about part of its own page, and two registers with no
    // opinion converge on the template. Full coverage is what makes fourteen
    // skeletons fourteen.
    for (const [style, s] of Object.entries(SITE_COMPOSITION)) {
      expect(new Set(s.order).size, `${style} repeats a section`).toBe(s.order.length);
      expect([...s.order].sort()).toEqual([...MOVABLE].sort());
    }
  });

  it("gives no two registers the same opening", () => {
    // 重点 7c: 换个配色它还是不是另一个设计？ On a website the answer lives in the
    // first screen and the section under it -- that is all a stranger sees
    // before they decide to scroll or leave.
    const seen = new Map<string, string>();
    for (const [style, s] of Object.entries(SITE_COMPOSITION)) {
      const key = `${s.hero}/${s.order[0]}/${s.order[1]}`;
      expect(seen.has(key), `${style} opens exactly like ${seen.get(key)}: ${key}`).toBe(false);
      seen.set(key, style);
    }
  });

  it("uses hero layouts SiteHero actually has", () => {
    /* READ FROM THE VARIANTS, NOT TYPED AGAIN. This was a literal array and it
       went stale the hour 舞台 was added -- the fourth hand-written second copy
       of a list this repo has had to delete. `variants.ts` is what the 换款式
       picker renders from, so it is the list that cannot be wrong. */
    const ids = (VARIANTS.SiteHero ?? []).map((v) => v.id);
    expect(ids.length, "SiteHero has no variants").toBeGreaterThan(0);
    for (const [style, s] of Object.entries(SITE_COMPOSITION)) {
      expect(ids, style).toContain(s.hero);
    }
  });

  it("falls back to 图纸 for an unknown register", () => {
    expect(siteSkeleton("no-such-register")).toBe(SITE_COMPOSITION.blueprint);
    expect(siteSkeleton(null)).toBe(SITE_COMPOSITION.blueprint);
  });
});

describe("composeSite", () => {
  /* The REAL content bag, not a hand-written stub. The first version of this
     test built one by hand and every template threw on `c.words.sections`:
     a fixture that has to keep up with copy/landing.ts is a second copy of it
     that drifts. `landingContentFor` is exported for exactly this reason. */
  const bag = landingContentFor(renovation, pagesForIndustry("renovation").map((key) => ({ key })));
  const content = (t: (typeof LANDING_TEMPLATES)[number]) => t.build(bag) as Node[];

  it("keeps every block the template built, for every register", () => {
    // A register reorders. A register that DROPS a section would be a register
    // that deletes the owner's own prices or photographs -- the one thing this
    // layer must never do, and the reason it is not modelled on the dashboard
    // composition's freedom to omit blocks.
    for (const t of LANDING_TEMPLATES) {
      const built = content(t);
      for (const style of Object.keys(SITE_COMPOSITION)) {
        const out = composeSite(built, style);
        expect(idsOf(out).sort(), `${t.key} × ${style}`).toEqual(idsOf(built).sort());
        expect(out.length).toBe(built.length);
      }
    }
  });

  it("leads with the register's own first section", () => {
    for (const t of LANDING_TEMPLATES) {
      const built = content(t);
      const has = new Set(sectionsOf(built));
      for (const [style, s] of Object.entries(SITE_COMPOSITION)) {
        const wanted = s.order.find((k) => has.has(k));
        if (!wanted) continue;
        expect(sectionsOf(composeSite(built, style))[0], `${t.key} × ${style}`).toBe(wanted);
      }
    }
  });

  it("never moves the top bar, the form or the footer", () => {
    // The ask stays after the pitch and the chrome stays at the ends. A
    // register whose skeleton put the enquiry form second would be asking for
    // a phone number before saying what it sells.
    for (const t of LANDING_TEMPLATES) {
      const built = content(t);
      const fixed = (nodes: Node[]) =>
        idsOf(nodes).filter((id) =>
          ["website-bar", "website-form", "website-contact", "website-foot", "website-floating"].includes(id),
        );
      for (const style of Object.keys(SITE_COMPOSITION)) {
        expect(fixed(composeSite(built, style)), `${t.key} × ${style}`).toEqual(fixed(built));
      }
    }
  });

  it("applies the register's first screen, but not a figure-less split", () => {
    for (const t of LANDING_TEMPLATES) {
      const built = content(t);
      for (const [style, s] of Object.entries(SITE_COMPOSITION)) {
        const hero = composeSite(built, style).find((n) => n.props.id === "website-hero")!;
        if (s.hero === "split" && !hero.props.figure) continue;
        expect(hero.props.layout, `${t.key} × ${style}`).toBe(s.hero);
      }
    }
  });
});

describe("the website a real business gets", () => {
  it("is a different skeleton per register, end to end", () => {
    // Not the composer in isolation -- buildPageLayout, the function the page
    // actually calls, with the style it actually passes. The wire was missing
    // for a week and unit tests on the composer would all have passed.
    const shapes = new Map<string, string[]>();
    for (const style of Object.keys(SITE_COMPOSITION)) {
      shapes.set(style, sectionsOf(websiteFor(style)));
    }
    const distinct = new Set([...shapes.values()].map((s) => s.join(">")));
    expect(distinct.size).toBeGreaterThanOrEqual(10);
  });

  it("opens on what the register says it opens on", () => {
    for (const [style, s] of Object.entries(SITE_COMPOSITION)) {
      const sections = sectionsOf(websiteFor(style));
      const wanted = s.order.find((k) => sections.includes(k));
      expect(sections[0], style).toBe(wanted);
    }
  });

  it("still builds a website for a register with no skeleton", () => {
    expect(sectionsOf(websiteFor("no-such-register")).length).toBeGreaterThan(0);
  });
});

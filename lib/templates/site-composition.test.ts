import { describe, it, expect } from "vitest";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";
import { SITE_COMPOSITION, composeSite, siteSkeleton, MOVABLE as MOVABLE_SECTIONS } from "./site-composition";
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

/* READ, NOT KEPT. This was a hand-written copy of the list in
   site-composition.ts -- the pattern that has bitten this repo at least six
   times, where a second copy outlives the thing it describes. It went stale
   within a day: 一条满边的照片 joined MOVABLE on 2026-08-27 and this list did
   not know, so the guard failed on the real code being right. */
const MOVABLE = MOVABLE_SECTIONS as readonly string[];

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

  it("drops only what its register declared, and nothing else", () => {
    /* THE INVARIANT, AND HOW IT CHANGED ON 2026-08-27.
    
       It used to be 「a register never drops anything」, and the reason was
       right: a register that deletes a section deletes the owner's own prices
       or photographs. What made it too strict is that `order` is a TOTAL
       ordering, so every register carried all thirteen sections and could only
       argue about where they went -- and six pages of the same twelve bands
       shuffled is one design with six sort orders, which is what the founder
       kept seeing.
    
       So a register may now DECLINE a section, and this asserts the declining
       is deliberate: the only ids missing may be the ones its skeleton names in
       `omit`. Anything else disappearing is still the bug the old assertion was
       written to catch.
    
       And it is safe only because composeSite runs while the page is still
       being generated -- the public route reads the SAVED layout and 404s
       without one, so nothing here ever touches a page the customer owns. */
    for (const t of LANDING_TEMPLATES) {
      const built = content(t);
      for (const [style, skeleton] of Object.entries(SITE_COMPOSITION)) {
        const out = composeSite(built, style);
        const gone = idsOf(built).filter((id) => !idsOf(out).includes(id));
        const allowed = (skeleton.omit ?? []).map((k) => `website-${k}`);
        expect(gone.sort(), `${t.key} × ${style} dropped something it never declared`)
          .toEqual(allowed.filter((id) => idsOf(built).includes(id)).sort());
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
    /* SIX, AND ALL SIX. The number was 10 when the library held fourteen
       registers -- a floor, not a target, because four collisions out of
       fourteen was tolerable. After the cull of 2026-08-27 there are six, and
       the honest assertion is that EVERY one is a distinct skeleton: a library
       of six with two that match is a library of five pretending. */
    expect(distinct.size).toBe(STYLE_ORDER.length);
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

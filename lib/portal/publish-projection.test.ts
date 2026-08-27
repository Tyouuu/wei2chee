import { describe, expect, it } from "vitest";
import { forPublication } from "@/lib/portal/publish-projection";
import { LANDING_TEMPLATES } from "@/lib/templates/landing-templates";
import type { PuckLayout, PuckNode } from "@/lib/portal/layout-ops";
import type { LandingContent } from "@/lib/templates/landing-templates";
import { landingContentFor, pagesForIndustry } from "@/lib/templates/industry-template";

/*
  THE REAL CONTENT BAG, NOT A HAND-WRITTEN ONE.

  This was a literal that spelled out every string the six templates read. It
  broke three times in one day, on 2026-08-27, each time a section gained a
  field -- and each break looked like a failure of the thing being tested
  rather than of the fixture. A copy of copy/landing.ts is a copy that drifts,
  and this file's whole subject is what reaches a stranger, so it must be built
  from what the product actually builds.

  The seeded phone number matters and is deliberate: `landingContentFor` marks
  it `placeholder: true` for a business with no number of its own, which is the
  exact condition every assertion below is about.
*/
const CONTENT: LandingContent = landingContentFor(
  {
    industry: {
      slug: "renovation",
      name_zh: "装修/承包商",
      labels: { customer: "客户", order: "项目", staff: "师傅" },
      default_workflow: ["Customer", "Quotation", "Deposit", "Project"],
      suggested_modules: ["Customer", "Quotation", "Project", "Payment"],
    },
  },
  pagesForIndustry("renovation").map((key) => ({ key })),
);

function nodesOf(layout: PuckLayout): PuckNode[] {
  return layout.content ?? [];
}

describe("forPublication", () => {
  /*
    AN UNFILLED CERTIFICATION IS A FABRICATED ONE.

    SiteCreds asks the owner for a licence, an authorised-brand badge and a
    review score. Everything it asks for is a claim about the world that only
    they can make, so the prompt has to stay a prompt: the section reaches the
    editor and never the visitor until something real is typed into it. This is
    the same rule the seeded phone number failed on 2026-08-26, when
    「WhatsApp 012-345 6789」 went out on a live page.
  */
  it("never publishes a credential nobody has filled in", () => {
    for (const tpl of LANDING_TEMPLATES) {
      const built: PuckLayout = { root: {}, content: tpl.build(CONTENT) as PuckNode[] };
      expect(nodesOf(built).some((n) => n.type === "SiteCreds"), tpl.key).toBe(true);
      expect(nodesOf(forPublication(built)).some((n) => n.type === "SiteCreds"), tpl.key).toBe(false);
    }
  });

  it("publishes it as soon as one is real", () => {
    const tpl = LANDING_TEMPLATES[0];
    const built: PuckLayout = { root: {}, content: tpl.build(CONTENT) as PuckNode[] };
    const withOne = {
      ...built,
      content: nodesOf(built).map((n) =>
        n.type === "SiteCreds"
          ? { ...n, props: { ...n.props, items: [{ label: "JKKP certified", note: "" }] } }
          : n,
      ),
    };
    expect(nodesOf(forPublication(withOne)).some((n) => n.type === "SiteCreds")).toBe(true);
  });

  it("removes the owner-facing arrow note from every landing template", () => {
    for (const tpl of LANDING_TEMPLATES) {
      const built: PuckLayout = { root: {}, content: tpl.build(CONTENT) as PuckNode[] };
      const published = forPublication(built);

      for (const node of nodesOf(published)) {
        if (node.type !== "EnquiryForm") continue;
        for (const key of ["landsIn", "landsInBadge", "landsInBefore", "landsInAfter"]) {
          expect(node.props, `${tpl.key} kept ${key}`).not.toHaveProperty(key);
        }
      }
    }
  });

  it("leaves everything the visitor is meant to read", () => {
    const tpl = LANDING_TEMPLATES.find((t) => t.key === "quote")!;
    const built: PuckLayout = { root: {}, content: tpl.build(CONTENT) as PuckNode[] };
    const published = forPublication(built);

    const form = nodesOf(published).find((n) => n.type === "EnquiryForm");
    expect(form?.props.heading).toBeTruthy();
    expect(form?.props.submitLabel).toBeTruthy();
    expect(form?.props.fields).toBeTruthy();

    /*
      SAME BLOCKS, SAME ORDER -- EXCEPT THE ONES THAT ARE EMPTY.

      This asserted 「a projection, not a filter」 and the rule changed on
      2026-08-26, deliberately. The founder opened the real published site on
      his phone and got three 4:3 grey boxes, one per screen, each saying
      「Add a photo」 with the same words repeated underneath as a caption. A
      homeowner scrolling that learns one thing: nobody finished this page.

      The frames are empty ON PURPOSE in the editor -- see the note on `work`
      in landing-templates.ts -- and that argument is addressed to the person
      BUILDING the page. It has nothing to say to the person reading it. So the
      prompt stays where it is a prompt and goes where it is not.
    */
    /*
      What survives is what the OWNER wrote. What goes is what the template
      wrote for them to replace: the three empty photo frames, the Columns that
      held only those, and the price list whose every row still reads 「RM —」.

      Asserted by naming what must remain rather than by diffing against the
      built page -- the built page contains the prompts by design, so a diff
      would only ever restate the filter.
    */
    const kept = nodesOf(published).map((n) => n.type);
    expect(kept).not.toContain("PhotoFrame");
    expect(kept).toContain("SiteHero");
    expect(kept).toContain("EnquiryForm");
    expect(kept).toContain("WorkflowStrip");
    expect(kept).toContain("FoldSection");

    /*
      NAMED, NOT COUNTED. This counted InfoRows and asserted 「one fewer」, which
      stopped meaning anything the moment a second one qualified for removal.
      Every id below is a decision worth stating out loud:

        website-areas    STAYS. Place names are real; nobody seeded them.
        website-prices   GOES. Every row still reads 「RM —」, which a visitor
                         reads as 「this business will not tell you what it
                         costs」, not as 「not filled in yet」.
        website-contact  GOES, and this is the one worth noticing -- with the
                         real content bag the only contact row is the SEEDED
                         012-345 6789. A contact section whose every line is
                         somebody else's number must not exist on a stranger's
                         page, which is the same call FloatingContact makes.
    */
    const keptIds = nodesOf(published).map((n) => n.props.id);
    expect(keptIds).toContain("website-areas");
    expect(keptIds).not.toContain("website-prices");
    expect(keptIds).not.toContain("website-contact");
  });

  it("keeps a photo frame that has a photo in it", () => {
    // The rule is about EMPTY, not about photos. A frame the owner has filled
    // is the whole point of the section.
    const built: PuckLayout = {
      root: {},
      content: [
        { type: "PhotoFrame", props: { id: "a", caption: "Add a photo" } },
        { type: "PhotoFrame", props: { id: "b", src: "/x.jpg", caption: "Taman Desa" } },
      ] as PuckNode[],
    };
    const kept = nodesOf(forPublication(built));
    expect(kept.map((n) => n.props.id)).toEqual(["b"]);
  });

  it("does not mutate the layout it was given", () => {
    const tpl = LANDING_TEMPLATES.find((t) => t.key === "quote")!;
    const built: PuckLayout = { root: {}, content: tpl.build(CONTENT) as PuckNode[] };
    forPublication(built);
    const form = nodesOf(built).find((n) => n.type === "EnquiryForm");
    expect(form?.props.landsIn).toBe("Quotations");
  });

  it("reaches blocks nested inside a shell's slots", () => {
    const layout: PuckLayout = {
      root: {},
      content: [
        {
          type: "SystemShell",
          props: {
            id: "shell",
            sidebar: [],
            main: [
              { type: "EnquiryForm", props: { id: "f", heading: "Hi", landsIn: "Quotations" } },
            ],
          },
        },
      ],
    };
    const out = forPublication(layout);
    const main = (out.content[0].props.main as PuckNode[])[0];
    expect(main.props).not.toHaveProperty("landsIn");
    expect(main.props.heading).toBe("Hi");
  });
});

describe("a placeholder never reaches a stranger", () => {
  /*
    The worst thing the live site was doing, and it is not a design defect. A
    real business's published page printed 「WhatsApp 012-345 6789」 and
    「Taman Desa, Kuala Lumpur」 -- neither of which is theirs. A homeowner
    reading it messages somebody else's phone and drives to the wrong address.
  */
  it("drops rows marked placeholder and keeps the ones the owner wrote", () => {
    const built: PuckLayout = {
      root: {},
      content: [
        {
          type: "InfoRows",
          props: {
            id: "contact",
            heading: "How to reach us",
            rows: [
              { label: "WhatsApp", value: "012-345 6789", placeholder: true },
              { label: "Address", value: "Taman Desa", placeholder: true },
              { label: "Parking", value: "Behind the shop" },
            ],
          },
        },
      ] as PuckNode[],
    };
    const rows = (forPublication(built).content[0] as PuckNode).props.rows as Record<string, unknown>[];
    expect(rows.map((r) => r.label)).toEqual(["Parking"]);
  });

  it("drops the whole block when every row was a placeholder", () => {
    const built: PuckLayout = {
      root: {},
      content: [
        {
          type: "InfoRows",
          props: {
            id: "prices",
            heading: "Prices",
            rows: [
              { label: "Home renovation", value: "RM —", placeholder: true },
              { label: "Kitchen", value: "RM —", placeholder: true },
            ],
          },
        },
      ] as PuckNode[],
    };
    // A price list where every price reads 「RM —」 does not say 「not filled in
    // yet」 to a visitor. It says this business will not tell you what it costs.
    expect(forPublication(built).content).toEqual([]);
  });

  it("does not mutate the rows it was given", () => {
    const rows = [{ label: "WhatsApp", value: "012-345 6789", placeholder: true }];
    const built: PuckLayout = {
      root: {},
      content: [{ type: "InfoRows", props: { id: "c", rows } }] as PuckNode[],
    };
    forPublication(built);
    expect(rows).toHaveLength(1);
  });

  /*
    THE FIRST SCREEN'S NEW HALF, AND THE RULE IT HAS TO OBEY.

    Added 2026-08-26 with the printed phone number, the hours strip and the
    floating WhatsApp button -- the three things both real Malaysian SME sites
    open with and ours did not. All three carry a seeded value until the owner
    types theirs, and a seeded phone number reaching a stranger is the worst
    thing this module exists to stop.
  */
  it("drops the hero's seeded number and hours but keeps the hero", () => {
    const page = {
      root: {},
      content: [
        {
          type: "SiteHero",
          props: {
            headline: "兴发装修工程",
            phoneLabel: "打给我们",
            phoneNumber: "012-345 6789",
            phonePlaceholder: true,
            strip: "Opening hours · Mon–Sat 9am–6pm",
            stripPlaceholder: true,
          },
        },
      ],
    };
    const out = forPublication(page as never) as typeof page;
    expect(out.content).toHaveLength(1);
    expect(out.content[0].props.headline).toBe("兴发装修工程");
    expect(out.content[0].props).not.toHaveProperty("phoneNumber");
    expect(out.content[0].props).not.toHaveProperty("strip");
  });

  it("keeps a number the owner actually typed", () => {
    const page = {
      root: {},
      content: [
        {
          type: "SiteHero",
          props: { headline: "兴发", phoneNumber: "016-800 1631", phonePlaceholder: false },
        },
      ],
    };
    const out = forPublication(page as never) as typeof page;
    expect(out.content[0].props.phoneNumber).toBe("016-800 1631");
  });

  it("removes a floating WhatsApp button that would open a chat to nobody", () => {
    const page = {
      root: {},
      content: [
        { type: "SiteHero", props: { headline: "兴发" } },
        { type: "FloatingContact", props: { number: "012-345 6789", placeholder: true } },
      ],
    };
    const out = forPublication(page as never) as typeof page;
    expect(out.content.map((n) => n.type)).toEqual(["SiteHero"]);
  });

  it("keeps a floating button with the business's own number", () => {
    const page = {
      root: {},
      content: [{ type: "FloatingContact", props: { number: "016-800 1631" } }],
    };
    const out = forPublication(page as never) as typeof page;
    expect(out.content).toHaveLength(1);
  });
});

describe("an empty list is not a list of placeholders", () => {
  /* THE BUG THIS EXISTS FOR, and it is worth stating because it deleted real
     content silently for weeks.

     `isAllPlaceholder` asked 「is every row in every list a placeholder?」 and
     `[].every(...)` is TRUE, so a block carrying one empty array answered yes
     however full the rest of it was. 一段话配一张照片 ships `points: []`; filled
     with 183 characters of the owner's own words and a photograph of his own
     crew, it never reached a published page on any register. The founder saw
     six websites with a section missing and asked 「这个是还没渲染的吗」.

     Nothing threw. The block was in the layout, in the editor, in the saved
     JSON -- and gone from the page. */
  it("keeps a filled block that also carries an empty list", () => {
    const layout = {
      root: {},
      content: [
        {
          type: "SiteStory",
          props: {
            id: "website-story",
            heading: "跟你做的是什么人",
            body: "做了十年，报价的人就是到场的人。",
            photo: "https://example.com/crew.jpg",
            points: [],
          },
        },
      ],
    } as unknown as PuckLayout;

    const out = forPublication(layout);
    expect(out.content).toHaveLength(1);
    expect(String((out.content[0].props as { body?: string }).body)).toContain("做了十年");
  });

  it("still drops a block whose only list IS all placeholders", () => {
    const layout = {
      root: {},
      content: [
        {
          type: "PriceList",
          props: {
            id: "website-prices",
            /* `placeholder: true` is the flag the generator writes, and
               isPlaceholderRow reads exactly that -- not the em-dash. */
            rows: [
              { label: "Home renovation", value: "RM —", placeholder: true },
              { label: "Kitchen", value: "RM —", placeholder: true },
            ],
          },
        },
      ],
    } as unknown as PuckLayout;

    expect(forPublication(layout).content).toHaveLength(0);
  });
});
/*
  页脚 survives publication with its seeded rows stripped.

  The founder, comparing our page with the one it copies: 「明显不一样」. Theirs
  closed on a footer band; ours stopped dead after the form. The footer was in
  the saved layout the whole time and the projection was deleting it, because
  its only list is the three seeded contact rows.
*/
it("publishes the footer without its seeded rows", () => {
  const out = forPublication({
    root: {},
    content: [
      {
        type: "SiteFoot",
        props: {
          id: "website-foot",
          brand: "My Salon",
          tagline: "Malaysia · Beauty & salon",
          rows: [
            { label: "WhatsApp", value: "012-345 6789", placeholder: true },
            { label: "Address", value: "Taman Desa, Kuala Lumpur", placeholder: true },
          ],
        },
      },
    ],
  } as never) as never as { content: { type: string; props: Record<string, unknown> }[] };

  expect(out.content.map((n) => n.type)).toEqual(["SiteFoot"]);
  expect(out.content[0].props.brand).toBe("My Salon");
  /* The rows are the part that must not reach a stranger: neither number nor
     address belongs to this business. */
  expect(out.content[0].props.rows).toEqual([]);
});

/* And the rule stays narrow. A price list every row of which reads 「RM —」 is
   NOT chrome: to a visitor that says 「this business will not tell you what it
   costs」, and it must keep going even though it, too, has a real heading. */
it("still drops an all-placeholder price list, heading and all", () => {
  const out = forPublication({
    root: {},
    content: [
      {
        type: "SitePrices",
        props: {
          id: "website-prices",
          heading: "What it costs",
          rows: [
            { label: "Cut", value: "RM —", placeholder: true },
            { label: "Colour", value: "RM —", placeholder: true },
          ],
        },
      },
    ],
  } as never) as never as { content: unknown[] };
  expect(out.content).toEqual([]);
});


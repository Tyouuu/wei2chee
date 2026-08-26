import { describe, expect, it } from "vitest";
import { forPublication } from "@/lib/portal/publish-projection";
import { LANDING_TEMPLATES } from "@/lib/templates/landing-templates";
import type { PuckLayout, PuckNode } from "@/lib/portal/layout-ops";
import type { LandingContent } from "@/lib/templates/landing-templates";

/** Enough of a business to build all six templates. */
const CONTENT: LandingContent = {
  brand: "Xing Fa Renovation",
  eyebrow: "Malaysia · Renovation",
  pitch: "Home renovation, kitchen and commercial fitout.",
  services: [{ label: "Home renovation", value: "3-room, shoplot", icon: "wrench" }],
  stages: ["Enquiry", "Quote", "Build"],
  landsIn: "Quotations",
  enquiryFields: [],
  proof: [{ value: "10 years", label: "In this trade" }],
  contact: [{ label: "WhatsApp", value: "012-345 6789", icon: "phone" }],
  words: {
    whatsapp: "Ask on WhatsApp",
    seeWork: "See our work",
    contactHeading: "How to reach us",
    replyNote: "Usually answered within a day.",
    arrowBadge: "automatic",
    arrowBefore: "Send this and your system opens a ",
    arrowAfter: " — nobody has to retype it.",
    fields: [{ label: "Your name", placeholder: "Mr Tan", kind: "text" }],
    byTemplate: {
      quote: { services: "What we do", flow: "After you call", formHeading: "Leave a number", formBlurb: "Three fields.", submit: "Send" },
    },
    // The six sections a Malaysian SME page needs, added 2026-08-25. Present
    // here because every template now reads them, and a fixture that omits
    // them is testing a page no customer will ever be shown.
    sections: {
      work: { heading: "Our work", hint: "Your own photos", shots: ["Add a photo", "Add a photo", "Add a photo"] },
      areas: { heading: "Where we cover", note: "Ask anyway", list: ["Kuala Lumpur", "Klang"] },
      prices: { heading: "What it costs", note: "A guide", askLabel: "Ask", blank: "RM —" },
      reviews: { heading: "What customers say", note: "Replace these", quotes: [{ text: "On time.", who: "A customer" }] },
      faq: { heading: "Questions", rows: [{ title: "How long?", body: "A day." }] },
      hours: { heading: "When we are open", rows: [{ label: "Mon – Fri", value: "9 – 6" }] },
      promiseList: { heading: "What you get", marks: ["A written quote"] },
    },
  } as unknown as LandingContent["words"],
};

function nodesOf(layout: PuckLayout): PuckNode[] {
  return layout.content ?? [];
}

describe("forPublication", () => {
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

    // The price list is one of several InfoRows, so count instead: services,
    // areas and contact stay; prices goes.
    const infoRows = nodesOf(built).filter((n) => n.type === "InfoRows").length;
    const keptRows = kept.filter((t) => t === "InfoRows").length;
    expect(keptRows).toBe(infoRows - 1);
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
});

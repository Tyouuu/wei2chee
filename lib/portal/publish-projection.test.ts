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
    const kept = nodesOf(published).map((n) => n.type);
    const expected = nodesOf(built)
      .filter((n) => n.type !== "PhotoFrame")
      .map((n) => n.type)
      // The Columns that held only the three empty frames goes with them: an
      // empty three-column row is a 200px gap that reads as a broken page.
      .filter((n) => n !== "Columns");
    expect(kept.filter((t) => t !== "Columns")).toEqual(expected);
    expect(kept).not.toContain("PhotoFrame");
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

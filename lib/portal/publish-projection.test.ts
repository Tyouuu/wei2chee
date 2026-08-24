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

    // Same blocks, same order -- a projection, not a filter.
    expect(nodesOf(published).map((n) => n.type)).toEqual(
      nodesOf(built).map((n) => n.type),
    );
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

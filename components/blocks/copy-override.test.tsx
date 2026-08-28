import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import FaqsBlock from "./faqs-2";
import Roadmap1, { copy as r1 } from "./roadmap-1";
import Roadmap2, { copy as r2 } from "./roadmap-2";
import Roadmap3, { copy as r3 } from "./roadmap-3";
import Calendar2, { copy as c2 } from "./calendar-2";

/**
 * A section has to render the copy it was given.
 *
 * WHY THIS TEST EXISTS. Five blocks derived their rendered data at MODULE
 * SCOPE, from the default copy, and then destructured the merged copy inside
 * the component without using it:
 *
 *     const columns = [faqs.slice(0, half), faqs.slice(half)]   // import time
 *     export default function FaqsBlock({ copy: override }) {
 *       const { faqs } = { ...copy, ...override }               // never read
 *       ...renders `columns`...
 *
 * `copy` genuinely reaches these components at runtime -- site-block.tsx
 * renders `<Block copy={copy} />` from the customer's saved layout -- so a
 * customer editing the questions on their FAQ section, or a contributor's name
 * on a roadmap, watched the editor accept the change and the page ignore it.
 * Nothing threw. The section rendered, it just rendered somebody else's words.
 *
 * That is the failure this repository keeps meeting: the capability exists and
 * the wire is not connected, silently. It went unseen for as long as it did
 * because there was no eslint config in the tree, so no-unused-vars -- which
 * names this exact shape, an unused destructured override -- had never run.
 *
 * So the gate is a rendering test rather than a lint rule: lint can only see
 * that a variable is unused, and the day someone "fixes" that by deleting the
 * destructure instead of using it, lint goes quiet and the bug gets worse.
 * This asserts the only thing that matters -- the overridden words are on the
 * page.
 */

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

/*
  THE MERGE IS SHALLOW, so an override REPLACES a key rather than patching it.
  Overriding `team` with a single contributor would leave `team.leo` undefined
  and crash the render -- which is how a real caller would break it too, and is
  why these spread the block's own exported default first. That is also what
  the editor does: it saves the whole object back, not a patch.
*/
const NAME = "Zulkifli";

/*
  ASSERTED ON THE INITIAL, NOT THE NAME. These roadmaps put the contributor's
  name in `alt` on an <AvatarImage>, and Radix renders only the <AvatarFallback>
  server-side -- `member.name[0]`. So the initial IS the rendered evidence that
  the merged team reached the render. "Z" is not among the defaults (A, L, M, O),
  which is the whole reason for the name.
*/
const INITIAL = ">Z<";

describe("section copy overrides reach the page", () => {
  it("faqs-2 renders overridden questions", () => {
    const out = html(
      <FaqsBlock
        copy={{
          /* The block's own shape is `q` / `a`, not question / answer. */
          faqs: [
            { q: "Do you cover Klang Valley?", a: "Yes, same day." },
            { q: "Deposit?", a: "30% to start." },
          ],
        }}
      />,
    );
    expect(out).toContain("Do you cover Klang Valley?");
    // The first item is the only one open by default, and a closed Radix
    // accordion renders no content server-side -- so assert the second
    // QUESTION rather than its answer.
    expect(out).toContain("Yes, same day.");
    expect(out).toContain("Deposit?");
  });

  /* The roadmaps embed contributors BY VALUE into the array they render, which
     is why overriding `team` alone used to change nothing: the array had
     already been built from the defaults at import. */
  it("roadmap-1 renders an overridden contributor", () => {
    const out = html(
      <Roadmap1 copy={{ team: { ...r1.team, ada: { ...r1.team.ada, name: NAME } } }} />,
    );
    expect(out).toContain(INITIAL);
  });

  it("roadmap-2 renders an overridden contributor", () => {
    const out = html(
      <Roadmap2 copy={{ team: { ...r2.team, ada: { ...r2.team.ada, name: NAME } } }} />,
    );
    expect(out).toContain(INITIAL);
  });

  it("roadmap-3 renders an overridden contributor", () => {
    const out = html(
      <Roadmap3 copy={{ team: { ...r3.team, ada: { ...r3.team.ada, name: NAME } } }} />,
    );
    expect(out).toContain(INITIAL);
  });

  it("calendar-2 renders an overridden recurring event", () => {
    const out = html(<Calendar2 copy={{ STANDUP: { ...c2.STANDUP, title: "Site briefing" } }} />);
    expect(out).toContain("Site briefing");
  });

  /* The other half of the contract, and the reason the fix is
     `override?.x ?? build(dep)` rather than always rebuilding: a section whose
     array was replaced outright must still get exactly that array. */
  it("an explicit array override still wins over the derived default", () => {
    const out = html(
      <Roadmap2
        copy={{
          phases: [
            {
              id: "now",
              label: "This month",
              caption: "Wiring done",
              target: "Sept",
              tone: "active",
              items: [{ title: "Rewire the shophouse", description: "Two floors." }],
            },
          ],
        }}
      />,
    );
    expect(out).toContain("Rewire the shophouse");
  });
});

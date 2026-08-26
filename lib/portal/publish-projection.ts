import type { PuckLayout, PuckNode } from "@/lib/portal/layout-ops";
import { puckConfig } from "@/design-system/editor/puck-config";

/**
 * What a stranger sees, from what the owner designed.
 *
 * ── WHY A PROJECTION AND NOT JUST "RENDER THE LAYOUT" ─────────────────────
 *
 * A published page is not quite the saved page, and the difference is one
 * category of thing: **notes the product writes to the OWNER, in the middle of
 * a page whose reader is somebody else.**
 *
 * Found by opening the first published site and reading it. Under the enquiry
 * form sat 「填完送出 → 你的系统会开一张「Quotations」，不用有人转抄。」 — the
 * sentence that exists to answer the founder's own 「官网表格 → 系统出单 这个我
 * 一直不懂是什么来的」. It is the right sentence in the editor and the wrong one
 * on a contractor's website: a homeowner asking for a quotation is being told
 * how the contractor's admin works.
 *
 * ── WHY IT IS DONE HERE AND NOT IN THE COMPONENT ──────────────────────────
 *
 * The alternative was a "published" React context that EnquiryForm reads. That
 * costs the component a `"use client"` it does not otherwise need, and it
 * spreads the rule across every component that ever grows a design-time note.
 * A projection keeps the rule in one file, next to the reason, and makes it
 * something a test can assert on a plain object.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────
 *
 * Not a security boundary. Nothing removed here is secret — the owner's own
 * page key is on the page either way. `get_public_site` (migration
 * 20260823010000) is the boundary; this is an editorial decision about
 * audience, and it belongs on the page-shaping side rather than in the
 * database.
 */

/** Props that only mean something to the person who BUILT the page. */
const DESIGN_TIME_PROPS: Record<string, readonly string[]> = {
  // The 「填完送出 → 你的系统会开一张…」 line, and the three pieces of its
  // sentence. Removing `landsIn` alone is enough -- the component renders
  // nothing without it -- but leaving the fragments behind would put the rule
  // one edit away from breaking silently.
  EnquiryForm: ["landsIn", "landsInBadge", "landsInBefore", "landsInAfter"],
};

/*
  DERIVED, NOT LISTED.

  This was `["sidebar", "main"]`, and a website page is built out of `Columns`,
  whose slots are `a`, `b` and `c`. So the projection walked past every nested
  node on the public site and did nothing to it -- an EnquiryForm inside a
  Columns kept the owner-facing 「填完送出 → 你的系统会开一张…」 line on a
  stranger's screen, which is the exact sentence this file exists to remove.

  layout-ops.ts had the identical two-item list and was fixed the same way on
  2026-08-25, for the identical reason. Two hand-kept copies of one list is two
  lists that drift, and the drift is silent.
*/
const SLOT_KEYS: string[] = Object.values(
  (puckConfig.components ?? {}) as Record<string, { fields?: Record<string, { type?: string }> }>,
).flatMap((c) => Object.entries(c.fields ?? {}).filter(([, f]) => f?.type === "slot").map(([k]) => k))
  .filter((k, i, a) => a.indexOf(k) === i);

/*
  BLOCKS A STRANGER MUST NOT BE SHOWN EMPTY.

  Found on a phone, on the real published site: three 4:3 grey boxes each
  saying 「Add a photo」, one per screen, with the words repeated as a caption
  underneath. A homeowner scrolling that learns one thing -- nobody finished
  this page.

  The frames are deliberately empty IN THE EDITOR: a renovation page filled
  with stock photos of somebody else's kitchen announces that nobody designed
  it either, and an obvious, sized, labelled slot is a two-minute job for the
  owner. That argument is right for the person building the page and has
  nothing to say to the person reading it.

  So the prompt stays where it is a prompt and goes where it is not. A frame
  with no `src` is dropped from the published page, and a Columns left holding
  nothing goes with it -- an empty three-column row is a 200px gap that reads
  as a rendering failure.
*/
function isEmptyOnPublish(node: PuckNode): boolean {
  if (node.type === "PhotoFrame") return !String(node.props.src ?? "").trim();
  return false;
}

/** True when every slot this node has is empty. */
function hasNothingLeft(node: PuckNode): boolean {
  const slots = SLOT_KEYS.filter((k) => Array.isArray(node.props[k]));
  if (!slots.length) return false;
  return slots.every((k) => (node.props[k] as PuckNode[]).length === 0);
}

function project(node: PuckNode): PuckNode {
  const drop = DESIGN_TIME_PROPS[node.type];
  let props = node.props;

  if (drop?.some((k) => k in props)) {
    props = { ...props };
    for (const k of drop) delete props[k];
  }

  // Slots are rebuilt only when they hold something, so a page with no nested
  // content comes back as the same object graph it went in as.
  for (const k of SLOT_KEYS) {
    const slot = props[k];
    if (Array.isArray(slot)) {
      const next = (slot as PuckNode[])
        .filter((n) => !isEmptyOnPublish(n))
        .map(project)
        .filter((n) => !hasNothingLeft(n));
      if (next.length !== slot.length || next.some((n, i) => n !== slot[i])) {
        props = { ...props, [k]: next };
      }
    }
  }

  return props === node.props ? node : { ...node, props };
}

/** The saved layout with every owner-facing annotation removed. */
export function forPublication(layout: PuckLayout): PuckLayout {
  return {
    ...layout,
    content: (layout.content ?? [])
      .filter((n) => !isEmptyOnPublish(n))
      .map(project)
      .filter((n) => !hasNothingLeft(n)),
  };
}

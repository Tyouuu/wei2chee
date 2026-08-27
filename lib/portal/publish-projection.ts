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
  /*
    A CHAT BUTTON WITH NOBODY BEHIND IT IS WORSE THAN NO CHAT BUTTON.

    FloatingContact follows the visitor down the whole page, so it is the most
    pressed thing on it. Published with the seeded 012-345 6789 it would open a
    WhatsApp chat to a number that is not the business -- the same failure this
    module was built for, in the one place it would happen most.
  */
  if (node.type === "FloatingContact") {
    return !String(node.props.number ?? "").trim() || node.props.placeholder === true;
  }
  /*
    AN UNFILLED CREDENTIAL IS A FABRICATED ONE.

    SiteCreds carries a licence, an authorised-brand badge and a review score --
    every one of them a claim about the world that only the owner can make. It
    ships as an obvious labelled gap and asks for them (site-sections.tsx), and
    that prompt must never become a stranger's evidence. Stricter than the hero
    rule on purpose: the hero keeps its headline because the headline is true,
    and there is no true half of an empty certification.
  */
  /*
    A STORY WE WROTE IS A LIE ABOUT A BUSINESS WE HAVE NOT MET.

    Every other section on this page is generated from the questionnaire and is
    therefore true. 「跟你做的是什么人」 is not: how long they have been going and
    who turns up on the day are facts only the owner has. So the section ships
    as a heading plus an ask, and stays off the visitor's page until the owner
    has written the half we cannot.
  */
  if (node.type === "SiteStory") {
    const marks = Array.isArray(node.props.points) ? (node.props.points as Row[]) : [];
    return (
      !String(node.props.body ?? "").trim() &&
      !String(node.props.photo ?? "").trim() &&
      !marks.some((m) => String((m as { label?: string }).label ?? "").trim())
    );
  }
  /*
    AN EMPTY GALLERY IS THREE GREY BOXES, WHICH IS THE FAILURE THAT STARTED
    THIS MODULE. The founder photographed his own live site showing 「Add a
    photo」 three times. Individual unfilled frames go, and a gallery left
    holding none of them goes with it.
  */
  if (node.type === "SiteGallery") {
    const shots = Array.isArray(node.props.items) ? (node.props.items as Row[]) : [];
    return !shots.some((s) => String((s as { src?: string }).src ?? "").trim());
  }
  if (node.type === "SiteCreds") {
    const items = Array.isArray(node.props.items) ? (node.props.items as Row[]) : [];
    const filled = items.some((i) => String((i as { label?: string }).label ?? "").trim());
    const rating = node.props.rating as { score?: string } | undefined;
    return !filled && !String(rating?.score ?? "").trim();
  }
  return false;
}

/*
  THE HERO KEEPS ITS HEADLINE AND LOSES ITS PLACEHOLDERS.

  Different from the rule above, and the difference matters: an unfilled
  FloatingContact should not exist on the published page at all, but a hero with
  an unfilled phone number is still the page's opening -- the headline, the
  claim and the buttons are all real. So the block survives and the two fields
  that are still seeded are removed.

  Marked by the page builder with `phonePlaceholder` / `stripPlaceholder`, so an
  owner who typed their own number over the seed keeps it: the flag is written
  once, at generation, and any edit through the panel clears it.
*/
function withoutPlaceholderFields(node: PuckNode): PuckNode {
  if (node.type !== "SiteHero") return node;
  if (node.props.phonePlaceholder !== true && node.props.stripPlaceholder !== true) return node;
  const props = { ...node.props };
  if (props.phonePlaceholder === true) {
    delete props.phoneNumber;
    delete props.phoneLabel;
    delete props.phonePlaceholder;
  }
  if (props.stripPlaceholder === true) {
    delete props.strip;
    delete props.stripPlaceholder;
  }
  return { ...node, props };
}

/*
  PLACEHOLDER ROWS NEVER REACH A STRANGER.

  The worst thing found on the live site, and it is not a design defect. A real
  business's published page was printing:

      WhatsApp   012-345 6789
      Address    Taman Desa, Kuala Lumpur

  Neither is theirs. A homeowner reading that page will message a phone number
  that belongs to somebody else, and drive to an address that is not where the
  business is. The price list has the same shape: every row reads 「RM —」,
  which does not say 「not filled in yet」 to a visitor, it says 「this business
  will not tell you what it costs」.

  The seed copy is meant to be retyped -- that is the whole design of
  landing.ts, and it is right. It is right FOR THE EDITOR. So the rows carry
  `placeholder: true`, and they stop here.

  Marked rather than pattern-matched: 「RM —」 and 「012-345 6789」 are strings in
  two languages that anyone could reasonably edit, and a projection that
  guessed at content would eventually delete something a customer wrote on
  purpose. A flag is a statement by the person who wrote the placeholder.
*/
type Row = Record<string, unknown>;
const isPlaceholderRow = (r: unknown): boolean =>
  typeof r === "object" && r !== null && (r as Row).placeholder === true;

/** Strips placeholder rows from every array prop this node carries. Returns the
 *  same object when there was nothing to strip. */
function withoutPlaceholders(node: PuckNode): PuckNode {
  let props = node.props;
  for (const [k, v] of Object.entries(node.props)) {
    if (!Array.isArray(v) || !v.some(isPlaceholderRow)) continue;
    if (props === node.props) props = { ...node.props };
    props[k] = v.filter((r) => !isPlaceholderRow(r));
  }
  return props === node.props ? node : { ...node, props };
}

/*
  A GALLERY PUBLISHES THE PHOTOGRAPHS IT HAS, NOT THE SLOTS IT WAS GIVEN.

  Not a `placeholder` flag, and the difference matters: the owner fills these
  frames IN PLACE through the picker, so a flag written at generation would
  still be sitting on the item after they had put their own kitchen in it. The
  presence of a `src` is the only statement that cannot go stale.
*/
function withoutEmptyShots(node: PuckNode): PuckNode {
  if (node.type !== "SiteGallery") return node;
  const shots = Array.isArray(node.props.items) ? (node.props.items as Row[]) : [];
  const kept = shots.filter((s) => String((s as { src?: string }).src ?? "").trim());
  if (kept.length === shots.length) return node;
  return { ...node, props: { ...node.props, items: kept } };
}

/** True when stripping placeholders emptied the only list this node had. */
function isAllPlaceholder(node: PuckNode): boolean {
  const lists = Object.entries(node.props).filter(
    ([k, v]) => Array.isArray(v) && !SLOT_KEYS.includes(k),
  );
  if (!lists.length) return false;
  return lists.every(([, v]) => (v as unknown[]).every(isPlaceholderRow));
}

/** True when every slot this node has is empty. */
function hasNothingLeft(node: PuckNode): boolean {
  const slots = SLOT_KEYS.filter((k) => Array.isArray(node.props[k]));
  if (!slots.length) return false;
  return slots.every((k) => (node.props[k] as PuckNode[]).length === 0);
}

function project(node: PuckNode): PuckNode {
  const stripped = withoutEmptyShots(withoutPlaceholderFields(withoutPlaceholders(node)));
  const drop = DESIGN_TIME_PROPS[stripped.type];
  let props = stripped.props;

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
        .filter((n) => !isEmptyOnPublish(n) && !isAllPlaceholder(n))
        .map(project)
        .filter((n) => !hasNothingLeft(n));
      if (next.length !== slot.length || next.some((n, i) => n !== slot[i])) {
        props = { ...props, [k]: next };
      }
    }
  }

  return props === stripped.props ? stripped : { ...stripped, props };
}

/** The saved layout with every owner-facing annotation removed. */
export function forPublication(layout: PuckLayout): PuckLayout {
  return {
    ...layout,
    content: (layout.content ?? [])
      .filter((n) => !isEmptyOnPublish(n) && !isAllPlaceholder(n))
      .map(project)
      .filter((n) => !hasNothingLeft(n)),
  };
}

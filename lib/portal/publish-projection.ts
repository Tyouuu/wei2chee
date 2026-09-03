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
  /*
    🔴 「空的」看的是**老板自己的东西**：他写的那段话、他传的那张照片。

    这一条 2026-09-04 改过一次，而它是一个真的「说了没做」：
    `site-sections.tsx` 上 `hint` 那一栏的注解白纸黑字写着
    **「Never published -- publish-projection.ts drops the whole section
    until there is a body」**，而这里原本还多问了一句「那四条承诺是不是空的」。

    那四条（「先给报价才动工」「一个人跟到底」「来看不收钱」）是**样板句，
    一出厂就带着**。所以这一块永远不算空，於是它带着编辑器那句
    **「This section stays off your live page until you write it」**
    上了访客的页面 —— 一句在公开页面上讲自己不会出现在公开页面的话。

    实拍在 `/s/xingfa-reno`（2026-09-04）。组件跟这里对「空」的定义不一样，
    而画面听组件的。现在两边同一个定义。
  */
  if (node.type === "SiteStory") {
    return (
      !String(node.props.body ?? "").trim() && !String(node.props.photo ?? "").trim()
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
  /* A team we invented is a list of people who do not work there. Same rule
     as SiteCreds and SiteStory: the prompt stays in the editor. */
  if (node.type === "SiteTeam") {
    const people = Array.isArray(node.props.members) ? (node.props.members as Row[]) : [];
    return !people.some((m) => String((m as { name?: string }).name ?? "").trim());
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

/*
  CHROME IS NOT A CLAIM, AND A PAGE HAS TO END.

  Found 2026-08-27 by putting our page beside the one it copies: theirs closes
  on a full-width footer band, ours simply stopped after the enquiry form, and
  the founder's reply was 「明显不一样」. It was not a missing design. The footer
  was BUILT, was in the saved layout, and was being deleted on the way out --
  because its only list is the three seeded contact rows, so `isAllPlaceholder`
  read 「every list on this node is a placeholder」 and dropped the whole block,
  taking the business name and the closing rule with it.

  This is the sibling of the `[].every` bug two commits above: that one deleted
  a node for a list it did not have, this one deletes a node for the only list
  it does have while its real content sits outside every list.

  The distinction that decides it is NOT 「does anything else survive」 -- the
  price list also has a heading, and a price list whose every row reads 「RM —」
  must still go, because to a visitor that is not 「unfilled」, it is 「this
  business will not tell you what it costs」. The distinction is what the block
  IS: 页脚 is the page's end, the same furniture as 顶栏. It makes no claim about
  the world. Its placeholder rows still go -- `withoutPlaceholders` runs first
  and takes all three -- and what is left is the name, the tagline and the band,
  every one of them true.
*/
const CHROME = ["SiteFoot", "SiteBar"];

/** True when stripping placeholders emptied the only list this node had. */
function isAllPlaceholder(node: PuckNode): boolean {
  if (CHROME.includes(node.type)) return false;
  /* ONLY THE LISTS THAT HAVE SOMETHING IN THEM.
     `[].every(...)` is TRUE, so a block carrying one empty array was judged
     「every row in every list is a placeholder」 and deleted from the published
     page -- with its real content still in it.
     Found on 2026-08-27 by measuring what each section on the live page
     actually contains: 一段话配一张照片 had 183 characters of the owner's own
     words and a photograph, and never appeared on any of the six registers,
     because it also ships `points: []`. The founder saw it as 「还没渲染」.
     An empty list is not a list of placeholders. It is no list at all, and
     whether the block is empty is `isEmptyOnPublish`'s question, not this
     one's. */
  const lists = Object.entries(node.props).filter(
    ([k, v]) => Array.isArray(v) && !SLOT_KEYS.includes(k) && (v as unknown[]).length > 0,
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

/*
  🔴 `hint` 是**编辑器里催老板填东西的那句话**，一律不上线。

  这一条是从两个真的漏出去的实例长出来的（2026-09-04，`/s/xingfa-reno`）：

    SiteStory  「Two or three lines in your own words … **This section stays
                off your live page until you write it.**」
    SiteBand   「Put your own photos here — three of your best jobs.」

  两句都印在访客的页面上，而第一句还在那页上宣称自己不在那页上。

  ⚠️ **不列一张名单。** 五个组件用 `hint`，而这个仓库栽在
  「第二份手写清单活得比它描述的东西久」上至少五次（SLOT_KEYS 那一段
  就是同一个教训）。这里改成一条**从组件的约定推出来的**规则：
  五个 `hint` 的消费端每一个都写着 `if (!hint) return null` ——
  **所以把 hint 拿掉，那一块在没填的时候自己就消失**，
  而那正是它们的档头承诺的事（「Never published」）。
  以后新增一个照这个约定写的块，不用回来改这里。
*/
const EDITOR_ONLY_PROP = "hint";

function project(node: PuckNode): PuckNode {
  const stripped = withoutEmptyShots(withoutPlaceholderFields(withoutPlaceholders(node)));
  const drop = DESIGN_TIME_PROPS[stripped.type];
  let props = stripped.props;

  if (EDITOR_ONLY_PROP in props) {
    props = { ...props };
    delete props[EDITOR_ONLY_PROP];
  }

  if (drop?.some((k) => k in props)) {
    props = props === stripped.props ? { ...props } : props;
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

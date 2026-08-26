import type { PuckNode } from "@/lib/templates/puck-node";

/**
 * 官网骨架 — which sections a website leads with, decided by the 风格.
 *
 * ── THE GAP THIS CLOSES ───────────────────────────────────────────────────
 *
 * The system pages have had this since 2026-08-25: DASHBOARD_COMPOSITION lets
 * every register declare its own blocks in its own order, because the founder
 * had looked at eighteen dashboards and said 「怎么全部看起来又一样呢？…每一个
 * design都是用不同的组件去完成的」.
 *
 * The website never got the same wire. Six templates in landing-templates.ts
 * each hard-code their section order AND their first screen -- every one of
 * them calls `hero(c, "split", …)`. So fourteen registers reached a customer's
 * website as fourteen coats of paint on one skeleton, which is precisely what
 * 重点 7c rules out: 换个配色它还是不是另一个设计？
 *
 * ── WHAT EACH LAYER DECIDES, AND WHY THE SPLIT IS HERE ────────────────────
 *
 *   成交方式 (the template)   WHICH sections exist, and their content.
 *                             A salon needs 营业时间; a wholesaler needs 账期.
 *                             That is a fact about the business, not a taste.
 *   风格 (this file)          WHAT IT OPENS ON, and the order after that.
 *                             A ledger leads with the price list; a kopitiam
 *                             leads with the menu; a consultancy leads with
 *                             the work.
 *
 * Nothing is dropped. The dashboard composition may omit a block because the
 * dashboard's blocks are GENERATED; a website's sections carry the owner's own
 * prices and photos, and a register that silently deleted them would be a
 * register that loses the customer's typing.
 *
 * ── WHY THIS IS A REORDER AND NOT A SECOND SET OF TEMPLATES ───────────────
 *
 * 14 registers × 6 sale motions = 84 pages. Written out, that is 84 things to
 * fix every time a block changes shape -- the exact maintenance trap
 * landing-templates.ts already argued its way out of when it refused to write
 * one template per trade. Composed, it is one table.
 *
 * ── NO MIGRATION ──────────────────────────────────────────────────────────
 *
 * Layouts are generated on read until the customer first saves, so changing a
 * row here re-skeletons every unsaved website immediately and touches no saved
 * one. Same property the dashboard composition relies on.
 */

/** The sections a register may order. Fixed points are excluded on purpose:
 *  `bar` is the top strip, `form`/`contact`/`foot`/`floating` are the ask and
 *  the tail, and a register that put the enquiry form second would be a
 *  register asking for a phone number before saying what it sells. */
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
] as const;

export type SiteSection = (typeof MOVABLE)[number];

export type SiteSkeleton = {
  /** SiteHero's `layout` variant: left · band · center · plain · split.
   *  Measured against this market on 2026-08-27 (npm run shoot:market): 14 of
   *  19 real Malaysian SME sites give the first screen to a photograph, so
   *  `split` -- the only layout with a figure beside the words -- stays the
   *  most common answer. It is no longer the ONLY answer. */
  hero: "left" | "band" | "center" | "plain" | "split";
  /** Movable sections, most important first. Anything the template has and
   *  this list omits keeps its template position, after the listed ones. */
  order: SiteSection[];
  /** One line, for the design doc the AI assistant reads and for the gallery.
   *  Says what this website OPENS on and who that is for. */
  opens: string;
};

export const SITE_COMPOSITION: Record<string, SiteSkeleton> = {
  // 台账: the register for a contractor who scans rows. Its dashboard opens on
  // a table, so its website opens on the one table a stranger wants -- what it
  // costs. No figure: this register's whole argument is that it is not pretty.
  ledger: {
    hero: "left",
    opens: "价目表",
    order: ["prices", "services", "flow", "work", "promise", "areas", "faq", "reviews", "hours", "cta"],
  },
  // 炉: the salon, where the front desk IS the shop. What a stranger buys is
  // the look of the last customer who walked out, so the photographs lead and
  // the reviews come straight after them.
  hearth: {
    hero: "split",
    opens: "照片墙",
    order: ["work", "reviews", "services", "hours", "prices", "areas", "cta", "faq", "flow", "promise"],
  },
  // 图纸: the neutral one. The most ordinary order there is -- what you do,
  // what it looks like, what happens next -- which is this register's point.
  blueprint: {
    hero: "split",
    opens: "做什么",
    order: ["services", "work", "flow", "prices", "reviews", "cta", "faq", "areas", "promise", "hours"],
  },
  // 仪表盘: for the owner who opens a system to check four numbers. Its website
  // leads with the claims a stranger checks the same way -- 保证、覆盖、常见问题
  // -- before anything is sold.
  console: {
    hero: "center",
    opens: "保证",
    order: ["promise", "services", "prices", "areas", "work", "flow", "faq", "reviews", "cta", "hours"],
  },
  // 中台: the wholesaler's register, the densest in the library. Its buyer is
  // another business, and a business asks for terms before it asks for a look:
  // price, then delivery, then what the arrangement actually is.
  counter: {
    hero: "plain",
    opens: "条件",
    order: ["prices", "promise", "areas", "services", "flow", "faq", "work", "reviews", "cta", "hours"],
  },
  // 瑞士: black, white, one red, no cards. It is the register that prints, and
  // a page that reads like a document leads with words -- what we do, how it
  // works, what we promise. No photo wall; that would be the opposite register.
  swiss: {
    hero: "plain",
    opens: "说明",
    order: ["services", "flow", "promise", "faq", "prices", "areas", "reviews", "work", "cta", "hours"],
  },
  // 柔和: the tuition centre, where the person reading is often nervous. It
  // opens on a coloured band and answers the worry before the sell -- what
  // happens, when you are open, what other parents said.
  soft: {
    hero: "band",
    opens: "怎么开始",
    order: ["services", "flow", "hours", "reviews", "faq", "prices", "work", "areas", "cta", "promise"],
  },
  // 粗野: gyms, barbers, tuning shops -- businesses that are loud on purpose.
  // The work first at full volume, then the ask, immediately. This is the only
  // skeleton that puts the mid-page CTA in the top third.
  brut: {
    hero: "band",
    opens: "作品 + 马上问",
    order: ["work", "cta", "services", "prices", "reviews", "hours", "areas", "faq", "flow", "promise"],
  },
  // 瓷: the kopitiam and the nyonya kitchen, in a shophouse. For them the price
  // list IS the menu and the menu IS the page -- then when you are open, then
  // where you are. Nobody reads a coffee shop's process diagram.
  tile: {
    hero: "split",
    opens: "菜单",
    order: ["prices", "work", "hours", "areas", "services", "reviews", "faq", "cta", "flow", "promise"],
  },
  // 码: parts, model numbers, quantities. A catalogue -- the list and its
  // prices, then whether you deliver here. Monospace all the way down, so no
  // long-prose section gets to lead.
  code: {
    hero: "plain",
    opens: "货单",
    order: ["prices", "services", "areas", "promise", "faq", "flow", "work", "reviews", "cta", "hours"],
  },
  // 漆: 中药行、婚宴、礼品. The only register that puts colour on the GROUND, so
  // the band hero is not decoration -- it is the register itself. What it sells
  // is trust built over years, so the work and the word-of-mouth lead.
  lacquer: {
    hero: "band",
    opens: "招牌 + 口碑",
    order: ["services", "work", "reviews", "hours", "areas", "prices", "cta", "faq", "flow", "promise"],
  },
  // 招牌: shophouse retail with a physical sign outside. The centred hero IS a
  // signboard. Then the two things somebody standing on the street needs:
  // when are you open, and where exactly are you.
  signboard: {
    hero: "center",
    opens: "店名 + 找得到",
    order: ["hours", "areas", "services", "work", "prices", "reviews", "cta", "faq", "flow", "promise"],
  },
  // 夜: the dark one -- shift work, monitoring, late openings. Its website
  // leads with the fact that makes it dark: we are open when others are not.
  night: {
    hero: "band",
    opens: "还开着",
    order: ["hours", "services", "areas", "flow", "promise", "prices", "faq", "work", "cta", "reviews"],
  },
  // 工作室: consultants and agencies, the register where nothing sits side by
  // side. A quiet centred opening, the work, then who said what -- and the
  // enquiry is the only thing that ever asks anything.
  studio: {
    hero: "center",
    opens: "作品 · 安静",
    order: ["work", "services", "reviews", "flow", "faq", "promise", "prices", "areas", "cta", "hours"],
  },
};

/** Registers that have not declared one follow 图纸 -- the same fallback the
 *  dashboard composition uses, and for the same reason: it is the register
 *  whose argument is that it suits any trade. */
export function siteSkeleton(style?: string | null): SiteSkeleton {
  return (style && SITE_COMPOSITION[style]) || SITE_COMPOSITION.blueprint;
}

const idOf = (n: PuckNode): string => String(n.props?.id ?? "");
const sectionOf = (n: PuckNode): string => idOf(n).replace(/^website-/, "");

/**
 * Re-skeleton one template's output for one register.
 *
 * Takes the nodes a template built and returns the same nodes -- every one of
 * them, none added, none removed -- with the movable middle in the register's
 * order and the first screen in the register's shape.
 *
 * THE HERO LAYOUT IS ONLY SET WHERE A FIGURE ALLOWS IT. `split` is the one
 * layout that needs a `figure` prop to draw anything; site-hero.tsx falls back
 * to 左对齐 without one rather than breaking, which would make the register's
 * choice silently mean nothing. So a register asking for `split` on a template
 * that supplies no figure keeps what the template chose.
 */
export function composeSite(nodes: PuckNode[], style?: string | null): PuckNode[] {
  const skeleton = siteSkeleton(style);
  const movable = new Set<string>(MOVABLE);

  const rank = new Map<string, number>();
  skeleton.order.forEach((k, i) => rank.set(k, i));

  // Where the movable run sits in this template, so the fixed head (top bar,
  // hero) and tail (form, contact, footer, floating button) stay put.
  const first = nodes.findIndex((n) => movable.has(sectionOf(n)));
  if (first < 0) return nodes.map((n) => heroFor(n, skeleton));
  let last = first;
  for (let i = nodes.length - 1; i >= first; i--) {
    if (movable.has(sectionOf(nodes[i]))) {
      last = i;
      break;
    }
  }

  const head = nodes.slice(0, first);
  const tail = nodes.slice(last + 1);
  const middle = nodes.slice(first, last + 1);

  // Anything inside the run that is NOT movable -- a template may have put one
  // there -- keeps its relative place by riding with the section before it.
  const ordered = [...middle]
    .map((node, i) => ({ node, i, key: sectionOf(node) }))
    .sort((a, b) => {
      const ra = rank.has(a.key) ? rank.get(a.key)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.key) ? rank.get(b.key)! : Number.MAX_SAFE_INTEGER;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map((x) => x.node);

  return [...head, ...ordered, ...tail].map((n) => heroFor(n, skeleton));
}

function heroFor(node: PuckNode, skeleton: SiteSkeleton): PuckNode {
  if (idOf(node) !== "website-hero") return node;
  if (skeleton.hero === "split" && !node.props.figure) return node;
  return { ...node, props: { ...node.props, layout: skeleton.hero } };
}

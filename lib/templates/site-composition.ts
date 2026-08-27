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
  /* 别人给的证明, added 2026-08-27 from the landing kits' logo wall. Eleventh
     movable section, so every register below states where somebody else's
     vouching sits in ITS argument -- 台账 puts it under the price list because
     a licence is another line of fact, 炉 puts it under the photographs
     because a salon's proof is the score its customers gave it. */
  "creds",
  /* 一段话配一张照片, added 2026-08-27 from tailark's `content` block. Where a
     register puts the owner's own voice is an argument about the register:
     工作室 opens on it, 中台 buries it under the terms, 码 barely wants it. */
  "story",
  /* 师傅团队, 2026-08-27. Taken from the pulled library's team-1 with its data
     model replaced -- theirs is SaaS founders with GitHub links. Where a
     register puts the people is an argument about the register: 工作室 leads
     with them (a consultancy IS its people), 中台 buries them under the terms. */
  "team",
] as const;

export type SiteSection = (typeof MOVABLE)[number];

export type SiteSkeleton = {
  /** SiteHero's `layout` variant: left · band · center · plain · split.
   *  Measured against this market on 2026-08-27 (npm run shoot:market): 14 of
   *  19 real Malaysian SME sites give the first screen to a photograph, so
   *  `split` -- the only layout with a figure beside the words -- stays the
   *  most common answer. It is no longer the ONLY answer. */
  /**
   * SiteHero's `layout`. `stage` is the shape ten of twelve current landing
   * pages open on -- short headline, one line, two quiet buttons, then the
   * object full width beneath them running off the bottom of the screen.
   * Photographed 2026-08-27; see site-hero.tsx. It is the most common answer
   * and deliberately not the only one: a library where fourteen registers all
   * open the same way is a library with one register in it.
   */
  hero: "left" | "band" | "center" | "plain" | "split" | "stage";
  /**
   * 开场的地 —— what the first screen is painted on. `page` follows the
   * register's own ground; `ink` is a near-black carrying a HINT of the
   * register's own navigation hue.
   *
   * THERE IS NO COLOURED GROUND, AND THAT IS MEASURED, NOT TASteful. Ten
   * mature landing pages, dominant colour of each, 2026-08-27:
   *
   *   #080808  linear · framer · shopify · tailark · launch-ui
   *   #f8f8f8  stripe · vercel · notion · figma · intercom
   *
   * Chroma of that ground: 0.000 on all ten. Not one uses a colour as its
   * ground. The colour is real -- peak chroma 0.193 on stripe, 0.136 on
   * framer -- and it lives in the top 2% of pixels: a button, a ribbon, a
   * badge. The founder said this before the measurement did: 「这些鲜艳的颜色
   * 只会是配色 跟着就没有人会使用来当底色」.
   *
   * A `brand` ground existed here for about an hour. 招牌 opened on a full
   * panel of its own red, chroma 0.207 -- two hundred times what any of the
   * ten carries on its ground.
   *
   * Measured 2026-08-27, every pixel of a 1440px screenshot in OKLab: our
   * darkest pixel was L* 0.69 and 1% of the page carried any chroma at all,
   * against 0.11/0% for linear and 0.00/37% for framer. Every reference goes
   * dark or goes saturated; we did neither, and that is what 「感觉是配色的
   * 问题」 was pointing at.
   *
   * Which registers take it is an argument about the register, not a setting:
   * 中台 IS its deep blue sidebar, 招牌 IS a colour panel with a name on it,
   * 瑞士 is a printed sheet and must stay white.
   */
  ground?: "page" | "ink";
  /**
   * 地上的纹路 —— an optional ground texture, drawn from the register's own ink
   * at 3-6%. Geometry taken from uiverse-io/galaxy (MIT); the colours are ours,
   * because theirs are hardcoded rainbows.
   *
   * Most registers have none, and that is the point: a texture under all
   * fourteen is a texture that distinguishes nothing. 瓷 keeps its own nyonya
   * tile, which is painted by its token file rather than here.
   */
  pattern?: "dots" | "hatch" | "diamond" | "grid";
  /**
   * 页面多宽 —— the measure the page is set to. `narrow` is a quiet 60rem,
   * `normal` the 68rem everything used to share, `wide` 78rem.
   *
   * Their content breathes to the edges and ours sat in one column: that was
   * the fifth difference found beside linear, vercel and resend. Width is a
   * register decision because it is one of the few that reads instantly --
   * 中台 is dense and wide because a trade counter is, 工作室 is narrow because
   * its whole argument is that nothing sits beside anything.
   */
  measure?: "narrow" | "normal" | "wide";
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
    measure: "wide",
    hero: "left",
    opens: "价目表",
    order: ["prices", "creds", "services", "flow", "work", "story", "promise", "areas", "faq", "reviews", "team", "hours", "cta"],
  },
  // 炉: the salon, where the front desk IS the shop. What a stranger buys is
  // the look of the last customer who walked out, so the photographs lead and
  // the reviews come straight after them.
  hearth: {
    hero: "stage",
    opens: "照片墙",
    order: ["work", "story", "team", "reviews", "creds", "services", "hours", "prices", "areas", "cta", "faq", "flow", "promise"],
  },
  // 图纸: the neutral one. The most ordinary order there is -- what you do,
  // what it looks like, what happens next -- which is this register's point.
  blueprint: {
    pattern: "grid",
    hero: "stage",
    opens: "做什么",
    order: ["services", "work", "story", "team", "flow", "prices", "reviews", "creds", "cta", "faq", "areas", "promise", "hours"],
  },
  // 仪表盘: for the owner who opens a system to check four numbers. Its website
  // leads with the claims a stranger checks the same way -- 保证、覆盖、常见问题
  // -- before anything is sold.
  console: {
    hero: "center",
    opens: "保证",
    order: ["promise", "creds", "services", "story", "prices", "areas", "work", "flow", "faq", "reviews", "team", "cta", "hours"],
  },
  // 中台: the wholesaler's register, the densest in the library. Its buyer is
  // another business, and a business asks for terms before it asks for a look:
  // price, then delivery, then what the arrangement actually is.
  counter: {
    measure: "wide",
    ground: "ink",
    hero: "plain",
    opens: "条件",
    order: ["prices", "promise", "creds", "areas", "services", "story", "flow", "faq", "work", "reviews", "team", "cta", "hours"],
  },
  // 瑞士: black, white, one red, no cards. It is the register that prints, and
  // a page that reads like a document leads with words -- what we do, how it
  // works, what we promise. No photo wall; that would be the opposite register.
  swiss: {
    measure: "narrow",
    pattern: "hatch",
    hero: "plain",
    opens: "说明",
    order: ["services", "story", "team", "flow", "promise", "creds", "faq", "prices", "areas", "reviews", "work", "cta", "hours"],
  },
  // 柔和: the tuition centre, where the person reading is often nervous. It
  // opens on a coloured band and answers the worry before the sell -- what
  // happens, when you are open, what other parents said.
  soft: {
    hero: "band",
    opens: "怎么开始",
    order: ["services", "story", "team", "flow", "hours", "reviews", "creds", "faq", "prices", "work", "areas", "cta", "promise"],
  },
  // 粗野: gyms, barbers, tuning shops -- businesses that are loud on purpose.
  // The work first at full volume, then the ask, immediately. This is the only
  // skeleton that puts the mid-page CTA in the top third.
  brut: {
    measure: "wide",
    ground: "ink",
    hero: "band",
    opens: "作品 + 马上问",
    order: ["work", "cta", "services", "story", "team", "prices", "reviews", "creds", "hours", "areas", "faq", "flow", "promise"],
  },
  // 瓷: the kopitiam and the nyonya kitchen, in a shophouse. For them the price
  // list IS the menu and the menu IS the page -- then when you are open, then
  // where you are. Nobody reads a coffee shop's process diagram.
  tile: {
    ground: "ink",
    hero: "split",
    opens: "菜单",
    order: ["prices", "work", "story", "hours", "creds", "areas", "services", "reviews", "team", "faq", "cta", "flow", "promise"],
  },
  // 码: parts, model numbers, quantities. A catalogue -- the list and its
  // prices, then whether you deliver here. Monospace all the way down, so no
  // long-prose section gets to lead.
  code: {
    measure: "wide",
    pattern: "dots",
    ground: "ink",
    hero: "plain",
    opens: "货单",
    order: ["prices", "services", "story", "areas", "promise", "creds", "faq", "flow", "work", "reviews", "team", "cta", "hours"],
  },
  // 漆: 中药行、婚宴、礼品. The only register that puts colour on the GROUND, so
  // the band hero is not decoration -- it is the register itself. What it sells
  // is trust built over years, so the work and the word-of-mouth lead.
  lacquer: {
    measure: "narrow",
    ground: "ink",
    hero: "band",
    opens: "招牌 + 口碑",
    order: ["services", "work", "story", "team", "reviews", "creds", "hours", "areas", "prices", "cta", "faq", "flow", "promise"],
  },
  // 招牌: shophouse retail with a physical sign outside. The centred hero IS a
  // signboard. Then the two things somebody standing on the street needs:
  // when are you open, and where exactly are you.
  signboard: {
    pattern: "diamond",
    ground: "ink",
    hero: "center",
    opens: "店名 + 找得到",
    order: ["hours", "areas", "services", "creds", "work", "story", "team", "prices", "reviews", "cta", "faq", "flow", "promise"],
  },
  // 夜: the dark one -- shift work, monitoring, late openings. Its website
  // leads with the fact that makes it dark: we are open when others are not.
  night: {
    hero: "stage",
    opens: "还开着",
    order: ["hours", "services", "story", "team", "areas", "flow", "promise", "creds", "prices", "faq", "work", "cta", "reviews"],
  },
  // 工作室: consultants and agencies, the register where nothing sits side by
  // side. A quiet centred opening, the work, then who said what -- and the
  // enquiry is the only thing that ever asks anything.
  studio: {
    measure: "narrow",
    hero: "stage",
    opens: "自己的话",
    order: ["story", "team", "work", "services", "reviews", "creds", "flow", "faq", "promise", "prices", "areas", "cta", "hours"],
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
  const props = { ...node.props };
  /* `ground` is written even when it is "page", because the value the
     register chose has to survive into the saved layout -- a customer who
     switches register on an unsaved page re-skeletons, and one who switches
     after saving keeps what they were given. */
  props.ground = skeleton.ground ?? "page";
  if (!(skeleton.hero === "split" && !node.props.figure)) props.layout = skeleton.hero;
  return { ...node, props };
}

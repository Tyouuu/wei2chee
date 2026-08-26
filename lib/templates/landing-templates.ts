import type { PuckNode } from "@/lib/templates/puck-node";
import type { LandingCopy } from "@/lib/templates/copy/landing";

/**
 * 官网版面 — the shapes a small business's own page can take.
 *
 * ── THE QUESTION THIS FILE ANSWERS ────────────────────────────────────────
 *
 * The founder asked it directly: 「最好是每个行业适用的还是每个行业独有」.
 *
 * Neither, and the reason is that INDUSTRY IS THE WRONG AXIS. A renovation
 * contractor and an aircon servicing company are different trades and want the
 * same page, because both of them sell the same way: someone asks, you go and
 * look, you quote, they decide. A salon and a tuition centre are different
 * trades and also want the same page as each other, because both sell a SLOT.
 * Meanwhile a salon and a wholesaler are both "services" in some taxonomies
 * and want nothing alike.
 *
 * So the templates are keyed on HOW THE BUSINESS CLOSES A SALE, and the words
 * inside them come from the trade. Six shapes cover eight trades without eight
 * separate designs to maintain, and adding a ninth trade costs a mapping line
 * rather than a new template.
 *
 * That is also the only version of this a solo founder can keep alive. Eight
 * bespoke templates is eight things to fix every time a component changes.
 *
 * ── WHAT MAKES THEM LOOK DIFFERENT ────────────────────────────────────────
 *
 * Not just block order. Each one sets the 换款式 variant of its own blocks --
 * SiteHero has four genuinely different first screens (left / band / centred /
 * one-line) and EnquiryForm three. A customer who picks 现货落单 gets a
 * shopfront band across the top and a form split left-right; one who picks
 * 一页名片 gets a headline and a phone number. Those read as different pages,
 * which is the whole point of a gallery.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ─────────────────────────────────────────
 *
 * STOCK photographs, and the distinction sharpened on 2026-08-25 rather than
 * reversing. The original argument stands: filling six templates with the same
 * library images is how a generated site announces that nobody designed it, and
 * it would make all six look identical, undoing the only thing this file is for.
 *
 * What that argument was taken to mean, wrongly, was NO PHOTO SLOT AT ALL --
 * so a renovation contractor's page had nowhere for the three photos that are
 * the entire reason a stranger believes them. `work()` below places three EMPTY
 * frames, sized, captioned 「放一张照片」, and obviously the owner's to fill. A
 * labelled gap is honest; a stranger's kitchen is not.
 *
 * ── THE SIX SECTIONS ADDED THE SAME DAY ───────────────────────────────────
 *
 * 口碑、价目、覆盖范围、常见问题、营业时间、保证 -- the founder's own list of
 * what these pages were missing. Every component they use already existed in
 * the palette with its register variants; nothing here is new capability. What
 * was missing was a template that put them on a page, which is the same shape
 * of gap the dashboard had: a library full of blocks and a screen with three.
 */

export type LandingTemplate = {
  /** Stable. Stored in nothing today -- the layout is written directly -- but
   *  named so the gallery, the tests and any future "which one did they pick"
   *  question have one string to agree on. */
  key: string;
  label: string;
  /** Who it is for, in the founder's own register: a sentence about the SALE,
   *  not about the trade. */
  blurb: string;
  /** Trades whose default this is. First match wins; anything unmapped falls
   *  back to `quote`. */
  trades: string[];
  /**
   * The same two, for the English portal.
   *
   * Written out rather than machine-translated. 「客人先问，你上门看了才报价」 is
   * not 「the customer asks first, you go and look then quote」 -- it is 「They
   * ask, you go and look, then you quote」, which is how a contractor would say
   * it. A gallery a business owner is choosing from by feel is the wrong place
   * for copy that reads translated.
   */
  labelEn: string;
  blurbEn: string;
  build: (ctx: LandingContent) => PuckNode[];
};

/**
 * Everything a template needs, already resolved from the business.
 *
 * A plain data bag rather than the BusinessContext itself: these functions
 * should not be able to reach for `analysis.summary` and put the AI's
 * diagnosis of what is BROKEN on a page strangers read. That happened once
 * already (see buildWebsite), and the narrow input is the fix that prevents it
 * happening again rather than a comment asking people not to.
 */
export type LandingContent = {
  /** The business's own name. */
  brand: string;
  /** 「马来西亚 · 装修」 */
  eyebrow: string;
  /** What they sell, one line. */
  pitch: string;
  /** Three things they do. */
  services: { label: string; value: string; icon: string }[];
  /** Their own workflow stages, from the analysis. */
  stages: string[];
  /**
   * The page an enquiry becomes: 报价单 / 预约 / 订单 — or NULL for a trade that
   * takes no enquiries through a website at all.
   *
   * Null is a real answer, not a missing one. A kopitiam, a grocery, a car
   * wash: their customers walk in. Giving them a form promises an inbox that
   * stays empty for a month, and an empty inbox does not read as "nobody has
   * written yet", it reads as software that does not work. A template seeing
   * null builds a shopfront instead — hours, where you are, and a WhatsApp
   * button that goes straight to a chat.
   */
  landsIn: string | null;
  /**
   * What the form asks, in the order it asks, already in this system's
   * language. Empty means the template falls back to its own three questions.
   *
   * It exists because the three were the SAME for all eight industries, under
   * a placeholder reading "3-room renovation, roughly how much?" that salons,
   * clinics and workshops all saw on their own website. That single line
   * contradicted the only thing this product claims.
   */
  enquiryFields: { label: string; kind: string }[];
  /** Three checkable facts. */
  proof: { value: string; label: string }[];
  /** `placeholder` marks a row still holding the seeded value -- it is what
   *  keeps 「012-345 6789」 off a published page. See publish-projection.ts. */
  contact: { label: string; value: string; icon: string; placeholder?: boolean }[];
  /** The words this page is written in, already resolved from the project's
   *  `system_language`. On the bag rather than reached for, for the same
   *  reason everything else here is: a template that could pick its own
   *  language is a template that can disagree with the rest of the system. */
  words: LandingCopy["page"];
};

const node = (
  type: string,
  id: string,
  props: Record<string, unknown>,
): PuckNode => ({
  type,
  props: { id, ...props },
});

/**
 * `figure` is what goes on the RIGHT of the first screen, and it is the reason
 * these six stopped being one page six times.
 *
 * Counted on 2026-08-23, before this: four component types across all six
 * templates, two of the five slots the same component twice, and zero images
 * anywhere -- while 216 pulled sections and 46 ilinxa components sat unused.
 * Every 款式 of SiteHero was an ALIGNMENT of the same single column.
 *
 * The figure is the document this business sends, drawn from data the page
 * already carries. Each sale ends in a different piece of paper, so each
 * template gets a different object rather than a different alignment:
 *
 *     上门报价  quotation      现货落单  order
 *     预约时段  booking slip   批发询价  price list
 *     先看东西  work grid      一页名片  card
 *
 * See design-system/components/hero-figure.tsx for why it is not a photograph
 * -- and for why "no stock photos", which this file already argued and was
 * right about, never meant "nothing visual at all".
 */
const hero = (
  c: LandingContent,
  layout: string,
  figure?: string,
  extra: Record<string, unknown> = {},
) =>
  node("SiteHero", "website-hero", {
    layout,
    eyebrow: c.eyebrow,
    headline: c.brand,
    sub: c.pitch,
    /*
      THE NUMBER AND THE HOURS, TAKEN FROM WHAT THE PAGE ALREADY CARRIES.

      Both come out of `c.contact`, which every template already renders at the
      BOTTOM of the page. Photographed against two real Malaysian SME sites on
      2026-08-26: on both of them the number is in the FIRST screen, set large,
      and the hours are a strip across the very top. Ours had the number in a
      list under the FAQ, five screens down, in 13px.

      `placeholder` rides along so the projection can drop exactly these two
      fields on publish while keeping the rest of the hero -- an unfilled phone
      number must never reach a stranger, and a headline is not an unfilled
      phone number. See publish-projection.ts.
    */
    ...(() => {
      const phone = c.contact.find((r) => r.icon === "phone");
      const hours = c.contact.find((r) => r.icon === "time");
      return {
        /*
          THE SAME ROWS THE PRICE SECTION HAS, IN THE FIRST SCREEN.

          Empty values, not the 「RM —」 the section below prints: a blank row
          renders nothing at all here (site-hero.tsx), so an owner who has not
          set prices gets a first screen with no price block rather than a first
          screen advertising three dashes. The rows are still handed over so
          that typing one price puts it in the opening immediately -- which is
          what the aircon company's page does with 「GENERAL SERVICE RM 60」, and
          the reason it is the first thing you see.
        */
        priceRows: c.services.map((svc) => ({ label: svc.label, value: "" })),
        ...(phone
          ? {
              phoneLabel: c.words.callUs,
              phoneNumber: phone.value,
              phonePlaceholder: phone.placeholder === true,
            }
          : {}),
        ...(hours
          ? { strip: `${hours.label} · ${hours.value}`, stripPlaceholder: hours.placeholder === true }
          : {}),
      };
    })(),
    primaryLabel: c.words.whatsapp,
    primaryHref: "#",
    secondaryLabel: c.words.seeWork,
    secondaryHref: "#",
    proof: c.proof,
    ...(figure
      ? {
          figure,
          figureData: {
            brand: c.brand,
            services: c.services.map((s) => ({ label: s.label, value: s.value })),
            stages: c.stages,
            landsIn: c.landsIn,
            // Both already exist in the page's own language: the reply note is
            // what the enquiry form says under its button, and 问价 is the
            // WhatsApp button's own word. Reusing them keeps the figure inside
            // the vocabulary the rest of the page already established.
            note: c.words.replyNote,
            askLabel: c.words.askShort,
            sampleLabel: c.words.sampleLabel,
          },
        }
      : {}),
    ...extra,
  });

const services = (c: LandingContent, heading: string, framed = true) =>
  node("InfoRows", "website-services", {
    heading,
    framed,
    rows: c.services,
  });

const flow = (c: LandingContent, title: string, layout = "row") =>
  node("WorkflowStrip", "website-flow", {
    title,
    layout,
    stages: c.stages.map((label) => ({ label, tone: "normal" })),
  });

const form = (c: LandingContent, key: string, look: string) => {
  const t = c.words.byTemplate[key] ?? c.words.byTemplate.quote;

  // THE QUESTIONS THIS TRADE ACTUALLY NEEDS ANSWERED, 2026-08-25.
  //
  // `c.words.fields` is one list shared by all eight industries, and its third
  // question carried the placeholder "3-room renovation, roughly how much?" --
  // which salons, clinics, workshops and wholesalers all saw on their own
  // website. It is the single line that most directly contradicts what this
  // product sells, because it is the customer's own page telling them it was
  // written for somebody else.
  //
  // The analysis now names them (see lib/openai/analysis-schema.ts). The shared
  // list stays as the fallback for every system built before that and for the
  // path where no model ran: generic, but never addressed to another trade.
  //
  // Placeholders are dropped rather than invented. A label the model wrote for
  // this business is better unaccompanied than paired with an example from a
  // different one.
  const fields = c.enquiryFields.length
    ? c.enquiryFields.map((f) => ({ label: f.label, placeholder: "", kind: f.kind }))
    : c.words.fields;

  return node("EnquiryForm", "website-form", {
    look,
    heading: t.formHeading,
    blurb: t.formBlurb,
    fields,
    submitLabel: t.submit,
    // Null means this trade takes no enquiries; EnquiryForm renders the form
    // without the arrow line rather than promising a record that will never
    // appear. buildWebsite drops the block entirely for those trades -- this is
    // the second guard, for a customer who adds the block back by hand.
    landsIn: c.landsIn ?? "",
    // EnquiryForm is server-rendered and cannot read a language context, so the
    // three pieces of the arrow line are passed. They also land in the saved
    // layout, which makes them the customer's to rewrite like any other text.
    landsInBadge: c.words.arrowBadge,
    landsInBefore: c.words.arrowBefore,
    landsInAfter: c.words.arrowAfter,
    note: c.words.replyNote,
  });
};

/**
 * THE SIX SECTIONS A MALAYSIAN SME PAGE NEEDS.
 *
 * The founder's own list: 「下一个真正的洞是版段太少 —— 一页只有 hero/服务/流程/
 * 表单/联络五种。缺的是口碑、价目、覆盖范围、常见问题、营业时间、保证。」
 *
 * Every component below already existed — PhotoFrame, Stars, PriceTable,
 * FoldSection, InfoRows, MarkList are all in the palette and all carry their
 * register variants. Nothing here is new capability. What was missing was any
 * template that PUT them on a page, which is the same shape of gap as the
 * dashboard's: a library full of blocks and a first screen with three.
 *
 * They are also the six things an imported American SaaS template does not
 * have, because a US software company is never asked 「你们做不做 Cheras」.
 */

/** Work photos. Empty frames on purpose — a renovation page filled with stock
 *  photos of somebody else's kitchen announces that nobody designed it, and
 *  the fix is the owner's own three photos, which is a two-minute job with an
 *  obvious, sized, labelled slot to drop them into. */
const work = (c: LandingContent) =>
  node("Columns", "website-work", {
    layout: "thirds",
    a: [node("PhotoFrame", "website-work-1", { caption: c.words.sections.work.shots[0], ratio: "photo" })],
    b: [node("PhotoFrame", "website-work-2", { caption: c.words.sections.work.shots[1], ratio: "photo" })],
    c: [node("PhotoFrame", "website-work-3", { caption: c.words.sections.work.shots[2], ratio: "photo" })],
  });

/**
 * Where they cover. The single most-asked question in this market and the one a
 * stranger will not message to find out -- they will just close the page.
 *
 * ONE ROW, NOT EIGHT. The first version gave each area its own MarkList line
 * and the render was the argument against it: eight rules across the page for
 * eight place names, taller than the services section above it, for a fact a
 * reader takes in at a glance. Place names are a phrase, not a checklist.
 */
const areas = (c: LandingContent) =>
  node("InfoRows", "website-areas", {
    heading: c.words.sections.areas.heading,
    framed: true,
    rows: [
      {
        label: c.words.sections.areas.heading,
        value: c.words.sections.areas.list.join(" · "),
        icon: "place",
      },
      { label: "", value: c.words.sections.areas.note, icon: "tag" },
    ],
  });

/**
 * A price GUIDE, never a price.
 *
 * NOT PriceTable, and the reason is worth writing down: its `price` field is a
 * NUMBER. There is no way to say 「RM —」 in it, and the nearest thing it can
 * say is 0 -- a page telling a stranger the job costs nothing. A component that
 * cannot express "we have not filled this in yet" is the wrong component for a
 * page that ships before the owner has filled it in.
 *
 * So the three services this business already listed, each with a blank beside
 * it and a note saying it is a guide. A page that invents a number lies to a
 * stranger; a page with no number at all sends them to WhatsApp to ask, which
 * is one more reason not to bother.
 */
const prices = (c: LandingContent) =>
  node("InfoRows", "website-prices", {
    heading: c.words.sections.prices.heading,
    framed: true,
    /*
      EVERY ROW IS A PLACEHOLDER UNTIL THE OWNER TYPES A PRICE, and it is
      marked so that publish-projection drops it.

      Seen on the live site: 「What it costs」 over three service names each
      reading 「RM —」. To a homeowner that does not say 「not filled in yet」. It
      says this business will not tell you what it costs -- which is the
      opposite of what the section is for, and worse than not having it. The
      local trade sites this was measured against lead with the price:
      「GENERAL SERVICE RM 60」 is the first thing on that page.
    */
    rows: c.services.map((s) => ({
      label: s.label,
      value: c.words.sections.prices.blank,
      icon: "money",
      placeholder: true,
    })),
  });

/** Word of mouth, which in this market is the whole sale. Two placeholder
 *  lines that read like a real customer rather than like marketing, with the
 *  instruction to replace them sitting on the page where the owner will see
 *  it. */
const reviews = (c: LandingContent) =>
  node("ShelfList", "website-reviews", {
    heading: c.words.sections.reviews.heading,
    items: c.words.sections.reviews.quotes.map((q) => ({
      title: q.text,
      description: q.who,
      icon: "person",
      action: "",
    })),
  });

/** The four questions that otherwise arrive one at a time on WhatsApp. */
const faq = (c: LandingContent) =>
  node("FoldSection", "website-faq", {
    rows: c.words.sections.faq.rows,
    openFirst: true,
  });

/** Opening hours. The one section a walk-in trade needs more than a form. */
const hours = (c: LandingContent) =>
  node("InfoRows", "website-hours", {
    heading: c.words.sections.hours.heading,
    framed: true,
    rows: c.words.sections.hours.rows.map((r) => ({ ...r, icon: "time" })),
  });

/** What the business commits to. Concrete promises a stranger can hold them
 *  to, which is what makes a stranger message rather than an adjective. */
const promiseList = (c: LandingContent) =>
  node("MarkList", "website-promise", {
    heading: c.words.sections.promiseList.heading,
    // The template names the rule rather than leaving it to the register, for
    // the same reason it names 「numbered」 on a booking page's flow: four
    // commitments read as a list under any register, and the 「separator」
    // treatment some of them prefer pushes each line to the right of a
    // full-width rule -- which reads as a layout bug rather than as a promise.
    rule: "border",
    marks: c.words.sections.promiseList.marks.map((text) => ({ text, tone: "good", icon: "file" })),
  });

/*
  THE TOP BAR AND THE FOOT.

  Neither existed until 2026-08-27, and the reason they did not is the reason
  the founder could see at a glance that our site was not like anyone else's:
  the website was built out of the DASHBOARD's component set, and a dashboard
  has no top bar (its navigation is the rail) and no foot (it never ends).

  The bar's links are anchors to sections of this same page, built from the
  sections this template actually emitted -- not a fixed four, which would give
  a one-page card the same nav as a full site.
*/
/*
  THE BAR'S LINKS ARE THIS PAGE'S OWN SECTIONS.

  Three, not four or five: a renovation contractor has three things a stranger
  wants to jump to, and a bar carrying eight links reads as a company that has
  eight departments. Every template emits the services list, a price section and
  the form, so those three are the ones every bar can honestly point at.
*/
const anchors = (c: LandingContent) => [
  { label: c.words.sections.work.heading, href: "#website-services" },
  { label: c.words.sections.prices.heading, href: "#website-prices" },
  { label: c.words.contactHeading, href: "#website-form" },
];

const bar = (c: LandingContent, links: { label: string; href: string }[]) => {
  const phone = c.contact.find((r) => r.icon === "phone");
  return node("SiteBar", "website-bar", {
    brand: c.brand,
    links,
    actionLabel: c.words.askShort,
    actionHref: phone && phone.placeholder !== true ? `tel:${phone.value}` : "#enquiry",
  });
};

const foot = (c: LandingContent) =>
  node("SiteFoot", "website-foot", {
    brand: c.brand,
    tagline: c.eyebrow,
    // The same rows the contact section carries, and the same placeholder flag
    // -- a foot that prints 「WhatsApp 012-345 6789」 is the exact failure this
    // module was built to stop, one screen further down.
    rows: c.contact.map((r) => ({ label: r.label, value: r.value, placeholder: r.placeholder })),
  });

/*
  跟着页面走的 WhatsApp 按钮.

  Last in every template's list, so it is the last node on the page and its
  `fixed` positioning has nothing after it to fight. Only for trades that take
  an enquiry at all: a kopitiam whose customers walk in gets `landsIn: null`
  and no chat button, which is the same judgement the enquiry form already
  makes. See floating-contact.tsx.
*/
const floating = (c: LandingContent) => {
  const phone = c.contact.find((r) => r.icon === "phone");
  if (!phone) return [];
  return [
    node("FloatingContact", "website-floating", {
      number: phone.value,
      label: c.words.whatsappShort,
      message: c.words.whatsappFirstLine,
      placeholder: phone.placeholder === true,
    }),
  ];
};

const contact = (c: LandingContent, framed = true) =>
  node("InfoRows", "website-contact", {
    heading: c.words.contactHeading,
    framed,
    rows: c.contact,
  });

/** The section headings for one template, in the page's own language. */
const sect = (c: LandingContent, key: string) =>
  c.words.byTemplate[key] ?? c.words.byTemplate.quote;

export const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    key: "quote",
    label: "上门报价",
    blurb: "客人先问，你上门看了才报价。装修、维修、承包这一类。",
    labelEn: "Quote after a visit",
    blurbEn: "They ask, you go and look, then you quote. Renovation, repairs, contracting.",
    trades: ["renovation", "services", "other"],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "quote"),
      services(c, sect(c, "quote").services),
      work(c),
      prices(c),
      flow(c, sect(c, "quote").flow ?? ""),
      reviews(c),
      areas(c),
      faq(c),
      promiseList(c),
      form(c, "quote", "card"),
      contact(c),
      foot(c),
      ...floating(c),
    ],
  },
  {
    key: "booking",
    label: "预约时段",
    blurb: "客人要订一个时间。美容、补习、诊所这一类。",
    labelEn: "Book a time",
    blurbEn: "They need a slot. Salons, tuition, clinics.",
    trades: ["beauty", "education"],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "booking"),
      services(c, sect(c, "booking").services),
      // Numbered, not arrows: someone booking a slot is reading "what do I do
      // first", which is a list of steps rather than a pipeline.
      flow(c, sect(c, "booking").flow ?? "", "numbered"),
      work(c),
      prices(c),
      reviews(c),
      hours(c),
      faq(c),
      form(c, "booking", "split"),
      contact(c),
      foot(c),
      ...floating(c),
    ],
  },
  {
    key: "order",
    label: "现货落单",
    blurb: "客人看了直接下单。餐饮、零售这一类。",
    labelEn: "Order off the shelf",
    blurbEn: "They see it and order. F&B, retail.",
    trades: ["fnb", "retail"],
    build: (c) => [
      bar(c, anchors(c)),
      // The band is the shopfront: for a business whose page IS the shop, the
      // first screen should feel like walking past it.
      hero(c, "split", "order"),
      services(c, sect(c, "order").services),
      work(c),
      prices(c),
      hours(c),
      areas(c),
      reviews(c),
      form(c, "order", "split"),
      contact(c, false),
      foot(c),
      ...floating(c),
    ],
  },
  {
    key: "wholesale",
    label: "批发询价",
    blurb: "买的人是生意人，要的是条件：账期、送货、量大多少钱。",
    labelEn: "Trade enquiry",
    blurbEn: "The buyer is a business. They want terms: credit, delivery, price at volume.",
    trades: ["wholesale"],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "pricelist"),
      services(c, sect(c, "wholesale").services),
      flow(c, sect(c, "wholesale").flow ?? "", "timeline"),
      prices(c),
      areas(c),
      promiseList(c),
      faq(c),
      form(c, "wholesale", "card"),
      contact(c),
      foot(c),
      ...floating(c),
    ],
  },
  {
    key: "portfolio",
    label: "先看东西",
    blurb: "客人是看了作品才决定的。设计、摄影、装修都可以用这个。",
    labelEn: "Work first",
    blurbEn: "They decide after seeing what you have made. Design, photography, renovation.",
    trades: [],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "grid"),
      // Services first and unframed: on a page whose job is "look at this",
      // boxes around every section fight the looking.
      work(c),
      services(c, sect(c, "portfolio").services, false),
      reviews(c),
      flow(c, sect(c, "portfolio").flow ?? "", "timeline"),
      faq(c),
      form(c, "portfolio", "plain"),
      contact(c, false),
      foot(c),
      ...floating(c),
    ],
  },
  {
    key: "card",
    label: "一页名片",
    blurb: "最简单的一页：你是谁、做什么、怎么找你。没有表格。",
    labelEn: "One-page card",
    blurbEn: "The simplest page: who you are, what you do, how to reach you. No form.",
    trades: [],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "card"),
      services(c, sect(c, "card").services, false),
      hours(c),
      areas(c),
      reviews(c),
      contact(c),
      foot(c),
      ...floating(c),
    ],
  },
];

export const LANDING_BY_KEY: Record<string, LandingTemplate> =
  Object.fromEntries(LANDING_TEMPLATES.map((t) => [t.key, t]));

/** Which shape a trade opens on. Everything unmapped gets 上门报价, which is
 *  the most common Malaysian SME sale and the safest wrong answer. */
export function landingTemplateFor(slug?: string | null): LandingTemplate {
  if (slug) {
    const hit = LANDING_TEMPLATES.find((t) => t.trades.includes(slug));
    if (hit) return hit;
  }
  return LANDING_BY_KEY.quote;
}

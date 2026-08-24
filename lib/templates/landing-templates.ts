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
 * Photographs. A renovation page without work photos is missing something real,
 * and the fix is the customer's own photos, not stock. Filling six templates
 * with the same library images is exactly how a generated site announces that
 * nobody designed it -- and it would make all six look identical, undoing the
 * only thing this file is for.
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
  contact: { label: string; value: string; icon: string }[];
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
    trades: ["renovation", "services", "other"],
    build: (c) => [
      hero(c, "split", "quote"),
      services(c, sect(c, "quote").services),
      flow(c, sect(c, "quote").flow ?? ""),
      form(c, "quote", "card"),
      contact(c),
    ],
  },
  {
    key: "booking",
    label: "预约时段",
    blurb: "客人要订一个时间。美容、补习、诊所这一类。",
    trades: ["beauty", "education"],
    build: (c) => [
      hero(c, "split", "booking"),
      services(c, sect(c, "booking").services),
      // Numbered, not arrows: someone booking a slot is reading "what do I do
      // first", which is a list of steps rather than a pipeline.
      flow(c, sect(c, "booking").flow ?? "", "numbered"),
      form(c, "booking", "split"),
      contact(c),
    ],
  },
  {
    key: "order",
    label: "现货落单",
    blurb: "客人看了直接下单。餐饮、零售这一类。",
    trades: ["fnb", "retail"],
    build: (c) => [
      // The band is the shopfront: for a business whose page IS the shop, the
      // first screen should feel like walking past it.
      hero(c, "split", "order"),
      services(c, sect(c, "order").services),
      form(c, "order", "split"),
      contact(c, false),
    ],
  },
  {
    key: "wholesale",
    label: "批发询价",
    blurb: "买的人是生意人，要的是条件：账期、送货、量大多少钱。",
    trades: ["wholesale"],
    build: (c) => [
      hero(c, "split", "pricelist"),
      services(c, sect(c, "wholesale").services),
      flow(c, sect(c, "wholesale").flow ?? "", "timeline"),
      form(c, "wholesale", "card"),
      contact(c),
    ],
  },
  {
    key: "portfolio",
    label: "先看东西",
    blurb: "客人是看了作品才决定的。设计、摄影、装修都可以用这个。",
    trades: [],
    build: (c) => [
      hero(c, "split", "grid"),
      // Services first and unframed: on a page whose job is "look at this",
      // boxes around every section fight the looking.
      services(c, sect(c, "portfolio").services, false),
      flow(c, sect(c, "portfolio").flow ?? "", "timeline"),
      form(c, "portfolio", "plain"),
      contact(c, false),
    ],
  },
  {
    key: "card",
    label: "一页名片",
    blurb: "最简单的一页：你是谁、做什么、怎么找你。没有表格。",
    trades: [],
    build: (c) => [
      hero(c, "split", "card"),
      services(c, sect(c, "card").services, false),
      contact(c),
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

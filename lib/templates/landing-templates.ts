import type { PuckNode } from "@/lib/templates/puck-node";

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
  /** The page an enquiry becomes: 报价单 / 预约 / 订单. */
  landsIn: string;
  /** Three checkable facts. */
  proof: { value: string; label: string }[];
  contact: { label: string; value: string; icon: string }[];
};

const node = (
  type: string,
  id: string,
  props: Record<string, unknown>,
): PuckNode => ({
  type,
  props: { id, ...props },
});

const hero = (
  c: LandingContent,
  layout: string,
  extra: Record<string, unknown> = {},
) =>
  node("SiteHero", "website-hero", {
    layout,
    eyebrow: c.eyebrow,
    headline: c.brand,
    sub: c.pitch,
    primaryLabel: "WhatsApp 问价",
    primaryHref: "#",
    secondaryLabel: "看我们做过什么",
    secondaryHref: "#",
    proof: c.proof,
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

const form = (
  c: LandingContent,
  heading: string,
  blurb: string,
  look: string,
  submit = "送出",
) =>
  node("EnquiryForm", "website-form", {
    look,
    heading,
    blurb,
    fields: [
      { label: "怎么称呼", placeholder: "陈先生", kind: "text" },
      { label: "电话 / WhatsApp", placeholder: "012-345 6789", kind: "phone" },
      {
        label: "想做什么",
        placeholder: "三房翻新，想问大概多少",
        kind: "long",
      },
    ],
    submitLabel: submit,
    landsIn: c.landsIn,
    note: "通常一天内回。",
  });

const contact = (c: LandingContent, framed = true) =>
  node("InfoRows", "website-contact", {
    heading: "怎么找我们",
    framed,
    rows: c.contact,
  });

export const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    key: "quote",
    label: "上门报价",
    blurb: "客人先问，你上门看了才报价。装修、维修、承包这一类。",
    trades: ["renovation", "services", "other"],
    build: (c) => [
      hero(c, "left"),
      services(c, "我们做什么"),
      flow(c, "找我们之后会怎么走"),
      form(
        c,
        "留个电话，我们回你",
        "填三格就好。我们看到会直接 WhatsApp 你，不会打推销电话。",
        "card",
      ),
      contact(c),
    ],
  },
  {
    key: "booking",
    label: "预约时段",
    blurb: "客人要订一个时间。美容、补习、诊所这一类。",
    trades: ["beauty", "education"],
    build: (c) => [
      hero(c, "center"),
      services(c, "可以做什么"),
      // Numbered, not arrows: someone booking a slot is reading "what do I do
      // first", which is a list of steps rather than a pipeline.
      flow(c, "怎么预约", "numbered"),
      form(
        c,
        "想约什么时候？",
        "留个电话跟想约的时间，我们确认了回你。",
        "split",
        "预约",
      ),
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
      hero(c, "band"),
      services(c, "有什么"),
      form(c, "要订什么？", "写下来，我们看到就准备。", "split", "落单"),
      contact(c, false),
    ],
  },
  {
    key: "wholesale",
    label: "批发询价",
    blurb: "买的人是生意人，要的是条件：账期、送货、量大多少钱。",
    trades: ["wholesale"],
    build: (c) => [
      hero(c, "left"),
      services(c, "供什么货"),
      flow(c, "怎么合作", "timeline"),
      form(
        c,
        "要报价？",
        "讲一下要什么、大概多少量，我们报价给你。",
        "card",
        "要报价",
      ),
      contact(c),
    ],
  },
  {
    key: "portfolio",
    label: "先看东西",
    blurb: "客人是看了作品才决定的。设计、摄影、装修都可以用这个。",
    trades: [],
    build: (c) => [
      hero(c, "center"),
      // Services first and unframed: on a page whose job is "look at this",
      // boxes around every section fight the looking.
      services(c, "做过什么", false),
      flow(c, "合作流程", "timeline"),
      form(c, "有想做的？", "讲一下想做什么，我们回你。", "plain"),
      contact(c, false),
    ],
  },
  {
    key: "card",
    label: "一页名片",
    blurb: "最简单的一页：你是谁、做什么、怎么找你。没有表格。",
    trades: [],
    build: (c) => [
      hero(c, "plain"),
      services(c, "我们做什么", false),
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

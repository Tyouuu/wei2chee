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
  /**
   * Trades whose default this is. EMPTY MEANS GALLERY-ONLY, ON PURPOSE.
   *
   * ⚠️ It used to say 「first match wins」, and that sentence was hiding a dead
   * template. `landingTemplateFor` scans in declaration order, `quote` declared
   * services first, and 明码标价 -- built from five of the nineteen Malaysian SME
   * sites actually measured, three of which put the price in their own URL --
   * could never be reached by anybody. It read as a supported choice and was
   * unreachable code.
   *
   * A trade may now appear on exactly ONE template, and every template either
   * has a trade or is deliberately gallery-only. Both are asserted; see
   * landing-templates.test.ts.
   */
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
  /** What the business DOES, short. The company name lives in the bar; see
   *  landingContentFor for the twelve references that agree on this. */
  headline: string;
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
    /*
      NO `eyebrow`, AND IT IS NOT AN OMISSION.

      SiteHero has printed nothing for it since 2026-08-27 (9e19ed6), and that
      is a decision with a reason: the eyebrow read 「MALAYSIA · RENOVATION &
      FITOUT」 directly above a headline reading 「Renovation & fitout in Kuala
      Lumpur」 -- the same fact twice on one screen, on every register. Writing
      it here anyway put a value into every customer's saved page that nothing
      would ever show, and the editor then offered a box for it.

      The string itself is not wasted: `foot` still uses it as the tagline,
      which is the one place on the page it is not a repeat.
    */
    brand: c.brand,
    headline: c.headline,
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
    /* 🔴 这两条本来是字面的 `"#"`（2026-09-05 在真的上线页面上量到的）——
       **不是产生器算错，是从写出来那天起就是两颗按不动的按钮**，
       而它们是第一屏上仅有的两颗。这个仓库禁的第一条就是这个。

       每一颗指它自己真正的落点：「问价」去询价那一块，
       「看作品」去服务那一段。那一段被拿掉的时候，
       `pruneDeadAnchorsIn` 会把整颗按钮拿掉，而不是留一颗指不到的。 */
    primaryLabel: c.words.whatsapp,
    primaryHref: "#website-form",
    secondaryLabel: c.words.seeWork,
    secondaryHref: "#website-services",
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
  /*
    CARDS, NOT A LIST.

    This was `InfoRows` -- the dashboard block that draws a labelled row with an
    icon, which is right on a system page and wrong here. Measured against
    tailark and nobruf on 2026-08-27: every reference draws what a business
    SELLS as a card grid and keeps rows for what it merely lists. Three services
    in three rows read as a settings screen; three services in three cards read
    as three things you can buy.

    `framed` is kept in the signature and ignored, because six templates pass it
    and none of them should have to know this block changed shape.
  */
  node("SiteFeatures", "website-services", {
    heading,
    /*
      THE SECOND HEADING'S LINE.

      两个标题三张点卡 frames the section with a large heading on the left and a
      small one with a sentence on the right -- section four of the page 満図
      copies whole. Their sentence is template filler (「Explore where we can
      provide our exceptional security solutions」); ours has to be true, and
      the true thing a stranger wants beside 「what we offer」 in this market is
      WHERE. 服务范围 is already asked in the questionnaire, and on the
      registers that decline the 服务范围 section it was going unread.

      Every other shape ignores `note`, so this costs them nothing.
    */
    noteHeading: c.words.sections.areas.heading,
    note: c.words.sections.areas.list.slice(0, 4).join(" · "),
    items: c.services,
    // Referenced so the parameter is not dead weight to a reader.
    ...(framed ? {} : {}),
  });

/*
  流程 —— AND WHY IT NO LONGER NAMES ITS OWN SHAPE.

  This shipped `layout = "row"` as a default and three of the four templates
  passed one explicitly. A prop that is PRESENT beats the register's
  preference -- that is the precedence the whole shape layer rests on, and an
  ABSENT prop is the only way to say 「follow the register」. So every register's
  WorkflowStrip preference was dead on the website: 満図 asked for 竖排 and got
  a 155px horizontal strip of numbered chips, against the reference's 663px
  stacked section.

  Ninth time in this repo that a capability was built and something upstream
  quietly overrode it. The template states the words; the register states the
  shape.
*/
const flow = (c: LandingContent, title: string) =>
  node("SiteSteps", "website-flow", {
    heading: title,
    steps: c.stages.map((label) => ({ label, value: "" })),
  });

/* ⚠️ 表格的样子（一个框 / 不要框 / 左右分）不再由行业模版写死。

   它以前是这里的第三个参数：quote 是 card、booking 是 split、order 是 split。
   写进 props 的东西在这套系统里排在最前面 —— 客人自己的值 > 风格的偏好 >
   组件预设 —— 所以那一行等於「这个行业永远用这个形状，任何风格都改不了」。
   瑞士 照 Leah Webb 抄的时候，它的第7段是平铺在白底上的表格加右边一栏联络
   资料；风格宣告了 split，画出来还是一张灰卡，因为模版早就替它决定了。

   形状属於风格层，跟这个档案里其他每一个 Site* 一样（重点 7c）。没有宣告的
   风格拿组件预设 card。 */
const form = (c: LandingContent, key: string) => {
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
/*
  作品墙. Was a Columns of three PhotoFrames locked to thirds -- the section
  this market cares most about, and the one section where the register had no
  say at all, so fourteen 风格 drew fourteen identical rows of three.

  SiteGallery owns its own shapes now (三张一样大 / 一大两小 / 横着滑), taken
  from tailark's `bento` and `features-carousel` blocks. See site-sections.tsx.
*/
const work = (c: LandingContent) =>
  node("SiteGallery", "website-work", {
    heading: c.words.sections.work.heading,
    note: c.words.sections.work.hint,
    items: c.words.sections.work.shots.map((caption) => ({ src: "", caption, alt: "" })),
    /* 「看全部」 — the one control their mosaic ends on. It points at the ask,
       which is already on the page and already the thing a visitor who has
       just looked at the work wants next. Nothing new is claimed. */
    moreLabel: c.words.contactHeading,
    moreHref: "#website-form",
  });

/*
  一段话配一张照片 — the section every small business page has and this one did
  not: the page was cards, rows and a table, which is a dashboard's vocabulary.
  tailark ships it as `content` in three of its four themes.
*/
/*
  师傅团队. Composition taken from components/blocks/team-1.tsx -- 215 lines,
  zero hardcoded colours -- with its data model replaced. Theirs is SaaS
  founders with LinkedIn, Twitter and GitHub; a contractor's team is a name, a
  trade, how long, and a face.
*/
const team = (c: LandingContent) =>
  node("SiteTeam", "website-team", {
    heading: c.words.sections.team.heading,
    note: c.words.sections.team.note,
    hint: c.words.sections.team.hint,
    members: [],
  });

/**
 * 一句话占一屏 -- the pitch, moved rather than repeated.
 *
 * `c.pitch` is already what the hero prints under the headline. Emitting it
 * here is safe because composeSite drops THIS block on every register that
 * does not name `statement`, and blanks the hero's `sub` on every register
 * that does. Exactly one of the two prints it, always.
 */
/* PINNED UNDER THE HERO, NOT INSIDE THE MOVABLE RUN.

   It was emitted next to `story` first, and industry-template.test.ts printed
   the consequence: composeSite sorts the movable run by the register's order,
   a block whose section nobody names sorts last, and the band that is supposed
   to sit directly under the first screen landed at the bottom of the page --
   on the three registers that actually want it. It belongs to the head, with
   the bar and the hero, because its position is not an argument any register
   is having. */
/* 一条满边的照片 —— ships empty, prompts in the editor, dropped on publish. */
/* 四点两栏配照片 —— the reference's largest section. Ships with the promises
   the trade already gives (the same four 保证 carries) and no photographs; the
   owner's own go in through the picker. */
const woven = (c: LandingContent) =>
  node("SiteWoven", "website-woven", {
    heading: c.words.sections.promiseList.heading,
    note: "",
    /* The same four commitments 保证 already carries. This section does not
       invent a claim -- it gives the ones the trade already makes the shape
       the reference gives them. */
    points: c.words.sections.promiseList.marks.map((label) => ({ label, value: "" })),
    photos: [],
  });

const band = (c: LandingContent) =>
  node("SiteBand", "website-band", {
    photo: "",
    photoAlt: "",
    hint: c.words.sections.work.hint,
  });

const statement = (c: LandingContent) =>
  node("SiteStatement", "website-statement", {
    body: c.pitch,
    attribution: "",
  });

const story = (c: LandingContent) =>
  node("SiteStory", "website-story", {
    heading: c.words.sections.story.heading,
    hint: c.words.sections.story.hint,
    body: "",
    photo: "",
    photoAlt: "",
    /* ── 那四条承诺，也给这一段 ─────────────────────────────────────────
       老板 2026-08-30，看着 台账 对 Newel：「他们 About Us 底下还有一条
       「Our Benefits」四栏带,我们没有 … 没有就去加啊」.

       Newel 的第2段是「About Us」加底下一条深色的「Our Benefits」，四栏：
       Vast Experience · Professional Team · High Finish · Sustainable。
       我们那一段只有照片加一段字，底下什么都没有。

       内容不发明：用这个行业**已经在讲**的那四条承诺（保证 跟 四点两栏 用的
       是同一组）。哪一套风格要不要把它画成一条带，是形状层的事。 */
    points: c.words.sections.promiseList.marks.map((label) => ({ label })),
    bandHeading: c.words.sections.promiseList.heading,
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
      /* NO LABEL. It used to repeat `areas.heading` -- so the section rendered
         「Where we cover」 as its title and 「Where we cover」 again as the row's
         label, and the whole band came to 29 characters of which 24 were the
         same three words twice. Measured 2026-08-27 while looking for why six
         registers had an almost-empty section in the same place. Printing one
         fact twice on one page is what got 印 culled. */
      {
        label: "",
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
  /*
    A REVIEW IS NOT A SHELF ROW.

    This was `ShelfList`, whose shape is 「a title, a description, an action」 --
    the dashboard's list of jobs to follow up today. A review on a website has a
    rating, then the words, then a face, and it sits in a grid of three. Read
    off tailark/blocks/testimonials/three (MIT) on 2026-08-27. 口碑在这个市场
    就是全部生意, and it was being drawn as a to-do list.
  */
  node("SiteTestimonials", "website-reviews", {
    heading: c.words.sections.reviews.heading,
    items: c.words.sections.reviews.quotes.map((q) => ({ quote: q.text, who: q.who })),
  });

/*
  THE MIDDLE ASK.

  No template had one. Every reference does -- nobruf, tailark, and both
  Malaysian trade sites -- and the reason is plain: a visitor who has read the
  services, the prices and the reviews and still not pressed anything is at the
  point of deciding, and the next thing they meet is a FAQ. Asking once, in the
  middle, on its own ground, is the cheapest conversion on the page.

  It reuses the hero's own words rather than inventing a second voice.
*/
const cta = (c: LandingContent) => {
  const phone = c.contact.find((r) => r.icon === "phone");
  return node("SiteCta", "website-cta", {
    heading: c.words.sections.cta.heading,
    note: c.words.sections.cta.note,
    primaryLabel: c.words.whatsapp,
    primaryHref: "#website-form",
    secondaryLabel: phone && phone.placeholder !== true ? phone.value : undefined,
    secondaryHref: phone && phone.placeholder !== true ? `tel:${phone.value}` : undefined,
  });
};

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
/* 这三条是**这一页可能有的落点**，不是保证有的。
   有几套风格故意不放价目表跟询价（`site-composition` 的 `dropBlocks`），
   发布的时候还会再拿掉一次（每一行都是 `RM —` 的价目表 —— 任务 19）。
   指不到的那几条由 `pruneDeadAnchorsIn` 拿掉，产生跟发布两边各跑一次。 */
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
    /* 🔴 `#enquiry` **从来不存在**（2026-09-05 实测：那一页真的有的 id
       只有 `ask` 加四个表单栏位自动产生的编号）。而这颗是**整页唯一的
       转换按钮** —— 它从写出来那天起按下去什么都不会发生。
       询价那一块的 id 是 `website-form`；连那一块也被拿掉的时候，
       `pruneDeadAnchorsIn` 会把整颗按钮拿掉。 */
    actionHref: phone && phone.placeholder !== true ? `tel:${phone.value}` : "#website-form",
  });
};

const foot = (c: LandingContent, links: { label: string; href: string }[]) => {
  const phone = c.contact.find((r) => r.icon === "phone");
  return node("SiteFoot", "website-foot", {
    brand: c.brand,
    tagline: c.eyebrow,
    /* THE SAME LINKS THE 顶栏 CARRIES and the same ask the hero opens with --
       the identical arguments, so the bottom of the page can never point
       somewhere the top does not. The reference closes on exactly this: a
       large nav and one button. */
    links,
    askLabel: c.words.askShort,
    askHref: phone && phone.placeholder !== true ? `tel:${phone.value}` : "#website-form",
    // The same rows the contact section carries, and the same placeholder flag
    // -- a foot that prints 「WhatsApp 012-345 6789」 is the exact failure this
    // module was built to stop, one screen further down.
    rows: c.contact.map((r) => ({ label: r.label, value: r.value, placeholder: r.placeholder })),
    /* 社交 ships empty and labelled rather than seeded: a Facebook link we
       invented goes to somebody else's page, which is the same failure as a
       seeded phone number. The editor shows the field; the page shows nothing
       until the owner pastes theirs. */
    small: [],
    /* THE ONE LINE THAT IS TRUE ON EVERY PAGE. Their foot pads this row with a
       San Francisco address and 「Powered and secured by Wix」; we take the half
       that says something. */
    copyright: `© ${new Date().getFullYear()} ${c.brand}`,
  });
};

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

/*
  别人给的证明 — 执照、代理的牌子、Google 打的分。

  Taken from the one section kind the landing kits all have and this product
  had no block for (npm run shoot:kits, 2026-08-27: a logo wall on tailark,
  magicui and framer twice), rebuilt as what THIS market shows instead --
  「JKKP-Certified Technicians」, an authorised-dealer badge, a Google score.

  IT SHIPS EMPTY AND THAT IS THE POINT. Every field is a claim about the world;
  inventing one would be inventing a certification. `placeholder: true` on all
  of them keeps the whole section off the published page until the owner types
  something real -- the same wire the phone number and the price rows use.
*/
const creds = (c: LandingContent) =>
  node("SiteCreds", "website-creds", {
    heading: c.words.sections.creds.heading,
    hint: c.words.sections.creds.hint,
    rating: { ...c.words.sections.creds.rating, placeholder: true },
    items: c.words.sections.creds.items.map((i) => ({ ...i, placeholder: true })),
  });

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
    /* 服务 MOVED TO 明码标价 on 2026-09-02, and this is the measurement rather
       than a preference: of the nineteen Malaysian SME sites in
       docs/market-references.json, FIVE are the published-price shape and all
       five are services -- aircond, repairs, batteries, glass. Three of them
       put the price in the address bar. A contractor surveys before quoting; a
       man who comes to recharge your aircond has a number. */
    trades: ["renovation", "other"],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "quote"),
      statement(c),
      services(c, sect(c, "quote").services),
      work(c),
      story(c),
      team(c),
      prices(c),
      flow(c, sect(c, "quote").flow ?? ""),
      reviews(c),
      creds(c),
      band(c),
      woven(c),
      cta(c),
      areas(c),
      faq(c),
      promiseList(c),
      form(c, "quote"),
      contact(c),
      foot(c, anchors(c)),
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
      statement(c),
      services(c, sect(c, "booking").services),
      // Numbered, not arrows: someone booking a slot is reading "what do I do
      // first", which is a list of steps rather than a pipeline.
      flow(c, sect(c, "booking").flow ?? ""),
      work(c),
      story(c),
      team(c),
      prices(c),
      reviews(c),
      creds(c),
      band(c),
      woven(c),
      cta(c),
      hours(c),
      faq(c),
      form(c, "booking"),
      contact(c),
      foot(c, anchors(c)),
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
      statement(c),
      services(c, sect(c, "order").services),
      work(c),
      story(c),
      team(c),
      prices(c),
      hours(c),
      areas(c),
      reviews(c),
      creds(c),
      band(c),
      woven(c),
      cta(c),
      form(c, "order"),
      contact(c, false),
      foot(c, anchors(c)),
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
      statement(c),
      services(c, sect(c, "wholesale").services),
      /* 作品墙 —— 批发这一套本来没有，而它是唯一一套没有的。
         Founder, 2026-08-28: 「要嘛你就是去图库拿图 要嘛只是一个占位图 都可以」.
         中台's reference (Kurofude) carries EIGHTEEN photographs and 5259px;
         ours came out with two and 3594px, and the whole difference was that
         this template never built a gallery, so the register's skeleton listed
         a section that did not exist. A wholesaler has a warehouse and stock —
         there was never a reason for this to be the one trade with nothing to
         show. */
      work(c),
      story(c),
      /* 满边一条照片带 —— Kurofude's second and fourth sections are exactly this,
         1007px tall, and it was the other block this template never built. */
      band(c),
      /* 四点两栏配照片 —— Kurofude 第5段 RESERVE 就是这个形状：左右各一张照片，
         中间那一栏自己一个地，照片、一句话、一条黑色的横按钮，再一张照片。
         骨架里点了它，而这个行业的模版从来没有造过这一块 —— 这个仓库
         「点了一个不存在的区段」第二次，上一次是这上面那个作品墙。 */
      woven(c),
      team(c),
      flow(c, sect(c, "wholesale").flow ?? ""),
      prices(c),
      areas(c),
      creds(c),
      promiseList(c),
      faq(c),
      form(c, "wholesale"),
      contact(c),
      foot(c, anchors(c)),
      ...floating(c),
    ],
  },
  {
    /* ── 明码标价 ───────────────────────────────────────────────────────
       THE SEVENTH, AND IT IS A DIFFERENT CONVERSATION -- NOT A DIFFERENT LOOK.

       「上门报价」 says: ask, I come and look, then I quote.
       This one says the opposite: the price is already public, and there is no
       surprise. A customer choosing between them is choosing how he sells, not
       which colours he likes.

       ── WHERE IT COMES FROM ──────────────────────────────────────────────
       Five of the nineteen Malaysian SME sites photographed for 任务 26 are
       this page and nothing else: ACService.my, AircondCare, ACFix,
       TukarBateri, Doktor Cermin. Three of them put it in the URL
       (`/aircond-service-price/`). Looked at side by side, all four of the
       phone shots share the same spine:

         · a black strip at the very top carrying 「Call Now」 and the number
         · a first screen whose headline is about the PRICE, not the trade
         · immediately under it, a list of guarantees -- no hidden fees,
           30-day warranty, free on-site quote, JKKP-certified
         · two buttons: WhatsApp, and a free quote

       ⚠️ IT REFINES 任务 26's OWN READING. That task recorded 「0/19 价钱在第
       一屏」 and it is right -- the NUMBERS are further down. What is on the
       first screen is the PROMISE about the numbers. Those are different
       things, and building the template on the first reading would have put a
       price list where a promise belongs.

       ── WHAT MAKES IT A DIFFERENT SKELETON ───────────────────────────────
       The price list is SECOND, and the guarantees are THIRD. On 上门报价 the
       prices sit eighth, after the story and the team, because there a price
       is the end of a conversation. Here it is the beginning of one, and
       everything above it exists to make it believable.

       No 作品墙, no 团队, no 满边照片: an aircond call-out is not chosen by
       looking at photographs of the last one. Every section this page does not
       have is a section those five pages do not have either. */
    key: "tariff",
    label: "明码标价",
    blurb: "价钱先讲清楚，不用问。冷气、维修、换电池这一类，客人比的就是价钱跟有没有隐藏收费。",
    labelEn: "Published prices",
    blurbEn:
      "The price is on the page, no need to ask. Aircond, repairs, batteries — where people compare the rate and whether there are hidden charges.",
    trades: ["services"],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "pricelist"),
      /* The spine. Everything above it is the promise; everything below is the
         evidence for it. */
      prices(c),
      /* 保证 second, because 「no hidden fees」 is what a published price is
         worth nothing without -- and it is the line all five of them run. */
      promiseList(c),
      creds(c),
      services(c, sect(c, "tariff").services),
      flow(c, sect(c, "tariff").flow ?? ""),
      /* 覆盖范围 —— TukarBateri lists seven states on its first screen; a trade
         that publishes a price is asked 「do you come to me」 next. */
      areas(c),
      reviews(c),
      /* All four run a 「what affects the price」 section. On a page whose whole
         claim is that the price is honest, the questions ARE the argument. */
      faq(c),
      statement(c),
      cta(c),
      form(c, "tariff"),
      contact(c),
      foot(c, anchors(c)),
      ...floating(c),
    ],
  },
  {
    key: "portfolio",
    label: "先看东西",
    blurb: "客人是看了作品才决定的。设计、摄影、装修都可以用这个。",
    labelEn: "Work first",
    blurbEn: "They decide after seeing what you have made. Design, photography, renovation.",
    /* GALLERY-ONLY, DELIBERATELY. Nothing in the questionnaire distinguishes a
       renovation contractor whose customers choose by photographs from one
       whose customers ask for a quote -- and the three furniture shops measured
       in 任务 90 are the only evidence for this shape in this market, which is
       not enough to make it anybody's opening page. It is one click away in
       模板库 for an owner who knows their own trade better than we do. */
    trades: [],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "grid"),
      statement(c),
      // Services first and unframed: on a page whose job is "look at this",
      // boxes around every section fight the looking.
      work(c),
      story(c),
      team(c),
      services(c, sect(c, "portfolio").services, false),
      reviews(c),
      creds(c),
      band(c),
      woven(c),
      cta(c),
      flow(c, sect(c, "portfolio").flow ?? ""),
      faq(c),
      form(c, "portfolio"),
      contact(c, false),
      foot(c, anchors(c)),
      ...floating(c),
    ],
  },
  {
    key: "card",
    label: "一页名片",
    blurb: "最简单的一页：你是谁、做什么、怎么找你。没有表格。",
    labelEn: "One-page card",
    blurbEn: "The simplest page: who you are, what you do, how to reach you. No form.",
    /* GALLERY-ONLY, AND IT MUST STAY THAT WAY. This page has NO FORM, and the
       enquiry form is the one thing on a customer's website that produces a row
       in their system -- 官网 → 询价 → 报价单 is the arrow the monthly fee is
       sold on. Opening a business on a page that cannot be written to would
       remove the product's own reason to exist. Offered, never defaulted. */
    trades: [],
    build: (c) => [
      bar(c, anchors(c)),
      hero(c, "split", "card"),
      statement(c),
      services(c, sect(c, "card").services, false),
      story(c),
      team(c),
      hours(c),
      areas(c),
      reviews(c),
      creds(c),
      band(c),
      woven(c),
      cta(c),
      contact(c),
      foot(c, anchors(c)),
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

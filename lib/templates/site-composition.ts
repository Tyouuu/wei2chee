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
export const MOVABLE = [
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
  /* 一条满边的照片, 2026-08-27. Counted against Wix's two templates in this
     market: they run 6 and 14 photographs a page and two of theirs go edge to
     edge between sections; ours ran 2-5, every one inside the measure with a
     radius. A page whose pictures are all objects in a column reads as a
     document about a place. */
  "band",
  /* 四点两栏配照片, 2026-08-27. The largest section on Wix's Home Remodeling
     page (1068px of 4742) and the one we had no equivalent for: four claims in
     two columns with the PHOTOGRAPHS WOVEN AMONG THEM. Ours were quarantined
     into a gallery. See SiteWoven. */
  "woven",
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
  hero: "left" | "band" | "center" | "plain" | "split" | "stage" | "bleed" | "band-bleed" | "name-plate" | "plate-centre";
  /**
   * 一句话占一屏 —— whether the pitch gets a screen of its own, and in what
   * shape. Absent means it stays under the headline where it has always been.
   *
   * ── WHY AN AXIS AND NOT A MOVABLE SECTION ──────────────────────────────
   *
   * It was written as the thirteenth entry in MOVABLE first, and
   * site-composition.test.ts refused it inside a minute: `order` is a TOTAL
   * ordering, every register names every section, so presence in the list
   * cannot express 「this register does not have one」. The test was right and
   * the shape of the idea was wrong. Existence is the decision here, which is
   * what the other four axes on this type are for.
   *
   * Taken from lapa.ninja's real-business categories, 2026-08-27 -- of the
   * pages on .screenshots/lapa/real-business.jpg that were real work rather
   * than a Webflow banner, every one puts a quiet one-sentence band directly
   * under the first screen.
   */
  statement?: "centre" | "rule" | "quote";
  /**
   * 哪几段坐在自己的地上。
   *
   * ── THE MEASUREMENT THAT MADE THIS NECESSARY ────────────────────────────
   *
   * Our eight pages beside four Wix templates, whole pages at one scale
   * (.screenshots/motionreel/versus.jpg, 2026-08-27). Counted:
   *
   *   我们        1 ground per page, plus one coloured CTA band
   *   Wix 装修    yellow at the top, yellow again mid-page, yellow footer
   *   Wix 油漆    terracotta, mint, pink, cream -- four
   *   Wix 律师    cream, sage, terracotta, ochre -- four
   *
   * That is the difference the founder keeps pointing at and I kept answering
   * with more section SHAPES. A page with one ground reads as one long column
   * however the blocks inside it are arranged; a page with three or four reads
   * as chapters. It is also the same number my own OKLab pass turned up
   * earlier and I misread: 底色种类 我们 2, 他们 3-5.
   *
   * ── AND WHY IT COSTS ALMOST NOTHING ─────────────────────────────────────
   *
   * block-tone.ts has done this since 2026-08-25 -- four tones, a proper
   * two-layer token remap so a table's head and its hairlines follow the
   * ground instead of resolving against the page. puck-config-client already
   * reads `tone` off any block and paints it. Nothing ever WROTE that prop for
   * a website. Eleventh time in this repo that the capability was finished and
   * the wire was never connected.
   *
   * An empty map is a real answer, not a missing one: 瑞士's whole argument is
   * that a hairline and a measure are enough, and a register that paints bands
   * is not 瑞士 any more.
   */
  tones?: Partial<Record<SiteSection, "ink" | "tint" | "paper">>;
  /**
   * 这一套不带的区段。
   *
   * ── WHY THIS IS THE ONE THAT MATTERS ────────────────────────────────────
   *
   * Six registers were photographed as whole pages on 2026-08-27 and the
   * bottom half of all six was identical: 流程 → 你会得到什么 → 客户评价 →
   * 覆盖范围 → CTA → 表单, same sections, same shapes, same order. `order` is
   * a TOTAL ordering, so every register carried all thirteen sections and the
   * only thing a register could say was where they went.
   *
   * Twelve identical bands shuffled is not six designs. It is one design with
   * six sort orders, which is exactly what the founder kept seeing and calling
   * 「有点一样」 -- and 重点 7a says a register is 「用了哪些区块」 before it is
   * anything about paint.
   *
   * So a register may now decline a section outright, and what it declines is
   * an argument about it: 瑞士 is a document and a document has no photo wall;
   * 中台 is a counter screen and nobody reads a shop's life story at a counter;
   * 招牌 is read from the street and a street sign has no FAQ.
   *
   * ── WHY DROPPING IS SAFE HERE ───────────────────────────────────────────
   *
   * composeSite runs while the page is still being GENERATED -- the public
   * route reads the saved layout and 404s without one, so nothing here ever
   * touches a page the customer has saved. What is dropped is template
   * default, never their words. Once they save, the blocks are theirs and this
   * file never runs on them again.
   */
  omit?: SiteSection[];
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
  /**
   * 段落节奏 —— how much air sits between one section and the next.
   *
   * Measured 2026-08-27 against the page 満図 copies whole: eight sections
   * against eight, 5398px against 4178px. Every one of ours was shorter than
   * its opposite number, and the page read as cramped rather than as busy.
   *
   * A register axis rather than one larger number, because 中台's entire thesis
   * is that it is the densest page in the library and 工作室's is that nothing
   * is pressed against anything. See `--site-rhythm` in app/globals.css.
   */
  rhythm?: "flush" | "tight" | "normal" | "airy";
  /** 正文多大。Measured 2026-08-28: both references set their body copy at
   *  16-17px and both of ours inherited the WORKBENCH's 13-13.5px, because
   *  every register's text scale was tuned for a table with forty rows on it.
   *  A multiplier rather than a size — 中台's thesis is that it is the densest
   *  page in the library (重点 7c). See --site-copy in app/globals.css. */
  copy?: "large";
  /** 每一块要不要一个细框。台账's reference draws one around every block on the
   *  page; nothing else in the library does. See --site-frame. */
  frame?: "hairline";
  /**
   * 连固定那几块也丢掉 —— by block id, not by section name.
   *
   * ── WHY THIS EXISTS ────────────────────────────────────────────────────
   * `omit` only reaches the movable middle; the head and tail (top bar, hero,
   * enquiry form, contact rows, footer) are fixed by the trade's template and
   * were out of a register's reach entirely.
   *
   * 満図 clones a page that has EIGHT sections and no form on it, and ours ran
   * ten because our template appends one. I argued for keeping it — it is the
   * one block a customer can send money through — and the founder overruled it
   * twice: 「我只是觉得这个模版好看 叫你去clone起来作为一个design token」 and
   * 「我们现在都没有客户 你管那么多干嘛」. He is right about what this layer is
   * for: it is a design token set for him to choose from, not a live business
   * page. The form is still in the library and every other register keeps it.
   */
  dropBlocks?: string[];
  /**
   * 图跟字有多大 —— separate from the rhythm since 2026-08-27.
   *
   * 満図 wants air AND big pictures; 台账's reference wants 56px headings and a
   * 2198px photograph mosaic with the bands BUTTED TOGETHER. One axis could not
   * say both, and tying them would make every big-picture register airy whether
   * its reference was or not.
   */
  figure?: "normal" | "large" | "huge";
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
  /* Every section this register keeps is a fact that could go in a
     quotation. 一段话 and 师傅团队 are the two that could not. */
    /* ── COPIED WHOLE ─────────────────────────────────────────────────────

       Wix `wh-newel` (Newel Residential Remodeling), both pages read out of the
       DOM at 1440px on 2026-08-27:

           1100px  1img   full-bleed photograph, the name centred over it
           1030px  1img   About Us — half photo, half panel, then a benefits band
            832px  2img   Our Services — a RULED LIST beside a photograph
           2198px 10img   Recent Projects — a photograph mosaic, edge to edge
            523px  0img   Testimonials — three quotes in thin boxes
            491px  0img   Contact Us — half words, half form
            381px  0img   foot

       Seven sections, 6555px, fifteen photographs, headings 56px.
       Ours ran THIRTEEN sections, 4937px, eight photographs, headings 32px --
       twice as many arguments, each one half the size. That is what
       「完全不对」 looks like from the inside.

       台账 now carries FOUR movable sections against their four, in their
       order, and declines the other eleven.

       ⚠️ IT NO LONGER OPENS ON THE PRICE LIST, and that is a change of thesis
       made on evidence rather than on the reference alone: 任务 26 measured 19
       Malaysian trade sites still trading, and 0 OF 19 put prices on the first
       screen. What a contractor leads with is who they are and what they have
       built. The price list stays in the library; it stops being this
       register's opening. */
    /* ⚠️ 保证 renders through `MarkList`, which is the DASHBOARD's tick list --
       it came out on the website as a thin strip of green ticks where the
       reference has a four-cell band. Twelfth time a dashboard block reached a
       public page. 四点两栏 carries the same four commitments and has a `band`
       shape built for exactly this section, so 台账 takes that and declines
       保证. */
    omit: ["prices", "creds", "flow", "areas", "faq", "promise", "hours", "band", "cta", "team"],
    tones: {},
    /* 深色开场 —— their whole page is one dark ground with the bands butted
       against each other. Ours is 台账's OWN dark surface (its navigation
       colour), not theirs: 重点 7c means we take the structure and keep the
       identity. */
    ground: "ink",
    rhythm: "flush",
    figure: "huge",
    measure: "wide",
    copy: "large",
    frame: "hairline",
    hero: "plate-centre",
    opens: "作品",
    order: ["story", "woven", "services", "work", "reviews", "prices", "creds", "flow", "areas", "faq", "promise", "hours", "band", "cta", "team"],
  },
  // 炉: the salon, where the front desk IS the shop. What a stranger buys is
  // the look of the last customer who walked out, so the photographs lead and
  // the reviews come straight after them.
  hearth: {
    /* ── COPIED WHOLE ─────────────────────────────────────────────────────

       Founder, 2026-08-27: 「你要抄别人家的你就整套都抄」「抄完一个才抄另外一套」.
       Grafting one hero from Wix and one section rhythm from Polar onto our own
       thirteen-section page produced a chimera, and the chimera is why the
       colours and the rhythms kept fighting.

       Wix's `Home Remodeling Company (Professional)` page, measured in the
       browser on 2026-08-27:

           772px  1img   colour band + full-bleed photograph
           582px  0img   「Our Expertise」 — heading and three text items
           455px  1img   a filled panel beside a photograph
           479px  0img   「Our Specializations」 — heading and three cards
           683px  1img   a full-bleed band
          1068px  2img   「Why Choose Us?」 — the biggest section on the page
           289px  3img   reviews, three across
           365px  0img   footer

       Eight sections, 4742px, nine photographs. Ours ran to thirteen — longer
       and thinner at the same time.

       So 满图 now carries SIX movable sections against their six, in their
       order, and declines the other ten. It has no gallery, because THEY have
       no gallery: their photographs live inside the argument. That is the
       structural difference this whole day kept circling.

       This is one register copied end to end. The other five keep their own
       skeletons until each is done in turn. */
  /* 照片墙 carries this register, so the two sections that are lists of
     words go. A portfolio does not print its own terms and conditions. */
    /* 流程 comes back, because the reference's SECOND section is a heading and
       three text items -- 663px of it, the largest thing on their page after
       「Why Choose Us」 -- and we had nothing in that slot at all. Ours is the
       trade's own stages, which is true, and which is the single most
       persuasive section on the 19 Malaysian trade sites measured on 08-27. */
    omit: ["work", "story", "team", "prices", "faq", "promise", "areas", "hours", "creds"],
    /* 口碑 SITS ON THE PAGE, NOT ON A CARD. It was `paper`, which drew a white
       rectangle under the quotes; the page this register copies rules its
       reviews off the ground with a hairline and no box at all. A card there
       makes the reviews look like a widget somebody embedded. */
    tones: { story: "tint" },
    /* THE ONLY REGISTER THAT OPENS ON A PHOTOGRAPH AS ITS GROUND, and one is
       the right number.

       Its own line below already says 照片墙 -- this is the register whose
       argument IS the picture, and it goes to 美容, the trade that sells the
       result of the work by showing it. On the contact sheet of thirty-two
       award sites this shape is what separates the ones that look expensive
       from the ones that look like a template.

       It is not given to the other thirteen because 重点 7c is the rule that
       keeps this library worth having: if eight registers open on a bleed
       photo they are eight paint jobs again. A trade that wants its photo
       bigger has the `hero` axis, which is per-page and free. */
    /* 官网自己的地 —— see hearth.css. 「ink」 is the axis that lets a register
       state its website's whole palette; 満図's is LIGHT (#fefef2). */
    ground: "ink",
    hero: "band-bleed",
    opens: "照片墙",
    /* THEIR ORDER, MEASURED OUT OF THEIR DOM, NOT GUESSED:
         2  流程     heading + three text items, no cards, no pictures
         3  半块颜色  a filled panel beside a photograph
         4  服务     two headings and three dotted cards
         5  满边带    edge to edge
         6  四点两栏  the biggest section, pictures woven among the claims
         7  评价     three across, faces first
       Before this, 服务 sat at position 2 and everything after it was one slot
       out of step with the reference all the way down the page. */
    /* 段间贴住 —— 参考页量出来是 0/0/1/1，我们是 144。气挪进段内（--site-inner），
       所以页面不会因此缩短，但有底色的段会像他们一样连成一片。 */
    rhythm: "flush",
    figure: "large",
    copy: "large",
    /* 八段对八段。参考页没有表单，也没有一条联络资料的横列。 */
    dropBlocks: ["website-form", "website-contact"],
    /* 内容几乎贴边 —— measured at native size 2026-08-28: their heading sits
       32px from the page edge and ours sat at 87px, on every section down the
       page. Their content box is 1376 of 1440; ours was 1312 centred, which
       adds 64px of margin on each side before the 24px padding even starts. */
    measure: "wide",
    /* ── 顺序改了 2026-08-28，因为参考页第二段是服务不是流程 ──────────────
       A. Reynolds runs 「Our Expertise」 — five service cards — as its SECOND
       section and 「Our Specializations」 — three more — as its fourth. Ours
       opened with 「How to book」, a numbered list, in the slot their cards
       hold, and put the services two places further down. Same eight
       arguments, two of them in each other's seats. */
    order: ["services", "cta", "flow", "band", "woven", "reviews", "creds", "hours", "areas", "work", "story", "team", "prices", "faq", "promise"],
  },
  // 图纸: the neutral one. The most ordinary order there is -- what you do,
  // what it looks like, what happens next -- which is this register's point.
  blueprint: {
    /* ── COPIED WHOLE: Wix `wh-law-firm-2` (Parker & Brown) ─────────────────
       Read at 1440 on 2026-08-28. Eight sections, 7202px, cream ground, serif
       display, and one orange that only ever appears on a control with an
       arrow after it.

           912/1100  1img  full-bleed library photo, the NAME over it, then a
                           strip: founded-in left · what they do centre · an
                           orange call-to-action right
            929px    1img  Introducing — an eyebrow, one BIG serif paragraph
                           across the measure, then small text left and a team
                           photograph right
            943px    0img  Practice Areas — FOUR NUMBERED COLOUR BLOCKS,
                           01 green · 02 taupe · 03 orange · 04 khaki
            946px    3img  Meet Your Attorneys — three portraits
            891px    0img  a centred serif QUOTE and nothing else
            933px    1img  News — khaki panel left, photograph right
            548px    0img  dark footer

       Ours ran THIRTEEN sections including opening hours, a reply-time strip
       and two separate asks. */
    omit: ["prices", "flow", "promise", "faq", "areas", "hours", "band", "woven", "creds", "reviews"],
    statement: "quote",
    hero: "name-plate",
    opens: "Introducing",
    order: ["story", "services", "team", "work", "cta", "prices", "flow", "promise", "faq", "areas", "hours", "band", "woven", "creds", "reviews"],
  },
  // 中台: the wholesaler's register, the densest in the library. Its buyer is
  // another business, and a business asks for terms before it asks for a look:
  // price, then delivery, then what the arrangement actually is.
  counter: {
  /* NOBODY READS A SHOP'S LIFE STORY AT A COUNTER. This register is the
     dense one; what it keeps is what a buyer checks before ordering --
     what you stock, what it costs, where you deliver, how to reach you. */
    omit: ["story", "reviews", "faq"],
    tones: { promise: "paper" },
    measure: "wide",
    ground: "ink",
    hero: "plain",
    opens: "条件",
    order: ["prices", "promise", "creds", "areas", "services", "story", "flow", "faq", "work", "woven", "reviews", "team", "band", "cta", "hours"],
  },
  // 瑞士: black, white, one red, no cards. It is the register that prints, and
  // a page that reads like a document leads with words -- what we do, how it
  // works, what we promise. No photo wall; that would be the opposite register.
  swiss: {
    /* ── COPIED WHOLE: Wix `wh-leah` ─────────────────────────────────────────
       Read at 1440 on 2026-08-28. Seven sections, 5519px, and the identity is
       what it REFUSES: no fill on anything, every button an outlined pill, and
       a full-width hairline between one section and the next. Two bands break
       the white and they are the only colour on the page — one pale grey for
       the logo wall, one near-black carrying the posts and the testimonials.

           990px  1img  headline left · paragraph + pill right · wide photo under
          1001px  1img  About — heading, paragraph, pill, portrait right
           928px  3img  Programs — heading left + paragraph right, 3 photo cards
           515px  4img  As Seen On — PALE GREY band, four logo tiles
           611px  3img  Latest Posts — DARK band, three photos, titles on them
           998px  0img  Testimonials — DARK band, outlined quote boxes
           476px  0img  Newsletter — the ask, back on white

       Ours ran twelve sections at a narrow measure with a plain hero: the same
       library, none of that page. */
    /* ⚠️ `story` was in BOTH lists on the first pass — declined and ordered at
       the same time — so 「About」, their second section, never rendered. omit
       wins, silently. */
    omit: ["team", "prices", "flow", "promise", "faq", "areas", "hours", "band", "woven"],
    tones: { creds: "tint", work: "ink", reviews: "ink" },
    /* 第一屏是白的：标题在左，一段话跟一颗外框药丸在右，照片在下面，不是压在照片上。
       band-bleed 就是这个形状 —— 那条带的颜色现在是一根轴（--site-hero-band），
       瑞士把它设成自己的白。 */
    hero: "band-bleed",
    measure: "normal",
    /* 他们第一屏跟 About 之间没有别的东西，收尾也只有一个订阅框 —— 一个 ask，不是
       中段一个 CTA 再加一个表单。 */
    dropBlocks: ["website-statement", "website-cta"],
    opens: "About",
    order: ["story", "services", "creds", "work", "reviews", "cta", "team", "prices", "flow", "promise", "faq", "areas", "hours", "band", "woven"],
  },
  // 招牌: shophouse retail with a physical sign outside. The centred hero IS a
  // signboard. Then the two things somebody standing on the street needs:
  // when are you open, and where exactly are you.
  signboard: {
  /* READ FROM THE STREET, so it is the shortest page in the library. A
     shop sign does not answer frequently asked questions, walk you
     through a process, or introduce its staff -- it says who we are,
     what we sell, where we are, and come in. */
    omit: ["faq", "flow", "promise", "team"],
    tones: { prices: "ink", promise: "paper", areas: "tint" },
    pattern: "diamond",
    ground: "ink",
    hero: "name-plate",
    opens: "店名 + 找得到",
    order: ["hours", "areas", "services", "creds", "work", "story", "team", "prices", "woven", "reviews", "band", "cta", "faq", "flow", "promise"],
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
  const dropped = new Set<string>(skeleton.omit ?? []);
  const middle = nodes
    .slice(first, last + 1)
    .filter((n) => !dropped.has(sectionOf(n)));

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

  /* A register that clones a page with no form on it drops the form. Matched
     on the block's own id so it works wherever the template put it — head,
     middle or tail. */
  const cut = new Set<string>(skeleton.dropBlocks ?? []);
  const keep = (n: PuckNode) => !cut.has(String(n?.props?.id ?? ""));

  return [...head, ...ordered, ...tail]
    .filter(keep)
    .map((n) => heroFor(n, skeleton))
    .map((n) => statementFor(n, skeleton))
    .map((n) => tonedFor(n, skeleton));
}

/**
 * 一句话占一屏 —— the band, and the sentence it is or is not given.
 *
 * ── WHY THIS BLANKS RATHER THAN REMOVES ──────────────────────────────────
 *
 * The first version filtered the block out on the eleven registers that do not
 * want a band, and site-composition.test.ts failed on the next run with a
 * comment worth quoting: 「a register that DROPS a section would be a register
 * that deletes the owner's own prices or photographs」. That invariant is
 * worth more than the tidiness, so the block stays and its sentence moves.
 *
 * Exactly one of the two prints the pitch, always: `heroFor` clears the hero's
 * `sub` where a register asks for the band, and this clears the band's `body`
 * where it does not. Printing one fact twice on one page is what got 印 culled
 * on 2026-08-26.
 *
 * An empty band renders nothing, and it is deliberately given no 「fill me in」
 * prompt: on those eleven registers the sentence is not missing, it is on the
 * screen above.
 */
/**
 * The ground a section sits on, when its register asks for one.
 *
 * Written as a prop rather than a class because that is where the renderer
 * already looks: puck-config-client calls `toneLayers(merged.tone)` on every
 * block. So this is the missing half of a wire, not a new mechanism.
 *
 * It writes ONLY where the register names a section, and never `page` -- an
 * absent prop is how everything else in this system says 「follow the
 * register」, and writing "page" explicitly would take that answer away from a
 * customer who later moves the block.
 */
function tonedFor(node: PuckNode, skeleton: SiteSkeleton): PuckNode {
  const tone = skeleton.tones?.[sectionOf(node) as SiteSection];
  if (!tone) return node;
  return { ...node, props: { ...node.props, tone } };
}

function statementFor(node: PuckNode, skeleton: SiteSkeleton): PuckNode {
  if (idOf(node) !== "website-statement") return node;
  const props = { ...node.props };
  if (skeleton.statement) props.shape = skeleton.statement;
  else props.body = "";
  return { ...node, props };
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
  /* A register that gives the pitch its own screen takes it out of the first
     one. Not a duplicate, a move -- see the note in composeSite. */
  if (skeleton.statement) props.sub = "";
  return { ...node, props };
}

import type { ReactNode } from "react";
import { HeroFigure, type HeroFigureKind } from "./hero-figure";
import { TiltStage } from "./tilt-stage";

/*
  WHY EVERY <img> IN THIS FILE CARRIES fetchPriority="high" AND NONE CARRY
  loading="lazy".

  A hero photo is the largest thing a visitor waits for, so it is the paint the
  page gets judged by; lazy-loading it delays exactly that. Only one hero
  variant renders per page, so only one of these ever issues a request. The
  sections file does the opposite, for the opposite reason -- see the note at
  the top of site-sections.tsx.
*/
import { SystemMini } from "./system-mini";

/**
 * The first screen of the page a business's own CUSTOMERS see.
 *
 * Every other component in this system is read by the owner: a table of their
 * work, a ledger of their money. This one is read by a stranger deciding
 * whether to message a contractor they found on Facebook, and that changes the
 * rules rather than the styling.
 *
 * ONE CLAIM, ONE LINE, ONE ACTION. A landing page for a Malaysian SME is not a
 * brochure — the entire job is "say what you do and give me a way to ask".
 * Everything here serves that: the eyebrow places the business (地区 + 行业,
 * which is what people actually search), the headline is the claim, the line
 * under it is what they sell, and the two buttons are the only two things
 * anyone does — message now, or look first.
 *
 * WHATSAPP IS THE PRIMARY ACTION AND THAT IS NOT A STYLE CHOICE. In this market
 * a contact form that emails somewhere is a form nobody fills. The owner reads
 * WhatsApp; the customer already has it open. So the loud button is the one
 * that opens a chat, and the enquiry form below it exists for the case where
 * the business wants the answers written down (see enquiry-form.tsx, which is
 * the half that becomes a record in the system).
 *
 * FOUR SHAPES, PICKED BY EYE. The founder's standing objection to a dropdown
 * is that choosing 「置中」 from a list means imagining the result; 换款式 shows
 * the shapes. So the same words render four ways and every one of them only
 * changes appearance — nothing typed is ever dropped by switching, which is
 * what makes the row safe to click through. See variants.ts.
 */
/**
 * 这一屏，哪几格的字根本到不了画面上。
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Found by `eval:browser` on 2026-08-31, and it is the TWELFTH time in this
 * repository that the assistant has told a customer it changed something and
 * the page did not move:
 *
 *   ask      「把第一屏那句大标题改成「二十年装修经验」」
 *   reply    「第一屏的大标题改成「二十年装修经验」了。改了 1 处」
 *   canvas   byte-identical, before and after
 *
 * Three of this component's layouts open on the BUSINESS NAME — 「THE NAME, AND
 * NOTHING COMPETING WITH IT」 — and write it as `{brand || headline}`. `brand`
 * is always set, so on those three the headline has no slot at all. That is the
 * clone being faithful, not a bug: 招牌 and 満図 open on the name because their
 * references do. THE BUG IS OFFERING A FIELD THAT CANNOT LAND.
 *
 * ⚠️ `eyebrow` LOOKED like the same bug and was not, and the task file said so
 * wrongly for four days. It renders nothing BY DECISION (9e19ed6, 2026-08-27):
 * it read 「MALAYSIA · RENOVATION & FITOUT」 directly above a headline reading
 * 「Renovation & fitout in Kuala Lumpur」 — one fact twice on one screen, on
 * every register. The defect was that the panel kept offering a box for it and
 * the generator kept filling it; both are gone as of 2026-08-31. The prop stays
 * in the signature because saved layouts carry it.
 *
 * ── WHY IT IS A FUNCTION AND NOT A COMMENT ────────────────────────────────
 *
 * A note saying 「headline does not render here」 helps a reader of this file
 * and nobody else. The assistant needs it at request time, so that 「大标题」
 * is not on the list of things it may say it changed — and the customer needs
 * it as a refusal that names the field that WOULD work.
 *
 * ⚠️ Kept honest by rendering, not by trust: site-hero-fields.test.tsx renders
 * every layout with and without a picture and fails if this list and the actual
 * markup disagree. A hand-written fact outliving what it describes is the
 * mistake this repo has made six times.
 */
/**
 * Measured 2026-08-31 by rendering every layout with and without a picture and
 * looking for a sentinel in the markup. site-hero-fields.test.tsx does exactly
 * that on every run and fails if this table and the component disagree, so this
 * is written down but it is not trusted -- 「手写名单总是活得比它描述的东西久」
 * has cost this repo six bugs.
 *
 * Read it as: on THIS layout, these words never appear on the first screen.
 */
const OFF_THE_FIRST_SCREEN: Record<
  string,
  { bare: string[]; withPhoto: string[] }
> = {
  left: { bare: ["brand"], withPhoto: ["brand"] },
  "band-bleed": {
    bare: ["brand"],
    withPhoto: ["brand", "phoneLabel", "phoneNumber"],
  },
  "band-inset": {
    bare: ["brand"],
    withPhoto: ["brand", "phoneLabel", "phoneNumber", "strip", "primaryLabel"],
  },
  "data-columns": {
    bare: ["brand"],
    withPhoto: [
      "brand",
      "phoneLabel",
      "phoneNumber",
      "strip",
      "secondaryLabel",
    ],
  },
  // The three that open on the business NAME: `{brand || headline}`, and brand
  // is always filled. Note that brand and headline are exactly complementary --
  // whichever one is the display line, the other never appears.
  "name-plate": {
    bare: ["brand"],
    withPhoto: ["headline", "phoneLabel", "phoneNumber", "secondaryLabel"],
  },
  "plate-centre": {
    bare: ["brand"],
    withPhoto: [
      "headline",
      "phoneLabel",
      "phoneNumber",
      "strip",
      "primaryLabel",
      "secondaryLabel",
    ],
  },
  // The only one that drops the headline with no picture too.
  "name-figure": {
    bare: ["headline", "phoneLabel", "phoneNumber", "strip"],
    withPhoto: ["headline", "phoneLabel", "phoneNumber", "strip"],
  },
};

export function heroDeadFields(props: {
  layout?: string | null;
  photo?: string | null;
}): string[] {
  /* `eyebrow` is NOT in here, and that is the point: it is not offered at all
     any more. It was banned from the markup on 2026-08-27 and removed from the
     panel on 2026-08-31; a field nobody can type into does not need a rule
     saying it will not land. site-hero-fields.test.tsx holds the config to
     that. */
  const dead: string[] = [];
  const row = OFF_THE_FIRST_SCREEN[String(props.layout ?? "")];
  if (row) dead.push(...(props.photo?.trim() ? row.withPhoto : row.bare));
  return dead;
}

export function SiteHero({
  eyebrow,
  brand,
  headline,
  sub,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  proof,
  phone,
  priceRows,
  strip,
  layout = "left",
  figure,
  figureData,
  photo,
  photoAlt,
  systemPreview,
  ground = "page",
}: {
  /** Where and what, e.g. 「吉隆坡 · 住宅装修」. The line people search by. */
  eyebrow?: ReactNode;
  /** The business's own name. Only 名牌 prints it -- every other layout leaves
   *  the name to the navigation bar, which is where it belongs unless the name
   *  IS the first screen. */
  brand?: string;
  /** ReactNode, not string, so the editor can make it editable in place. */
  headline: ReactNode;
  sub?: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /** Three short facts under the buttons — years in business, how fast they
   *  reply, where they cover. Numbers a stranger can check, not adjectives. */
  proof?: { value: string; label: string }[];
  /**
   *   left    左对齐 on the page's own ground. The default, and the one that
   *           reads as a working business rather than as a brochure.
   *   band    the whole opening on a filled band — the most "shopfront" of the
   *           four. A restaurant, a shop, anyone whose page IS the storefront.
   *   center  centred and narrow, for a business with one thing to say.
   *   plain   headline and one button. A name card.
   *   split   the words on the left and a FIGURE on the right. See below.
   */
  layout?:
    | "left"
    | "band"
    | "center"
    | "plain"
    | "split"
    | "stage"
    | "bleed"
    | "band-bleed"
    | "name-plate"
    | "plate-centre"
    | "name-figure"
    | "band-inset"
    | "data-columns";
  /**
   * WHAT GOES ON THE RIGHT, AND WHY THERE IS NOW A RIGHT AT ALL.
   *
   * The four original 款式 were four alignments of one column. Measured across
   * the six 官网版面 there was no second column and no figure on any of them,
   * which is most of what 「太丑了」 was about — a 2026 landing page has
   * something on the right, and these had nothing on any side.
   *
   * The figure is the DOCUMENT this business sends: a quotation, a booking
   * slip, an order, a price list. Built from data the page already carries and
   * drawn in the customer's own register and palette, so it costs no asset and
   * no second design language. See hero-figure.tsx.
   *
   * Absent (or on a layout that is not `split`) nothing renders, so every page
   * that existed before this prop is byte-identical.
   */
  /**
   * THE OWNER'S OWN PHOTOGRAPH, AND WHY IT OUTRANKS THE DRAWN FIGURE.
   *
   * Measured 2026-08-27 across 19 trading Malaysian SME sites: 14 of them give
   * the first screen to a photograph, and the median one covers 59% of it. Not
   * a stock photograph -- the two local sites in that sample show their own
   * technicians in their own uniforms, and the dental one puts a picture of its
   * physical signboard on the page to prove the shop exists.
   *
   * So when there is a photo it takes the second column and the drawn figure
   * steps aside. When there is not, the drawn figure stays -- it is a designed
   * object built from this business's own services and stages, which is a far
   * better first screen than a grey box, and better than somebody else's
   * kitchen. See docs/founder-tasks.md task 21 for why stock is never the
   * default here.
   */
  photo?: string;
  photoAlt?: string;
  /** The customer's OWN dashboard, as a layout, rendered small. The dense,
   *  real object every reference puts on its first screen -- see
   *  buildWebsite in lib/templates/industry-template.ts for why it is this and
   *  not a fuller drawing. */
  systemPreview?: unknown;
  /**
   * 开场的地 —— what the first screen is painted on.
   *
   * ── THE MEASUREMENT THAT MADE THIS AN AXIS ─────────────────────────────
   * Every pixel of a 1440px screenshot converted to OKLab, 2026-08-27:
   *
   *                  darkest L*   contrast span   coloured area
   *     ours            0.69          0.31             1%
   *     linear          0.11          0.55             0%
   *     launch-ui       0.13          0.55            18%
   *     stripe          0.60          0.40            27%
   *     framer          0.00          0.98            37%
   *
   * There was nothing dark on our page and nothing saturated either. Every
   * reference does one or the other, and 「感觉是配色的问题」 is what the
   * absence of both looks like.
   *
   * ── WHY nav-bg AND NOT A NEW DARK ──────────────────────────────────────
   * Each register already declares a committed dark surface with a
   * contrast-checked foreground -- its sidebar. 台账 deep navy, 瓷 charcoal
   * brown, 中台 #001529, 漆 oxblood. The website has no sidebar, which is
   * exactly why it had no dark. This is not a new colour decision; it is
   * fourteen that were already made and never used here.
   *
   * ── WHY THE REGISTER CHOOSES AND NOT THE OWNER ─────────────────────────
   * 重点 7c. A dark opening is right for 中台, 码, 粗野, 瓷 and wrong for 瑞士,
   * whose whole argument is a printed sheet. Offering it as a free choice is
   * how fourteen registers become one.
   */
  ground?: "page" | "ink";
  figure?: HeroFigureKind;
  /**
   * THE PHONE NUMBER, PRINTED.
   *
   * ── WHAT THE MARKET ACTUALLY DOES ────────────────────────────────────
   *
   * Two real Malaysian SME sites were photographed on 2026-08-26 (an aircon
   * service and a dental clinic, `.screenshots/landing/`) because the founder's
   * rule is 一切以市场为准. Both open the same way, and neither of them opens
   * the way we did:
   *
   *   a thin bar across the top with the opening hours
   *   the prices, in the first screen, as numbers
   *   NO HIDDEN CHARGE · SAME DAY SERVICE
   *   「Call Now 016-800 1631」 — the NUMBER, set large, not a button that says
   *   「contact us」
   *   a photograph of the crew in uniform
   *   a floating WhatsApp button bottom-right
   *
   * We had a headline, a button reading 「Ask on WhatsApp」, and three grey
   * boxes reading 「Add a photo」.
   *
   * The number is the difference that matters most. A button hides it; a
   * printed number is read, remembered, and dialled from a phone that is
   * already in the visitor's hand. Every shop sign in the country prints it.
   *
   * ── AND IT IS NEVER A PLACEHOLDER ────────────────────────────────────
   *
   * `012-345 6789` must not reach a published page: a stranger will call it.
   * That is not a design rule, it is the rule this whole module already runs on
   * -- 编辑器负责催，公开的页面永远不出现「催」 -- and it is enforced one layer
   * up, in publish-projection.ts, not here.
   */
  phone?: { label?: string; number: string; href?: string };
  /**
   * PRICES, IN THE FIRST SCREEN.
   *
   * 「GENERAL SERVICE — RM 60」 and 「CHEMICAL CLEANING — RM 130」 are the two
   * biggest things on the aircon company's page, above everything except their
   * own promo headline. That is not a design flourish, it is why the phone
   * rings: a homeowner comparing three contractors is comparing numbers, and a
   * page that makes them ask has already lost to the one that did not.
   *
   * Ours had the same rows five screens down under 「What it costs」, each one
   * reading 「RM —」.
   *
   * A row with no price does not render at all. To a stranger 「RM —」 does not
   * say 「the owner has not filled this in」, it says 「this business will not
   * tell you what it costs」, which is worse than having no prices on the page.
   */
  priceRows?: { label: string; value: string }[];
  /**
   * One line above everything: when they are open, or what they promise.
   *
   * The black hours strip both local sites open with. Kept as a prop on the
   * hero rather than as its own block because it IS the top of the first
   * screen: a separate block could be dragged away from it, leaving a strip of
   * opening hours floating above a price list halfway down the page.
   */
  strip?: string;
  /** Passed through to the figure; see hero-figure.tsx. */
  figureData?: {
    /** The business's own name, as a STRING.
     *  `headline` cannot be used: inside the editor it arrives wrapped in an
     *  <Inline> node so the owner can type into it, and `typeof headline ===
     *  "string"` is false there -- the figure would draw a blank name on every
     *  screen the owner actually looks at while building the page. */
    brand?: string;
    services?: { label: string; value: string }[];
    stages?: string[];
    landsIn?: string;
    /** One honest line at the foot of the sheet. */
    note?: string;
    askLabel?: string;
    sampleLabel?: string;
  };
}) {
  /*
    舞台 —— THE SHAPE TWELVE CURRENT LANDING PAGES USE AND WE DID NOT.

    Photographed on 2026-08-27: arc, clerk, cursor, dub, framer, linear, polar,
    raycast, resend, rive, spline, vercel. Ten of the twelve open the same way,
    and it is not the way we did:

      · the headline is SHORT and says what you DO, not who you are
        (「Turn clicks into revenue」, 「Email for developers」)
      · the company NAME is in the top bar. Twelve out of twelve. None of them
        makes it the headline, which is exactly what ours did
      · one supporting line, not three
      · two small quiet buttons
      · then THE THING ITSELF -- full width, centred, running off the bottom of
        the screen rather than sitting politely beside the words

    That last one is the difference a picture shows and a measurement does not.
    Ours put the figure BESIDE the text at half width, so the first screen was
    half words and half a small card. Theirs give the whole lower half to the
    object and let it bleed, which is what makes the page feel like it has
    something in it.

    For a contractor the object is not a product screenshot -- it is their
    work. Same shape, their photograph.
  */
  const stage = layout === "stage";
  /*
    照片当地，字压在上面。

    ── WHY THIS SHAPE EXISTS, AND WHY IT DID NOT UNTIL NOW ──────────────────

    Thirty-two motion-award sites were photographed on 2026-08-27 and laid out
    as one contact sheet, and the shape every one of the GOOD-looking ones
    shares is this: a full-bleed photograph as the ground with the type on it.
    Diamond Rose, Fame Estate, ON.energy, OceanX, Frequency Breathwork, Studio
    X -- photo behind, not beside.

    The embarrassing part is that the note eighty lines above this one already
    said so: 「the median one covers 59% of it」, measured off nineteen trading
    Malaysian SME sites. A second column is not 59%. The measurement was right,
    was written down, and then the implementation put the photo in a column
    anyway -- a fact recorded next to code that outlived the code agreeing with
    it, which is now the sixth time in this repo.

    ── AND WHY IT CARRIES ITS OWN GROUND RATHER THAN THE REGISTER'S ─────────

    Type on a photograph has no guaranteed contrast: the photo decides, and the
    owner picks the photo. So this layout does not use the register's nav
    colour the way `ground="ink"` does. It lays a scrim of its own and pins the
    surface tokens to white-on-near-black, which is the one combination that
    survives whatever they upload. 招牌's red hero printed a phone number in
    red on red; a photo can do worse and there is no token to blame.
  */
  const bleed = layout === "bleed";
  const centred = layout === "center";
  const band = layout === "band";
  const plain = layout === "plain";

  /*
    ── 标题两个色调 ────────────────────────────────────────────────────────

    Founder, 2026-08-27: 「我不要抄这些比较旧的 给我抄新一点的」. The Wix templates
    are a 2023 house style; this is the current wave, shot the same day
    (.screenshots/saas/current.jpg — Linear, Lovable, Framer, Attio, Polar,
    Vercel).

    Three of the six open on a headline in TWO TONES: the first line solid, the
    rest dimmed.

      Polar    「Meet Polar」 solid · 「The billing stack for the intelligence
               era」 dimmed
      Vercel   「Agentic」 solid · 「Infrastructure」 dimmed
      Attio    the same move on its second line

    It costs one split and it is the cheapest thing on this list that reads as
    2026 rather than 2023: the headline stops being one block of type and
    becomes a sentence with a subject and a predicate.

    Split on the first line break the copy already has, so nothing new is
    written and a headline with no break simply stays solid.
  */
  const headlineParts = (() => {
    const t = typeof headline === "string" ? headline.trim() : "";
    if (!t) return null;
    const i = t.search(/[\n]|(?<=\S)\s+(?=(in|for|that|with|across|to)\b)/i);
    if (i < 0) return null;
    return [t.slice(0, i).trim(), t.slice(i).trim()];
  })();
  /* A PLAIN OPENING IS NOT A REASON TO BIN THE PHOTOGRAPH.

     Measured on the live page, 2026-08-27: 瑞士 and 中台 open on `plain`, both
     had the owner's photograph in their props, and both rendered zero images.
     The prop reached the page and the layout ignored it -- so an owner who
     uploads a photo of his own finished kitchen sees it on four registers out
     of six and cannot tell why.

     Of the 19 trading Malaysian SME sites photographed on 2026-08-27, 14 give
     the first screen to a photograph and the median one covers 59% of it. None
     of them is a name card.

     It is NOT the stage and NOT the bleed: the picture sits under the words at
     the page's own measure, framed, ending where the text ends. 瑞士 is a
     document, and a document can carry a plate -- it just does not let it run
     off the edge. */
  const plainPhoto = plain && Boolean(photo?.trim());
  const hasPhoto = Boolean(photo?.trim());
  /* TWO LAYERS, NOT ONE -- see block-tone.ts. Writing
     `--color-paper: var(--color-nav-fg)` beside `--color-nav-fg` is safe, but
     anything that reads a token it also rewrites is a CSS cycle and CSS drops
     every declaration in one, silently. Capturing first is the habit that
     keeps that impossible. */
  /*
    THE DARK IS NEAR-NEUTRAL, AND THAT IS MEASURED.

    Ten mature landing pages, dominant ground colour, 2026-08-27: five are
    #080808 and five are #f8f8f8, and the chroma of that ground is 0.000 on
    every one of them. Our own registers' navigation colours run 0.041 to
    0.076 -- 圖纸 and 瑞士 #142744 at 0.060, 中台 #001529 at 0.050 -- which is
    right for a 240px sidebar and too much for a whole first screen.

    So the ground keeps 32% of the register's own hue and takes the rest from
    a neutral of the same darkness. 台账 stays recognisably navy-black, 瓷 stays
    warm-black, and neither is a coloured panel. That is exactly the difference
    between linear's #080808 and framer's #080818.
  */
  /* A bleed hero with no photograph is just a dark hero, which is a shape the
     library already has -- so it degrades to the register's own ground rather
     than painting a black rectangle for a picture that is not there. Same
     defensive rule `split` learned when a register asked for two columns on a
     template with no drawn figure. */
  const bled = bleed && hasPhoto;

  const groundStyle = bled
    ? ({
        /* NOT the register's nav colour. The scrim is what has to be
             trusted, and a scrim tinted 32% toward 招牌's red would put warm
             grey text on a warm grey photograph. */
        "--tone-bg": "#101215",
        "--tone-fg": "#ffffff",
        "--tone-fg-dim": "rgb(255 255 255 / 0.76)",
        "--tone-line": "rgb(255 255 255 / 0.22)",
      } as React.CSSProperties)
    : ground === "ink"
      ? ({
          /* 🔴 从 `--ink-*` 拿，**不要在这里再兑一次**（2026-09-07）。

             这四行本来是自己从 `--color-nav-*` 兑出来的，而
             `.ds-ground[data-ground="ink"]` 早就算过同一件事 ——
             **同一个问题两个答案，而它们已经分家了。**

             那一边算的时候会先看这一套风格自己替**官网**宣告的地
             （`--site-ink-bg` / `--site-ink-fg`，2026-08-28 为了整套抄模版
             加的）；这一边没有，所以它退回侧栏的颜色。而侧栏是**工作台**的，
             跟官网那一层没有关系：

               图纸 侧栏是白底深蓝字 → 这里兑出来是「深蓝的字压在一块深灰上」
                    量出来 **1.19:1**，而它就是第一屏那颗「Ask on WhatsApp」。
                    图纸 自己宣告的官网地是 #f0f0f0 配 #1b1b17，15.16:1。

             六套逐一量过，六套宣告的都是 9.58–19.51:1 的一对 ——
             也就是说**答案一直都在，只是这一段没有去问**。

             ⚠️ 跟 [任务 36](../../docs/founder-tasks.md#36) 记的是同一个形状：
             一个 tone 假设了底是浅的，套在深色上就给出一条浅色的东西。 */
          "--tone-bg": "var(--ink-bg)",
          "--tone-fg": "var(--ink-fg)",
          "--tone-fg-dim": "var(--ink-fg-dim)",
          "--tone-line": "color-mix(in oklab, var(--ink-fg) 16%, transparent)",
        } as React.CSSProperties)
      : undefined;
  const painted = ground !== "page" || bled;
  /* A photo is enough to earn the second column on its own. `figure` was the
     only thing that could before, which meant a register asking for the split
     layout on a template with no drawn figure quietly rendered as 左对齐. */
  const split = layout === "split" && (Boolean(figure) || hasPhoto);
  /* The stage shows its object too, but under the words rather than beside
     them, so it is not a `split` and must not build the two-column grid. */
  const staged = stage && (Boolean(figure) || hasPhoto);
  const showProof = !plain && proof && proof.length > 0;
  /*
    THE THREE FIGURES LEAVE THE WORDS ON 舞台.

    Counted side by side with linear, vercel and resend: their first screen
    holds THREE things -- headline, one line, the object. Ours held seven, and
    the last three were 10 years / 24 hours / Klang Valley stacked under the
    phone number. A first screen that is a list is a first screen a stranger
    skims instead of reads.

    They are not deleted. They move BELOW the object, which is where vercel
    puts its logo row: still on the first screen for anyone who scrolls a
    thumb, no longer competing with the headline.
  */
  const proofBelow = stage && showProof;

  /*
    TWO ELEMENTS, AND THE FOURTH TIME THIS REPO HAS LEARNED WHY.

    The first version put the capture and the apply on the SAME element:
    `--tone-bg: var(--color-primary)` beside `--color-primary: var(--tone-fg)`.
    That is a cycle -- --tone-bg reads a property that is being rewritten in
    the same declaration block -- and CSS silently discards every declaration
    in one. 招牌's hero came back white with black text: the red simply was
    not there, nothing threw, and the variables were all present in the DOM.

    block-tone.ts documents this exact failure and shipped the two-layer fix
    for it. Writing it once is not enough; it has to be the shape.
  */
  /*
    ── 色带 + 满边照片 ──────────────────────────────────────────────────────

    A DIRECT COPY, and that is the point. The founder, 2026-08-27: 「我给了那么多
    网站跟skills 你好像一点也没有去做参考跟借鉴 直接去抄啊」. He was right about
    what I had been doing -- counting their colours and their blocks and then
    adjusting our own components by a little. Measuring is not copying.

    So this is Wix's `Home Remodeling Company (Professional)` opening rebuilt in
    our tokens, read off .screenshots/stores/wix-top.jpg rather than remembered:

      1. a colour band edge to edge, and SHORT -- it hugs the headline instead
         of filling a screen
      2. the headline enormous and LEFT at about 60% of the width, the
         supporting line small and RIGHT, aligned to its top. Not stacked.
      3. a photograph directly beneath, edge to edge, NO radius and NO gap
      4. nothing else in the first screen: no eyebrow, no buttons, no figures.
         The one call to action is the button already sitting in the navigation.

    Point 4 is the one that took the longest to accept. Our first screen prints
    seven things and every register printed all seven; theirs prints two. That
    was measured on 2026-08-27 and then not acted on for several rounds.

    Nothing is deleted, it is MOVED: the buttons and the figures are still on
    the page, directly under the photograph, where a reader arrives having
    already seen what the business looks like.
  */
  /*
    ── 名牌 ────────────────────────────────────────────────────────────────

    A second direct copy, and deliberately from a DIFFERENT template than 满图
    took. Founder, 2026-08-27: 「我要每一套都是尽量的不同…你做不出的话 就直接抄
    别人的模版」.

    This is Wix's `Law Firm (Business)` opening, read off
    .screenshots/stores/law-top.jpg:

      1. a full-bleed photograph, and the BUSINESS NAME set enormous over it in
         the display face — two lines, left, white. There is no headline
         sentence at all: the name IS the first screen.
      2. a hairline all the way across the photograph
      3. under the rule, still on the photograph, a row of three: a small
         monospace fact on the left, one line of display type in the middle, a
         button on the right.

    It goes to 招牌 because that register's thesis has always been 「the name is
    readable from the street」, and this is the only layout in the library where
    the name is the largest thing on the page. 满图 keeps 色带压满图; the two
    are now copied from two different templates rather than being one shape
    twice.
  */
  if (layout === "plate-centre" && hasPhoto) {
    /*
      ── 满图置中名牌 ──────────────────────────────────────────────────────

      The first screen of the page 台账 clones (Wix `wh-newel`): a full-bleed
      photograph of the building, the company name CENTRED over it in a light
      serif across three lines, one quiet tagline under it, and NOTHING ELSE.
      No buttons, no figure strip, no eyebrow.

      Ours in the same slot was a left-aligned grotesk headline with two
      buttons and a row of three figures. Every one of those is defensible on
      its own -- 15 of the 19 Malaysian trade sites measured on 08-27 put
      WhatsApp on the first screen -- but together they are a different design,
      and the founder's word for it was 差很多. A contractor selling a
      RENOVATION is not selling a same-day callout: the first screen's job is
      to look like work worth paying for, and the ask is three sections down.
    */
    return (
      <section
        data-bleed=""
        data-photo-ground=""
        className="@container relative isolate"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          decoding="async"
          fetchPriority="high"
          src={photo}
          alt={photoAlt || ""}
          className="absolute inset-0 -z-20 block size-full object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0 -z-10 block"
          /* ── 遮罩要按最亮的照片来定，不是按参考图那张 ─────────────────────
             The reference opens on a dark timber building, so a light scrim
             reads. 台账 opens on WHATEVER PHOTOGRAPH THE OWNER PICKED, and the
             one the demo picked is a white kitchen in daylight: at 0.14 in the
             middle the white serif name was unreadable, which is the one thing
             the first screen cannot be. Measured against the brightest
             photograph in the picker, not against theirs. */
          style={{
            background:
              "linear-gradient(to bottom, rgb(0 0 0 / 0.52), rgb(0 0 0 / 0.42) 45%, rgb(0 0 0 / 0.62))",
          }}
        />
        <div className="flex flex-col items-center justify-center text-center [min-block-size:clamp(26rem,92svh,calc(46rem*var(--site-figure,1)))] [padding-block:calc(var(--pad-card-lg)*1.6)] [padding-inline:var(--pad-card-lg)]">
          <h1
            className="ds-display max-w-[16ch] [color:#fff] [font-weight:var(--fw-regular,400)] [letter-spacing:-0.01em] [line-height:1.06] [text-wrap:balance]"
            style={{
              fontSize:
                "clamp(2.6rem, calc(6.6vw * var(--site-hero-scale, 1)), calc(5.2rem * var(--site-hero-scale, 1)))",
            }}
          >
            {brand || headline}
          </h1>
          {sub ? (
            <p className="mt-6 max-w-[44ch] [color:rgb(255_255_255_/_0.86)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
              {sub}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (layout === "name-figure") {
    /*
      ── 底色上放一张照片，不是满版照片 ──────────────────────────────────────

      老板 2026-08-28, pointing at Toulouse's first screen: 「他是背景然后有照片的」.
      He is right and it is not a detail — it is the difference between a page
      that OWNS its colour and a page that borrows a photograph's.

      Measured off their screenshot at 1440:

          底              #500014 wine, the whole screen
          店名            ~263px, pink, letter-spaced wide, edge to edge
          手写体          three fragments overlapping the name's baseline
          照片            ~558 × 650, PORTRAIT, centred, floating on the wine
          左右            two links, each with a hairline running from the page
                          edge to the photograph

      Every other hero in this file puts the photograph BEHIND the words. This
      one puts the colour behind everything and the photograph in the middle of
      it, which is why their first screen reads as a poster and ours read as a
      stock photo with a caption.
    */
    return (
      <section
        data-bleed=""
        className="@container [background:var(--site-hero-band,var(--color-canvas))]"
      >
        <div className="[padding-block:calc(var(--pad-card-lg)*1.2)_0] [padding-inline:var(--pad-card-lg)]">
          <h1
            /* ⚠️ 大小写跟对齐是**风格自己的**，不是这个版式的。
               2026-08-31 把 招牌 第1段裁成原尺寸看：他们是「TOULOUSE」——
               **全大写、贴到两边（2%–98%）、笔画细**；我们是「My Shop」——
               首字母大写、居中、只占中间 60%。
               而 `小写多高 1.00`（x 的高等於 H 的高）正是「小写也画成大写」
               那一类标题体的签名 —— 26 套 Google 字量下来一套都到不了 1.00，
               因为那根本不是字体的事，是**大小写**的事。
               一块招牌上没有小写字母。 */
            className="ds-display [color:var(--color-primary)] [font-weight:var(--fw-regular,400)] [letter-spacing:0.01em] [line-height:0.92] [text-wrap:balance] [text-align:var(--site-name-align,center)] [text-transform:var(--site-name-case,none)]"
            style={{
              fontSize:
                "clamp(2.6rem, calc(9.2vw * var(--site-hero-scale, 1)), calc(7rem * var(--site-hero-scale, 1)))",
            }}
          >
            {brand || headline}
          </h1>
          {sub ? (
            <p className="mx-auto mt-2 max-w-[52ch] [color:color-mix(in_oklab,var(--color-primary)_82%,transparent)] [font-size:var(--text-lg)] [line-height:var(--leading-body)] [text-align:center]">
              {sub}
            </p>
          ) : null}

          {/* 左连结 —— 照片 —— 右连结，两条细线从页缘伸到照片。 */}
          <div className="mt-10 grid items-start [gap:var(--gap-stack)] @3xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)_minmax(0,1fr)]">
            <div className="[border-top:1px_solid_color-mix(in_oklab,var(--color-primary)_50%,transparent)] [padding-top:calc(var(--pad-card-lg)*0.6)]">
              {primaryLabel ? (
                <a
                  href={primaryHref || "#"}
                  className="[color:var(--color-primary)] [font-size:var(--text-sm)] underline"
                >
                  {primaryLabel}
                </a>
              ) : null}
            </div>
            {photo?.trim() ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo}
                alt={photoAlt || ""}
                className="block w-full object-cover"
                style={{
                  aspectRatio: "5 / 6",
                  maxHeight: "calc(42rem * var(--site-figure, 1))",
                  minHeight: "clamp(18rem, 58vh, 44rem)",
                }}
              />
            ) : (
              /* 占位图 —— 一张风格图要看得到它的形状，就算还没有照片。 */
              <div
                aria-hidden
                className="w-full [background:color-mix(in_oklab,var(--color-primary)_18%,var(--color-canvas))]"
                style={{
                  aspectRatio: "5 / 6",
                  maxHeight: "calc(42rem * var(--site-figure, 1))",
                  minHeight: "clamp(18rem, 58vh, 44rem)",
                }}
              />
            )}
            <div className="[border-top:1px_solid_color-mix(in_oklab,var(--color-primary)_50%,transparent)] [padding-top:calc(var(--pad-card-lg)*0.6)] [text-align:right]">
              {secondaryLabel ? (
                <a
                  href={secondaryHref || "#"}
                  className="[color:var(--color-primary)] [font-size:var(--text-sm)] underline"
                >
                  {secondaryLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "name-plate" && hasPhoto) {
    /* THE SLOT TAKES THE TRADE'S OWN FACT, not the same fact everywhere.

       Founder, 2026-08-27: 「你要想办法融入进去行业里面」. Copying a shape is half
       the job; the other half is what goes in it. The law-firm template puts
       「Founded in 1992」 here because that is what a firm's clients weigh. A
       SHOP is judged on whether it is open — 7 of the 19 trading Malaysian SME
       sites measured on 2026-08-27 run a top strip carrying exactly that — so
       when the page has opening hours, they win the slot. */
    const fact = strip?.trim()
      ? { value: strip.trim(), label: "" }
      : proof && proof.length > 0
        ? proof[0]
        : undefined;
    return (
      <section
        data-bleed=""
        data-photo-ground=""
        className="@container relative isolate"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          decoding="async"
          fetchPriority="high"
          src={photo}
          alt={photoAlt || ""}
          className="absolute inset-0 -z-20 block size-full object-cover"
        />
        <span
          aria-hidden
          className="absolute inset-0 -z-10 block"
          /* ⚠️ 遮罩轻一档。逐段量出来第 1 段：他们 #dcd2aa 的暖卡其，我们 #000000
             —— 同一个版式，我们那一屏黑掉了，因为这条渐层压在照片上。名字要读得到
             靠的是底部那 0.62，不是整片。 */
          style={{
            background:
              "linear-gradient(to top, rgb(0 0 0 / 0.60), rgb(0 0 0 / 0.06) 52%, rgb(0 0 0 / 0.12))",
          }}
        />

        <div className="flex flex-col justify-end [min-block-size:clamp(26rem,88svh,calc(44rem*var(--site-figure,1)))] [padding-inline:var(--pad-card-lg)] [padding-block:calc(var(--pad-card-lg)*1.4)]">
          <div className="mx-auto w-full max-w-[80rem]">
            {/* THE NAME, AND NOTHING COMPETING WITH IT.

                ⚠️ AN h1, NOT A p — changed 2026-08-28. The business name is the
                one heading on the first screen and it was marked up as a
                paragraph, so the page's h1 was a section heading further down.
                Two consequences, and the second is why it was found: a
                screen-reader user hears the page's title as 「Practice Areas」,
                and the ruler's TYPE axis reported 招牌's headline as 56px
                against their 263px while the 263px equivalent sat right here
                unmeasured. */}
            <h1
              className="ds-display [color:#fff] [font-weight:var(--fw-semibold)] [letter-spacing:-0.02em] [line-height:0.9] [text-wrap:balance]"
              style={{
                fontSize:
                  "clamp(2.8rem, calc(8.4vw * var(--site-hero-scale, 1)), calc(6.6rem * var(--site-hero-scale, 1)))",
              }}
            >
              {brand || headline}
            </h1>

            <hr className="mt-8 border-0 [background:rgb(255_255_255_/_0.42)] [block-size:1px]" />

            <div className="mt-6 grid items-center [gap:var(--gap-stack)] @3xl:grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,auto)]">
              {fact ? (
                <p className="[color:rgb(255_255_255_/_0.82)] [font-family:var(--font-numeric)] [font-size:var(--text-sm)] [letter-spacing:var(--tracking-label)]">
                  {fact.label ? `${fact.value} · ${fact.label}` : fact.value}
                </p>
              ) : (
                <span />
              )}
              {sub ? (
                <p
                  className="ds-display max-w-[26ch] [color:#fff] [font-weight:var(--fw-medium)] [line-height:1.15] @3xl:justify-self-center @3xl:text-center"
                  style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.75rem)" }}
                >
                  {sub}
                </p>
              ) : (
                <span />
              )}
              {primaryLabel ? (
                <a
                  href={primaryHref || "#"}
                  className="inline-flex min-h-12 items-center gap-3 [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)] @3xl:justify-self-end"
                >
                  {primaryLabel}
                  <span aria-hidden>&rarr;</span>
                </a>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ── 第一屏的字级是一根轴，而且四种版式都要读它 ────────────────────────────
     `--site-hero-scale` was added for 台账 and wired into ONE of the four hero
     layouts. Measured 2026-08-28, every register that uses a different one:

         招牌  他们 263px  我们 56px      TOULOUSE 横跨整页
         图纸  他们 158px  我们 32px      PARKER & BROWN
         中台  他们  56px  我们 83px      theirs is the SMALL one
         瑞士  他们  72px  我们 83px

     A declaration that only one branch reads is a declaration that is right in
     the token file and absent from the page — the shape this repo keeps
     finding. All four read it now, and the vw term scales with it so the
     name still fits its line at 1440. */
  if (layout === "band-inset" && hasPhoto) {
    /*
      ── 标题左 · 一段话跟一颗药丸在右 · 照片缩在版心里 ─────────────────────

      Leah Webb 第1段, 990px, 逐像素量於 2026-08-29:

        · 大标题 72px 细体靠左，左边留 99px
        · 右栏一段 17px 的字，底下一颗**描边药丸**
        · 照片**不是满边的** —— 它左右跟文字同一条边线（101 → 1337），
          而且上面空了一段气才开始

      band-bleed 是 満図 的第一屏：一条带，底下一张满边照片。三套风格共用它，
      而这三套的参考页第一屏根本不是同一个设计（重点 7a）。差的两件都在这里：
      那颗药丸从来没画过，照片一直是满边的。
    */
    return (
      <section data-bleed="" data-photo-ground="" className="@container">
        <div
          data-hero-band=""
          className="[padding-block:calc(var(--pad-card-lg)*1.6)] [padding-inline:var(--pad-card-lg)]"
        >
          <div className="mx-auto grid w-full max-w-[80rem] items-start [gap:var(--gap-stack)] @3xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <h1
              className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-regular,400)] [letter-spacing:-0.01em] [line-height:1.16] [text-wrap:balance]"
              style={{
                fontSize:
                  "clamp(2.4rem, calc(5.6vw * var(--site-hero-scale, 1)), calc(4.5rem * var(--site-hero-scale, 1)))",
              }}
            >
              {headline}
            </h1>
            <div>
              {sub ? (
                <p className="max-w-[34ch] [color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
                  {sub}
                </p>
              ) : null}
              {secondaryLabel || primaryLabel ? (
                <a
                  href={secondaryHref || primaryHref || "#"}
                  className="mt-8 inline-flex min-h-11 items-center justify-center [border:var(--hairline)_solid_var(--border-strong)] [border-radius:999px] [color:var(--color-paper)] [font-size:var(--text-sm)] [padding-inline:calc(var(--pad-control-x)*2.4)]"
                >
                  {secondaryLabel || primaryLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* 缩在版心里，不是满边的 —— 他们的照片跟文字同一条左右边线。 */}
        <div className="mx-auto w-full max-w-[80rem] [padding-inline:var(--pad-card-lg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            decoding="async"
            fetchPriority="high"
            src={photo}
            alt={photoAlt || ""}
            className="block w-full object-cover"
            style={{ aspectRatio: "16 / 9", maxHeight: "42rem" }}
          />
        </div>
      </section>
    );
  }

  if (layout === "data-columns" && hasPhoto) {
    /*
      ── 标题贴着页缘 · 一排带标签的资料栏 · 一条黑杠 · 然后满边照片 ─────────

      Kurofude 第1段, 955px, 逐像素量於 2026-08-29:

        · MODERN JAPANESE DINING 顶在页面**最左边，左边距是 0**，粗黑压缩体
        · 底下一排：两栏「标签在上、值在下」的资料
          （Open for Dinners: / Tue - Sat: 8am - 11pm · Address: / Phone Number:）
          最右边一条**方角的黑杠**「View Menu →」
        · 再来才是满边的照片

      我们原本是 band-bleed：标题有版心边距、副标在标题**右边**、那排资料在
      **照片下面**。顺序反了，而顺序是这一段的设计。
    */
    const cols = (proof ?? []).slice(0, 4);
    return (
      <section data-bleed="" data-photo-ground="" className="@container">
        <div
          data-hero-band=""
          className="[padding-block:calc(var(--pad-card-lg)*0.9)]"
        >
          <h1
            className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-bold,700)] [letter-spacing:-0.02em] [line-height:0.92]"
            style={{
              fontSize:
                "clamp(2.4rem, calc(6.4vw * var(--site-hero-scale, 1)), calc(5rem * var(--site-hero-scale, 1)))",
            }}
          >
            {headline}
          </h1>
          <div className="mt-8 flex flex-wrap items-end justify-between [gap:var(--gap-stack)]">
            <dl className="flex flex-wrap [gap:calc(var(--gap-stack)*2.4)]">
              {sub ? (
                <div className="max-w-[24ch]">
                  <dd className="[color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:1.45]">
                    {sub}
                  </dd>
                </div>
              ) : null}
              {cols.map((x) => (
                <div key={x.label}>
                  <dt className="[color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:1.45]">
                    {x.label}:
                  </dt>
                  <dd className="[color:var(--color-paper)] [font-size:var(--text-sm)] [line-height:1.45]">
                    {x.value}
                  </dd>
                </div>
              ))}
            </dl>
            {primaryLabel ? (
              /* 方角，不是药丸 —— 这一套整页没有一个圆角。 */
              <a
                href={primaryHref || "#"}
                className="inline-flex min-h-11 min-w-[13rem] items-center justify-between [background-color:var(--color-paper)] [color:var(--color-canvas)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [padding-inline:calc(var(--pad-control-x)*1.4)]"
              >
                <span>{primaryLabel}</span>
                <span aria-hidden>→</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          decoding="async"
          fetchPriority="high"
          src={photo}
          alt={photoAlt || ""}
          className="block w-full object-cover"
          style={{ aspectRatio: "16 / 9", maxHeight: "42rem" }}
        />
      </section>
    );
  }

  if (layout === "band-bleed" && hasPhoto) {
    return (
      <section data-bleed="" data-photo-ground="" className="@container">
        {/* THE BAND. Short on purpose -- `padding-block` is a little over one
            card's worth, not a screen's. */}
        {/* ── 开场那条带的颜色，是一根轴，不是色块的默认值 ────────────────
            A. Reynolds opens on a band THE SAME COLOUR AS THE PAGE with the
            photograph under it; the yellow appears twice, on one mid-page
            panel and on the footer, and that scarcity is what makes it read as
            an accent. Ours painted the opening band with --color-block, so the
            first thing on the page was the loudest colour on it. */}
        <div
          data-hero-band=""
          className="[padding-block:calc(var(--pad-card-lg)*1.15)] [padding-inline:var(--pad-card-lg)]"
        >
          <div className="mx-auto grid w-full max-w-[80rem] items-start [gap:var(--gap-stack)] @3xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <h1
              className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-bold,700)] [letter-spacing:-0.03em] [line-height:0.94] [text-wrap:balance]"
              style={{
                fontSize:
                  "clamp(2.6rem, calc(6.6vw * var(--site-hero-scale, 1)), calc(5.2rem * var(--site-hero-scale, 1)))",
              }}
            >
              {headlineParts ? (
                <>
                  {headlineParts[0]}{" "}
                  {/* The dimmed half. See `headlineParts` for the six sites
                      this is copied from. */}
                  <span className="[color:var(--color-paper-dim)]">
                    {headlineParts[1]}
                  </span>
                </>
              ) : (
                headline
              )}
            </h1>
            {sub ? (
              <p className="max-w-[34ch] [color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)] @3xl:mt-2">
                {sub}
              </p>
            ) : null}
          </div>
        </div>

        {/* EDGE TO EDGE, NO RADIUS, NO GAP. The photograph is the ground the
            band is sitting on, not an illustration inside a column. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          decoding="async"
          fetchPriority="high"
          src={photo}
          alt={photoAlt || ""}
          className="block w-full object-cover"
          style={{ aspectRatio: "16 / 9", maxHeight: "42rem" }}
        />

        {/* MOVED, NOT DELETED. Everything the first screen used to shout sits
            under the picture instead, at the page's own measure. */}
        {primaryLabel ||
        secondaryLabel ||
        (proof && proof.length > 0) ||
        strip ? (
          <div className="mx-auto w-full max-w-[68rem] [padding-block:calc(var(--pad-card-lg)*1.2)] [padding-inline:var(--pad-card-lg)]">
            {strip ? (
              <p className="mb-6 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [letter-spacing:var(--tracking-label)]">
                {strip}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center [gap:calc(var(--gap-stack)*1.6)]">
              {primaryLabel ? (
                <a
                  href={primaryHref || "#"}
                  className="inline-flex min-h-12 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
                >
                  {primaryLabel}
                </a>
              ) : null}
              {secondaryLabel ? (
                <a
                  href={secondaryHref || "#"}
                  className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] underline underline-offset-4"
                >
                  {secondaryLabel}
                </a>
              ) : null}
              {proof && proof.length > 0 ? (
                <dl className="flex flex-wrap [gap:calc(var(--gap-stack)*1.4)]">
                  {proof.map((x) => (
                    <div key={x.label}>
                      <dt className="[color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-base)] [font-variant-numeric:tabular-nums] [font-weight:var(--fw-semibold)]">
                        {x.value}
                      </dt>
                      <dd className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                        {x.label}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const shell = (
    <section
      /* The hero paints the page's ground and its hours strip runs edge to
         edge, so it opts out of `.ds-site`'s frame and applies the same measure
         to its own contents instead. */
      data-bleed=""
      /* The painted ground and, with it, the writing that has to sit on it.
         Re-pointing the surface family rather than colouring the section is
         the same move block-tone.ts makes, and for the same reason: a hero is
         a heading, a paragraph, two buttons, a phone number, an hours strip
         and three figures, and each of those reads a different token. */
      style={
        painted
          ? ({
              backgroundColor: "var(--tone-bg)",
              "--color-paper": "var(--tone-fg)",
              "--color-paper-dim": "var(--tone-fg-dim)",
              "--color-on-canvas": "var(--tone-fg)",
              "--color-on-canvas-dim": "var(--tone-fg-dim)",
              "--border-subtle": "var(--tone-line)",
              "--border-strong": "var(--tone-line)",
              "--color-ink-800": "var(--tone-line)",
              /*
                THE ACCENT INVERTS TOO, AND IT HAS TO.

                招牌's ground IS its primary, so the eyebrow, the price pills
                and -- worst -- the phone number were printed in the same red
                they sat on. Screenshotted 2026-08-27: 「CALL US」 followed by
                nothing at all, on the one register whose whole argument is
                that the name is readable from the street.
              */
              "--color-primary": "var(--tone-fg)",
              "--color-primary-deep": "var(--tone-fg)",
              "--color-on-primary": "var(--tone-bg)",
              "--color-primary-soft":
                "color-mix(in oklab, var(--tone-fg) 18%, transparent)",
            } as React.CSSProperties)
          : undefined
      }
      className={[
        // A CONTAINER, NOT A VIEWPORT.
        //
        // Measured on 2026-08-23: with a viewport breakpoint (`lg:`) the split
        // hero never collapsed inside the editor. Driving the canvas down to
        // 430px while the window stayed at 1440 left the grid at two columns
        // of 161px and 105px -- a headline about two characters wide. The
        // window was wide, so `lg:` fired, and the canvas is not the window.
        //
        // Every place this design system renders is narrower than the viewport:
        // Puck's canvas, the gallery specimens, the template preview, the
        // palette cards. A viewport breakpoint is wrong in all of them and
        // right only on the published page, which is the one place nobody was
        // looking while building.
        "@container",
        "[padding-inline:var(--pad-card-lg)]",
        band
          ? "[background-color:var(--color-primary-soft)] [border-bottom:var(--hairline)_solid_var(--color-ink-800)] [padding-block:calc(var(--pad-card-lg)*2.4)]"
          : "[padding-block:calc(var(--pad-card-lg)*2)]",
        centred || stage ? "text-center" : "",
        /* THE FIRST SCREEN OWNS THE SCREEN. Theirs ends where the fold does
           and the object runs off it; ours already showed the next section's
           heading, which is what made the opening feel like a paragraph rather
           than a screen. `svh` rather than `vh` so a phone's shrinking address
           bar does not leave a gap. */
        stage
          ? "[padding-block:calc(var(--pad-card-lg)*2.2)_0] flex flex-col justify-center @3xl:[min-block-size:94svh]"
          : "",
        /* The photograph is the first screen, so it gets the first screen.
           `isolate` keeps the scrim under the words and out of the page. */
        bled
          ? "relative isolate flex flex-col justify-end @3xl:[min-block-size:82svh]"
          : "",
      ].join(" ")}
    >
      {/* THE GROUND IS THE PHOTOGRAPH.

          Two layers, and both are needed. The image alone cannot be trusted --
          the owner uploads it, it can be a white-tiled bathroom, and white
          text on it disappears. The scrim alone is a dark rectangle. So: a
          flat 45% wash that guarantees the floor wherever the photo goes
          bright, plus a left-anchored gradient that deepens the side the
          words are actually on. Worst case behind the headline is a composite
          of #4b4b4b, which carries white at about 8:1; the right edge, where
          nothing is printed, holds 4.4:1 anyway.

          `object-cover` and no width prop: this is a background, and a
          background that letterboxes is a picture of a picture. */}
      {bled ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            decoding="async"
            fetchPriority="high"
            src={photo}
            alt={photoAlt || ""}
            className="absolute inset-0 -z-20 block size-full object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 -z-10 block"
            style={{
              background:
                "linear-gradient(to right, rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.06) 62%, transparent), rgb(0 0 0 / 0.45)",
            }}
          />
        </>
      ) : null}
      {/* THE HOURS STRIP. Full-bleed, because a strip that stops where the
          text column stops is a caption, and both sites this is taken from run
          it edge to edge. `-mx` undoes the section's own inline padding rather
          than the section giving it up, so nothing else on the page moves. */}
      {strip ? (
        <p
          data-hours-strip=""
          className="-mt-[calc(var(--pad-card-lg)*2)] mb-[calc(var(--pad-card-lg)*1.5)] [background-color:var(--color-paper)] [color:var(--color-canvas)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [letter-spacing:var(--tracking-label)] [margin-inline:calc(var(--pad-card-lg)*-1)] [padding-block:calc(var(--pad-control-y)*0.9)] [padding-inline:var(--pad-card-lg)] [text-align:center]"
        >
          {strip}
        </p>
      ) : null}

      {/* THE SAME MEASURE `.ds-site` gives every other block, applied here by
          hand because the hero opts out of it -- its ground and its strip need
          the full width, its words do not. */}
      <div className="mx-auto w-full max-w-[68rem]">
        {/* THE GRID EXISTS ONLY WHEN THERE IS A SECOND THING.
          `display: grid` with one child is not free -- it re-parents the whole
          opening and any max-width inside it starts resolving against a track
          rather than the section. Wrapping unconditionally is how a "harmless"
          layout prop changes five pages that never asked for it. */}
        <div
          className={
            split
              ? "grid items-center [gap:calc(var(--pad-card-lg)*1.5)] @3xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
              : "contents"
          }
        >
          <div className={split ? "min-w-0" : "contents"}>
            {/* The headline and the line under it want DIFFERENT measures: a headline
          reads best short, running text at about 46 characters. One container
          capped at the headline's width broke the sub mid-phrase
          (「报价前先上门 / 看」), which is the kind of thing only a render
          shows. */}
            <div className={centred ? "mx-auto max-w-[62ch]" : "max-w-[62ch]"}>
              {/* THE EYEBROW IS GONE, AND IT IS A BAN RATHER THAN A PREFERENCE.

            pbakaus/impeccable (Apache-2.0, installed at .claude/skills/impeccable
            on 2026-08-27) puts it under Refuse with the note 「This one is a ban,
            not a default: no brief earns it back. The heading carries its own
            weight; delete the label and let the heading speak.」

            And on this page it was worse than a habit, it was a repeat: the
            eyebrow read 「MALAYSIA · RENOVATION & FITOUT」 directly above a
            headline reading 「Renovation & fitout in Kuala Lumpur」. Same trade,
            same place, twice, on every register. Printing one fact twice on one
            page is what got 印 culled on 2026-08-26.

            The prop stays in the signature because saved customer layouts carry
            it; it simply renders nothing. */}
              <h1
                className={`ds-display ${centred ? "mx-auto " : ""}max-w-[24ch] text-balance [color:var(--color-paper)] [font-size:var(--text-hero)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)] [line-height:var(--leading-tight)]`}
              >
                {headline}
              </h1>
              {sub && (
                <p
                  className={`${centred ? "mx-auto " : ""}mt-4 max-w-[46ch] [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]`}
                >
                  {sub}
                </p>
              )}
            </div>

            {(primaryLabel || secondaryLabel) && (
              <div
                className={`mt-7 flex flex-wrap [gap:var(--gap-inline)] ${centred ? "justify-center" : ""}`}
              >
                {primaryLabel && (
                  <a
                    href={primaryHref || "#"}
                    className="inline-flex min-h-11 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-primary-deep)]"
                  >
                    {primaryLabel}
                  </a>
                )}
                {/* 名片 keeps one action. Two buttons is a page asking a stranger to
              make a choice before they have decided to talk to you at all. */}
                {secondaryLabel && !plain && (
                  <a
                    href={secondaryHref || "#"}
                    className="inline-flex min-h-11 items-center border [border-color:var(--color-ink-800)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.6)] [transition-duration:var(--dur)] [transition-property:background-color] hover:[background-color:var(--color-ink-850)]"
                  >
                    {secondaryLabel}
                  </a>
                )}
              </div>
            )}

            {/* The prices, between the words and the buttons -- read before the
          decision to press anything, which is the order the reference page
          puts them in. A row whose price is still blank is dropped here rather
          than filtered upstream, so a template that hands over three rows and
          two prices shows two. */}
            {priceRows && priceRows.some((r) => r.value?.trim()) ? (
              <ul
                className={`mt-7 flex flex-col [gap:var(--gap-inline)] ${
                  centred ? "mx-auto max-w-[42ch]" : "max-w-[42ch]"
                }`}
              >
                {priceRows
                  .filter((r) => r.value?.trim())
                  .map((r) => (
                    <li
                      key={r.label}
                      className="flex items-center justify-between [background-color:var(--card)] [border:var(--border-card-width)_solid_var(--border-subtle)] [border-radius:var(--radius-control)] [gap:var(--gap-inline)] [padding-block:var(--pad-control-y)] [padding-inline:var(--pad-control-x)]"
                    >
                      <span className="min-w-0 [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                        {r.label}
                      </span>
                      <span className="tnum shrink-0 [background-color:var(--color-primary)] [border-radius:var(--radius-pill)] [color:var(--color-on-primary)] [font-family:var(--font-numeric)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-block:2px] [padding-inline:calc(var(--pad-control-x)*0.8)]">
                        {r.value}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null}

            {/*
        THE NUMBER, SET LARGE, BESIDE THE BUTTON RATHER THAN INSTEAD OF IT.

        Beside: the button is for somebody on a laptop who would rather type
        than talk, the number is for somebody standing in their kitchen with a
        phone in their hand. Both local references carry both.

        `tel:` so a tap dials. The number keeps the owner's own spacing --
        「012-345 6789」 is how it is written on every van in the country, and
        normalising it to +60123456789 makes it read as a database field.
      */}
            {phone?.number ? (
              <a
                href={
                  phone.href || `tel:${phone.number.replace(/[^\d+]/g, "")}`
                }
                /* 🔴 **44 只给触控那一边**（2026-09-07）：量出来 33px，
             而这一颗按下去是**直接拨号** —— 它就是这一页要他做的那件事
             （[19 家同行实测](../../docs/founder-tasks.md#26)：15 家第一屏就给号码）。
             `items-baseline` 让两段字对齐基线，所以高度只有那一行字 ——
             `min-h-11` 把打得到的范围补回来，而字一个像素都不动。 */
                className={`mt-6 inline-flex min-h-11 flex-wrap items-baseline [gap:var(--gap-inline)] ${
                  centred ? "justify-center" : ""
                }`}
              >
                {phone.label ? (
                  <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
                    {phone.label}
                  </span>
                ) : null}
                <span className="tnum [color:var(--color-primary)] [font-family:var(--font-numeric)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
                  {phone.number}
                </span>
              </a>
            ) : null}

            {showProof && !proofBelow && (
              <dl
                className={`mt-9 flex flex-wrap [gap:calc(var(--gap-stack)*2)] ${centred ? "justify-center" : ""}`}
              >
                {proof.map((p) => (
                  <div key={p.label}>
                    <dt className="[color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-lg)] [font-variant-numeric:tabular-nums] [font-weight:var(--fw-semibold)]">
                      {p.value}
                    </dt>
                    <dd className="mt-0.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                      {p.label}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* The figure comes SECOND in the DOM and is moved right by the grid, so
          a phone reads the claim and the button before the picture -- which is
          the order a stranger needs, and the opposite of what a
          figure-first source would give them. */}
          {split && hasPhoto && (
            <TiltStage>
              <div className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- the src is a
              Supabase storage URL on a bucket Next's optimiser is not
              configured for, and a broken hero image is worse than an
              unoptimised one. */}
                <img
                  decoding="async"
                  fetchPriority="high"
                  src={photo}
                  alt={photoAlt || ""}
                  className="h-full max-h-[30rem] w-full object-cover [border-radius:var(--radius-lg)]"
                />
              </div>
            </TiltStage>
          )}

          {split && !hasPhoto && figure && (
            <TiltStage>
              <div className="min-w-0">
                <HeroFigure
                  kind={figure}
                  brand={
                    figureData?.brand ??
                    (typeof headline === "string" ? headline : "")
                  }
                  services={figureData?.services}
                  stages={figureData?.stages}
                  proof={proof}
                  landsIn={figureData?.landsIn}
                  note={figureData?.note}
                  askLabel={figureData?.askLabel}
                  sampleLabel={figureData?.sampleLabel}
                />
              </div>
            </TiltStage>
          )}
        </div>

        {/* THE OBJECT, UNDER THE WORDS AND RUNNING OFF THE BOTTOM.
          `max-height` at 46vh with the overflow visible is what makes it read
          as continuing below the fold instead of as a picture that happens to
          be large -- the property ten of the twelve references share and the
          one that cannot be measured off a stylesheet. */}
        {staged ? (
          <div className="mt-12 overflow-hidden [max-height:52vh]">
            <TiltStage>
              {/* WIDER THAN THE WORDS. Their object breathes to the edges of the
                screen while the sentence above it keeps a readable measure --
                one column for both is what made ours look boxed in. */}
              <div className="mx-auto w-full max-w-[78rem]">
                {hasPhoto ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    decoding="async"
                    fetchPriority="high"
                    src={photo}
                    alt={photoAlt || ""}
                    className="w-full object-cover [border-radius:var(--radius-lg)]"
                    style={{ aspectRatio: "16 / 10" }}
                  />
                ) : systemPreview ? (
                  <SystemMini data={systemPreview} />
                ) : figure ? (
                  <HeroFigure
                    kind={figure}
                    brand={
                      figureData?.brand ??
                      (typeof headline === "string" ? headline : "")
                    }
                    services={figureData?.services}
                    stages={figureData?.stages}
                    proof={proof}
                    landsIn={figureData?.landsIn}
                    note={figureData?.note}
                    askLabel={figureData?.askLabel}
                    sampleLabel={figureData?.sampleLabel}
                  />
                ) : null}
              </div>
            </TiltStage>
          </div>
        ) : null}

        {proofBelow ? (
          <dl className="mx-auto mt-10 flex w-full max-w-[68rem] flex-wrap justify-center [gap:calc(var(--gap-stack)*2.4)] [padding-bottom:var(--pad-card-lg)]">
            {proof!.map((p) => (
              <div key={p.label} className="text-center">
                <dt className="[color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-lg)] [font-variant-numeric:tabular-nums] [font-weight:var(--fw-semibold)]">
                  {p.value}
                </dt>
                <dd className="mt-0.5 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                  {p.label}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* THE PLAIN OPENING'S PHOTOGRAPH. Under the words, at the page's own
          measure, framed -- not bleeding off the bottom the way 舞台 does and
          not behind the type the way 满图 does. See `plainPhoto` above for the
          measurement that made it necessary. */}
        {plainPhoto ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            decoding="async"
            fetchPriority="high"
            src={photo}
            alt={photoAlt || ""}
            className="mx-auto mt-10 block aspect-[16/7] w-full max-w-[68rem] object-cover [border-radius:var(--radius-lg)]"
          />
        ) : null}
      </div>
    </section>
  );

  /* The capture layer. It only ever READS the register's own tokens, so it can
     never take part in a cycle with the layer that rewrites them. */
  /* `data-bleed` RIDES ON THE WRAPPER TOO. `.ds-site > * > *` gives every
     top-level block the page's 68rem measure and `[data-bleed]` is how a block
     opts out of it. Adding a layer without the attribute would have put the
     hero inside the measure and let it bleed only within that -- a full-width
     ground that stops 200px from each edge, which looks like a mistake and is
     one. See app/globals.css. */
  /* Rendered by `shell` below, at the end of the measured wrapper. */
  return painted ? (
    <div
      data-bleed=""
      data-photo-ground={bled ? "" : undefined}
      style={groundStyle}
    >
      {shell}
    </div>
  ) : (
    shell
  );
}

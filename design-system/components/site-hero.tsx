import type { ReactNode } from "react"
import { HeroFigure, type HeroFigureKind } from "./hero-figure"
import { TiltStage } from "./tilt-stage"
import { SystemMini } from "./system-mini"

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
export function SiteHero({
  eyebrow,
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
  eyebrow?: ReactNode
  /** ReactNode, not string, so the editor can make it editable in place. */
  headline: ReactNode
  sub?: ReactNode
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  /** Three short facts under the buttons — years in business, how fast they
   *  reply, where they cover. Numbers a stranger can check, not adjectives. */
  proof?: { value: string; label: string }[]
  /**
   *   left    左对齐 on the page's own ground. The default, and the one that
   *           reads as a working business rather than as a brochure.
   *   band    the whole opening on a filled band — the most "shopfront" of the
   *           four. A restaurant, a shop, anyone whose page IS the storefront.
   *   center  centred and narrow, for a business with one thing to say.
   *   plain   headline and one button. A name card.
   *   split   the words on the left and a FIGURE on the right. See below.
   */
  layout?: "left" | "band" | "center" | "plain" | "split" | "stage" | "bleed"
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
  photo?: string
  photoAlt?: string
  /** The customer's OWN dashboard, as a layout, rendered small. The dense,
   *  real object every reference puts on its first screen -- see
   *  buildWebsite in lib/templates/industry-template.ts for why it is this and
   *  not a fuller drawing. */
  systemPreview?: unknown
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
  ground?: "page" | "ink"
  figure?: HeroFigureKind
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
  phone?: { label?: string; number: string; href?: string }
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
  priceRows?: { label: string; value: string }[]
  /**
   * One line above everything: when they are open, or what they promise.
   *
   * The black hours strip both local sites open with. Kept as a prop on the
   * hero rather than as its own block because it IS the top of the first
   * screen: a separate block could be dragged away from it, leaving a strip of
   * opening hours floating above a price list halfway down the page.
   */
  strip?: string
  /** Passed through to the figure; see hero-figure.tsx. */
  figureData?: {
    /** The business's own name, as a STRING.
     *  `headline` cannot be used: inside the editor it arrives wrapped in an
     *  <Inline> node so the owner can type into it, and `typeof headline ===
     *  "string"` is false there -- the figure would draw a blank name on every
     *  screen the owner actually looks at while building the page. */
    brand?: string
    services?: { label: string; value: string }[]
    stages?: string[]
    landsIn?: string
    /** One honest line at the foot of the sheet. */
    note?: string
    askLabel?: string
    sampleLabel?: string
  }
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
  const stage = layout === "stage"
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
  const bleed = layout === "bleed"
  const centred = layout === "center"
  const band = layout === "band"
  const plain = layout === "plain"
  const hasPhoto = Boolean(photo?.trim())
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
  const bled = bleed && hasPhoto

  const groundStyle =
    bled
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
          "--tone-bg": "color-mix(in oklab, var(--color-nav-bg) 32%, #101215)",
          "--tone-fg": "var(--color-nav-fg)",
          "--tone-fg-dim": "var(--color-nav-fg-dim)",
          "--tone-line": "color-mix(in oklab, var(--color-nav-fg) 16%, transparent)",
        } as React.CSSProperties)
      : undefined
  const painted = ground !== "page" || bled
  /* A photo is enough to earn the second column on its own. `figure` was the
     only thing that could before, which meant a register asking for the split
     layout on a template with no drawn figure quietly rendered as 左对齐. */
  const split = layout === "split" && (Boolean(figure) || hasPhoto)
  /* The stage shows its object too, but under the words rather than beside
     them, so it is not a `split` and must not build the two-column grid. */
  const staged = stage && (Boolean(figure) || hasPhoto)
  const showProof = !plain && proof && proof.length > 0
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
  const proofBelow = stage && showProof

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
              "--color-primary-soft": "color-mix(in oklab, var(--tone-fg) 18%, transparent)",
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
        stage ? "[padding-block:calc(var(--pad-card-lg)*2.2)_0] flex flex-col justify-center @3xl:[min-block-size:94svh]" : "",
        /* The photograph is the first screen, so it gets the first screen.
           `isolate` keeps the scrim under the words and out of the page. */
        bled ? "relative isolate flex flex-col justify-end @3xl:[min-block-size:82svh]" : "",
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
        <p data-hours-strip="" className="-mt-[calc(var(--pad-card-lg)*2)] mb-[calc(var(--pad-card-lg)*1.5)] [background-color:var(--color-paper)] [color:var(--color-canvas)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] [letter-spacing:var(--tracking-label)] [margin-inline:calc(var(--pad-card-lg)*-1)] [padding-block:calc(var(--pad-control-y)*0.9)] [padding-inline:var(--pad-card-lg)] [text-align:center]">
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
        {eyebrow && (
          <p className="mb-3 [color:var(--color-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
            {eyebrow}
          </p>
        )}
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
          href={phone.href || `tel:${phone.number.replace(/[^\d+]/g, "")}`}
          className={`mt-6 inline-flex flex-wrap items-baseline [gap:var(--gap-inline)] ${
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
            brand={figureData?.brand ?? (typeof headline === "string" ? headline : "")}
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
                  brand={figureData?.brand ?? (typeof headline === "string" ? headline : "")}
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
      </div>
    </section>
  )

  /* The capture layer. It only ever READS the register's own tokens, so it can
     never take part in a cycle with the layer that rewrites them. */
  /* `data-bleed` RIDES ON THE WRAPPER TOO. `.ds-site > * > *` gives every
     top-level block the page's 68rem measure and `[data-bleed]` is how a block
     opts out of it. Adding a layer without the attribute would have put the
     hero inside the measure and let it bleed only within that -- a full-width
     ground that stops 200px from each edge, which looks like a mistake and is
     one. See app/globals.css. */
  return painted ? (
    <div data-bleed="" data-photo-ground={bled ? "" : undefined} style={groundStyle}>
      {shell}
    </div>
  ) : (
    shell
  )
}

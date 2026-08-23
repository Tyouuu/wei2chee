import type { ReactNode } from "react"
import { HeroFigure, type HeroFigureKind } from "./hero-figure"

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
  layout = "left",
  figure,
  figureData,
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
  layout?: "left" | "band" | "center" | "plain" | "split"
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
  figure?: HeroFigureKind
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
  const centred = layout === "center"
  const band = layout === "band"
  const plain = layout === "plain"
  const split = layout === "split" && Boolean(figure)
  const showProof = !plain && proof && proof.length > 0

  return (
    <section
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
        centred ? "text-center" : "",
      ].join(" ")}
    >
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

      {showProof && (
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
      {split && figure && (
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
      )}
      </div>
    </section>
  )
}

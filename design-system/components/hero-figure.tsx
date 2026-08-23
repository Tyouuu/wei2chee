import type { ReactNode } from "react"

/**
 * The right half of the first screen.
 *
 * ── WHY IT EXISTS, MEASURED ───────────────────────────────────────────────
 *
 * SiteHero shipped with four 款式 — left / band / center / plain — and all four
 * render the SAME THING: one column of eyebrow, headline, sub, two buttons, a
 * row of three numbers. There is no second column and no figure anywhere on
 * any 官网版面. Counted across the six templates on 2026-08-23:
 *
 *     quote      hero · services · flow · form · contact
 *     booking    hero · services · flow · form · contact
 *     order      hero · services ·      · form · contact
 *     wholesale  hero · services · flow · form · contact
 *     portfolio  hero · services · flow · form · contact
 *     card       hero · services ·      ·      · contact
 *
 * Four component types, and two of the five slots are the same component
 * (InfoRows) twice. So: three components, three to five sections, and ZERO
 * images — while 216 pulled sections, 46 ilinxa components and 57 of our own
 * sat unused in the library. That is the whole of 「太丑了」, and it is not a
 * matter of taste: a 2026 landing page has something on the right, and these
 * had nothing on any side.
 *
 * ── WHY NOT A PHOTOGRAPH ──────────────────────────────────────────────────
 *
 * landing-templates.ts already argued this and was half right: stock photos
 * are how a generated site announces that nobody designed it, and six
 * templates sharing one library image would undo the only thing that file is
 * for. That reasoning rules out STOCK. It does not rule out a figure, and the
 * file read it as though it did — which is how six pages ended up with nothing
 * visual at all.
 *
 * ── WHAT THE FIGURE IS ────────────────────────────────────────────────────
 *
 * The thing this business is going to send you.
 *
 * A stranger on a contractor's page is deciding whether to ask for a quote.
 * The most persuasive object that page can show is the QUOTE itself — not a
 * picture of a kitchen, not an abstract shape. Formae already builds that
 * document, in the customer's own register and palette, so the figure costs no
 * new design language and no asset: it is the system, shown small.
 *
 * That also makes the six templates genuinely six, because each sale ends in a
 * different piece of paper:
 *
 *     上门报价  a quotation          现货落单  an order at a counter
 *     预约时段  a booking slip       批发询价  an enquiry list
 *     先看东西  a work grid          一页名片  a card
 *
 * ── THE ONE RULE: NO NUMBER THE BUSINESS DID NOT GIVE US ──────────────────
 *
 * The first version of this file drew the quotation with line prices and a
 * 「总额 RM 48,500」, marked 「示例」 in the corner. That is what every template
 * gallery does, and it is fine in a gallery — but this figure does not stay in
 * the gallery. It is part of the page the business PUBLISHES, and a stranger
 * reading a contractor's site does not read corner badges. A fabricated total
 * on a real company's public page is a price we invented for them.
 *
 * So no figure states a price, an amount or an availability the owner did not
 * provide. What is left is the SHAPE of the document plus their own words —
 * which turns out to be the stronger thing anyway: 上门报价's sheet ends on
 * their own pipeline rather than on a total, which is the template's whole
 * premise (there is no number until somebody has been to look), and 批发询价's
 * rows carry an ask-for-price chip, which is literally what that page is for.
 *
 * The one exception is the booking grid's times, and it keeps the 「示例」
 * badge: a slot grid shows HOW you book rather than claiming that 14:00 is
 * free.
 *
 * ── AND IT MUST NOT REPEAT THE SECTION BELOW ──────────────────────────────
 *
 * The services list appears again as InfoRows immediately under the hero. The
 * first render put the same three label/description pairs in both, and even
 * after the figure was renumbered and ruled the page still read as a stutter —
 * because the long description strings ("3-room, shoplot, old-house rework")
 * appeared twice, forty pixels apart, verbatim.
 *
 * So the figure carries the LINE ITEMS and the section below carries the
 * DESCRIPTIONS. That is how the two documents actually differ in life: a
 * quotation lists what is being done, and the page underneath explains it.
 * Neither repeats the other, and the split needs no new data.
 */

export type HeroFigureKind =
  | "quote"
  | "booking"
  | "order"
  | "pricelist"
  | "grid"
  | "card"

/* ── shared parts ────────────────────────────────────────────────────────── */

/** The paper the figure is drawn on: the register's own card.
 *  Not a browser frame — this is a DOCUMENT, and a chrome around it would say
 *  "website" when the point is "the thing you will be handed". */
function Sheet({
  children,
  label,
  tone = "front",
}: {
  children: ReactNode
  label?: string
  tone?: "front" | "back"
}) {
  return (
    <div
      className={[
        "ds-card relative w-full [padding:var(--pad-card)]",
        tone === "back" ? "[opacity:0.55]" : "",
      ].join(" ")}
    >
      {label && (
        <span className="absolute right-3 top-3 [background-color:var(--color-ink-850)] [border-radius:var(--radius-pill)] [color:var(--color-paper-dim)] [font-size:var(--text-micro)] [padding:2px_8px]">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

/** label left, fact right. Used only where the right-hand value is something
 *  the owner actually supplied. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between [border-bottom:var(--hairline)_solid_var(--color-ink-800)] [gap:var(--gap-inline)] [padding-block:calc(var(--pad-cell-y)*0.8)] last:[border-bottom:0]">
      <span className="min-w-0 truncate [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
        {label}
      </span>
      <span className="shrink-0 tabular-nums [color:var(--color-paper)] [font-family:var(--font-numeric)] [font-size:var(--text-sm)]">
        {value}
      </span>
    </div>
  )
}

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="[margin-bottom:var(--gap-stack)]">
      <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
        {sub}
      </p>
      <p className="ds-display [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [line-height:var(--leading-tight)]">
        {title}
      </p>
    </div>
  )
}

/* ── the six ─────────────────────────────────────────────────────────────── */

export function HeroFigure({
  kind = "quote",
  brand,
  services = [],
  stages = [],
  proof = [],
  landsIn,
  note,
  askLabel = "问价",
  sampleLabel = "示例",
}: {
  kind?: HeroFigureKind
  brand: string
  services?: { label: string; value: string }[]
  stages?: string[]
  proof?: { value: string; label: string }[]
  /** 报价单 / 预约 / 订单 — what an enquiry becomes in their system. */
  landsIn?: string
  /** One honest line at the foot of the sheet, in the page's own language.
   *  Passed rather than read from a context because this renders on the server
   *  inside a published page. */
  note?: string
  /** The words on the chip and the counter button. */
  askLabel?: string
  /** Marks the booking grid as illustrative — the only figure that needs it. */
  sampleLabel?: string
}) {
  const three = services.slice(0, 3)

  /** A ruled, numbered row. The SAME data as the list under the hero, in a
   *  different FORM: numbered, ruled, and with the detail set beneath the
   *  label rather than opposite it. */
  const Item = ({ i, label, value }: { i: number; label: string; value?: string }) => (
    <div className="flex [border-bottom:var(--hairline)_solid_var(--color-ink-800)] [gap:var(--gap-inline)] [padding-block:calc(var(--pad-cell-y)*0.85)] last:[border-bottom:0]">
      <span className="shrink-0 tabular-nums [color:var(--color-paper-dim)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)] [padding-top:3px]">
        {String(i + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
          {label}
        </span>
        {value && (
          <span className="mt-0.5 block truncate [color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
            {value}
          </span>
        )}
      </span>
    </div>
  )

  if (kind === "grid") {
    /* 先看东西: the work itself, as a grid whose cells are honest empty frames
       until the owner uploads photos. An empty frame that says what belongs in
       it beats a stock kitchen, because a stranger can tell the difference. */
    return (
      <div className="grid grid-cols-2 [gap:var(--gap-inline)]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="relative aspect-[4/3] overflow-hidden [background-color:var(--color-ink-850)] [border-radius:var(--radius-lg)] [border:var(--hairline)_solid_var(--color-ink-800)]"
          >
            <div className="absolute inset-0 flex items-end [padding:calc(var(--pad-card)*0.6)]">
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
                {three[i]?.label ?? brand}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (kind === "card") {
    /* 一页名片: the card. One object, nothing behind it, and every line on it
       is a fact the owner supplied. */
    return (
      <Sheet>
        <p className="[color:var(--color-primary)] [font-size:var(--text-micro)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
          {three[0]?.label}
        </p>
        <p className="ds-display [color:var(--color-paper)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [line-height:var(--leading-tight)] [margin-block:6px_2px]">
          {brand}
        </p>
        <div className="[margin-top:var(--gap-stack)]">
          {proof.slice(0, 3).map((p) => (
            <Line key={p.label} label={p.label} value={p.value} />
          ))}
        </div>
      </Sheet>
    )
  }

  if (kind === "booking") {
    /* 预约时段: somebody booking a haircut is deciding about a TIME, so the
       object is a day with times on it.

       These times are the only illustrative thing left in this file, and they
       stay because a slot grid is UI rather than a claim — it shows HOW you
       book, not that 14:00 is free on any particular day. Which is why this is
       the one figure that still carries the badge. */
    const slots = ["10:00", "11:30", "14:00", "15:30", "17:00", "18:30"]
    return (
      <Sheet label={sampleLabel}>
        <Head title={landsIn ?? brand} sub={brand} />
        <div className="grid grid-cols-3 [gap:calc(var(--gap-inline)*0.7)]">
          {slots.map((s, i) => (
            <span
              key={s}
              className={[
                "text-center tabular-nums [border-radius:var(--radius-md)] [font-family:var(--font-numeric)] [font-size:var(--text-sm)] [padding-block:calc(var(--pad-control-y)*0.9)]",
                i === 2
                  ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]"
                  : i === 4
                    ? "[background-color:var(--color-ink-850)] [color:var(--color-paper-dim)] line-through"
                    : "[border:var(--hairline)_solid_var(--color-ink-800)] [color:var(--color-paper)]",
              ].join(" ")}
            >
              {s}
            </span>
          ))}
        </div>
        {note && (
          <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] [margin-top:var(--gap-stack)]">
            {note}
          </p>
        )}
      </Sheet>
    )
  }

  if (kind === "pricelist") {
    /* 批发询价: the buyer is a business and what they want is TERMS, so the
       obvious figure is a tier table — and the first version drew one, with
       「RM 12.80 / RM 11.20 / RM 9.90」 in it. Those were prices we invented for
       a real wholesaler's public page.

       What the page is actually for is in its own name: 询价. So each line
       carries an ask-for-price chip instead of a number, which is both true and
       a different right-hand column from every other figure here. */
    return (
      <Sheet>
        <Head title={landsIn ?? brand} sub={brand} />
        <div>
          {three.map((s) => (
            <div
              key={s.label}
              className="flex items-center [border-bottom:var(--hairline)_solid_var(--color-ink-800)] [gap:var(--gap-inline)] [padding-block:calc(var(--pad-cell-y)*0.9)] last:[border-bottom:0]"
            >
              <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)]">
                {s.label}
              </span>
              <span className="shrink-0 [background-color:var(--color-primary-soft)] [border-radius:var(--radius-pill)] [color:var(--color-primary-deep)] [font-size:var(--text-micro)] [font-weight:var(--fw-semibold)] [padding:3px_10px]">
                {askLabel}
              </span>
            </div>
          ))}
        </div>
        {note && (
          <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] [margin-top:var(--gap-stack)]">
            {note}
          </p>
        )}
      </Sheet>
    )
  }

  if (kind === "order") {
    /* 现货落单: a shop's page is a running stack rather than one document, so
       two sheets. No prices and no stock counts — both would be numbers we
       invented for a real shop. The button is UI rather than a claim, and it is
       what makes this read as a counter instead of as paperwork. */
    return (
      <div className="relative">
        <div className="absolute inset-x-4 -top-3">
          <Sheet tone="back">
            <div className="h-6" />
          </Sheet>
        </div>
        <div className="relative">
          <Sheet>
            <Head title={landsIn ?? brand} sub={brand} />
            {three.map((s) => (
              <div
                key={s.label}
                className="[border-bottom:var(--hairline)_solid_var(--color-ink-800)] [padding-block:calc(var(--pad-cell-y)*0.9)] last:[border-bottom:0]"
              >
                <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)]">
                  {s.label}
                </span>
              </div>
            ))}
            <span className="mt-4 block w-full text-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)]">
              {askLabel}
            </span>
          </Sheet>
        </div>
      </div>
    )
  }

  /* quote — the default, and the way most Malaysian SMEs sell.
     A ruled, numbered sheet with their own pipeline along the bottom. It ends
     on the pipeline rather than on a total, because the whole premise of
     上门报价 is that there is no number until somebody has been to look. */
  return (
    <div className="relative">
      <div className="absolute inset-x-5 -top-3.5">
        <Sheet tone="back">
          <div className="h-7" />
        </Sheet>
      </div>
      <div className="relative">
        <Sheet>
          <Head title={landsIn ?? brand} sub={brand} />
          {three.map((s, i) => (
            <Item key={s.label} i={i} label={s.label} />
          ))}
          {stages.length > 0 && (
            <div className="flex flex-wrap items-center [gap:6px] [margin-top:var(--gap-stack)]">
              {stages.slice(0, 4).map((s, i) => (
                <span key={s} className="flex items-center [gap:6px]">
                  {i > 0 && (
                    <span className="[color:var(--color-ink-700)] [font-size:var(--text-micro)]">
                      &rsaquo;
                    </span>
                  )}
                  <span
                    className={[
                      "[border-radius:var(--radius-pill)] [font-size:var(--text-micro)] [padding:2px_9px]",
                      i === 1
                        ? "[background-color:var(--color-primary-soft)] [color:var(--color-primary-deep)] [font-weight:var(--fw-semibold)]"
                        : "[background-color:var(--color-ink-850)] [color:var(--color-paper-dim)]",
                    ].join(" ")}
                  >
                    {s}
                  </span>
                </span>
              ))}
            </div>
          )}
          {note && (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-micro)] [margin-top:calc(var(--gap-stack)*0.8)]">
              {note}
            </p>
          )}
        </Sheet>
      </div>
    </div>
  )
}

import { Star } from "lucide-react"
import { railIcon } from "./rail-icons"

/**
 * The sections a LANDING PAGE has and a dashboard does not.
 *
 * ── WHY THESE ARE NOT INVENTED ───────────────────────────────────────────
 *
 * The founder, 2026-08-27: 「現在的做法不應該是自己設計幾套 而是去深度research
 * 跟找更多的開源項目來作為我們平台landing pages的風格 不是嗎 這個方法更快 也更符合
 * 大眾的審美」. He is right, and the previous round of this work was me deciding
 * what a testimonial looks like.
 *
 * Every shape below is measured off `tailark/blocks` (MIT, 2.3k stars, and it
 * ships a RADIX base -- our own stack), cross-checked against
 * `nobruf/shadcn-landing-page` (MIT) and the two real Malaysian trade sites in
 * `.screenshots/landing/`. Their conventions, read out of the source rather
 * than eyeballed:
 *
 *   section rhythm      py-24 (96px), container max-w-5xl, px-6
 *   testimonial         a five-star row, the quote, then avatar + name + role
 *   call to action      centred h2 at text-3xl/4xl and two buttons, nothing else
 *   feature             a card per item: icon, title, one line
 *
 * ── WHY REBUILT AGAINST OUR TOKENS RATHER THAN PASTED ────────────────────
 *
 * Their components hardcode Tailwind colours (`text-foreground`, `bg-muted`).
 * Pasted in, a customer's website would stop following the register and the
 * palette they chose, and the owner could not change any of it in the editor.
 * The SHAPE is what is worth taking, and the shape is what is taken -- the same
 * method that produced 工作室 out of the admin dashboard on 2026-08-26.
 *
 * The rhythm and the container are deliberately NOT repeated here: `.ds-site`
 * in app/globals.css gives every block on a website the same measure, and a
 * section that set its own would disagree with the eight blocks around it.
 */

export function SiteFeatures({
  heading,
  note,
  items,
}: {
  heading?: string
  note?: string
  items: { label: string; value: string; icon?: string }[]
}) {
  if (!items?.length) return null
  return (
    <section className="@container">
      {heading ? (
        <div className="mb-10 max-w-[46ch]">
          <h2 className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
          {note ? (
            <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* One card per thing they do. A card, not a row: the references use
          cards for what a business SELLS and rows for what it merely lists, and
          the three things a contractor does are the sale. */}
      <ul className="grid [gap:var(--gap-stack)] @2xl:grid-cols-3">
        {items.map((f) => (
          <li
            key={f.label}
            className="ds-card flex flex-col [gap:var(--gap-inline)] [padding:calc(var(--pad-card)*1.4)]"
          >
            {f.icon ? (
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center [background:var(--color-primary-soft)] [border-radius:var(--radius-md)] text-[color:var(--color-primary)]"
              >
                {railIcon(f.icon, "h-5 w-5")}
              </span>
            ) : null}
            <h3 className="[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{f.label}</h3>
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
              {f.value}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SiteTestimonials({
  heading,
  items,
}: {
  heading?: string
  /** `stars` is optional and defaults to five: a business putting a review on
   *  its own page is not publishing a three-star one, and an explicit 5 on
   *  every row is data nobody typed. */
  items: { quote: string; who: string; role?: string; stars?: number }[]
}) {
  if (!items?.length) return null
  return (
    <section className="@container">
      {heading ? (
        <h2 className="ds-display mb-10 [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
      ) : null}
      <ul className="grid [gap:calc(var(--gap-stack)*1.5)] @2xl:grid-cols-3">
        {items.map((t, i) => (
          <li key={i} className="flex flex-col">
            {/* Stars first, above the words. Measured off tailark: the eye
                takes the rating before it decides whether to read the quote,
                and a rating under the quote is a rating nobody saw. */}
            <div className="flex [gap:2px]">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star
                  key={s}
                  aria-hidden
                  className="h-4 w-4"
                  style={
                    s < (t.stars ?? 5)
                      ? { fill: "var(--color-brass)", stroke: "var(--color-brass)" }
                      : { fill: "var(--border-subtle)", stroke: "transparent" }
                  }
                />
              ))}
            </div>
            <p className="my-4 [color:var(--color-paper)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
              {t.quote}
            </p>
            <div className="mt-auto flex items-center [gap:var(--gap-inline)]">
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full [background:var(--color-primary-soft)] [color:var(--color-primary)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)]"
              >
                {t.who.trim().charAt(0) || "·"}
              </span>
              <span className="min-w-0">
                <span className="block truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {t.who}
                </span>
                {t.role ? (
                  <span className="block truncate [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {t.role}
                  </span>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function SiteCta({
  heading,
  note,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  heading: string
  note?: string
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
}) {
  return (
    /* A BAND, not a card. Every reference sets the mid-page ask on its own
       ground so it reads as a break in the page rather than as one more
       section -- which is the whole job: somebody who has read this far and
       still not pressed anything gets asked once more, in the middle, where
       they are. */
    <section className="[background:var(--color-primary-soft)] [border-radius:var(--radius-lg)] [padding-block:calc(var(--pad-card-lg)*2)] [padding-inline:var(--pad-card-lg)] text-center">
      <h2 className="ds-display mx-auto max-w-[24ch] text-balance [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
        {heading}
      </h2>
      {note ? (
        <p className="mx-auto mt-4 max-w-[46ch] [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
          {note}
        </p>
      ) : null}
      {primaryLabel || secondaryLabel ? (
        <div className="mt-8 flex flex-wrap justify-center [gap:var(--gap-inline)]">
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
              className="inline-flex min-h-12 items-center border [border-color:var(--border-strong)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
            >
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

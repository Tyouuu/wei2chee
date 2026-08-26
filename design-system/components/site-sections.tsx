import { Check, Star } from "lucide-react"
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

/**
 * 别人给的证明 —— 执照、代理的牌子、客人打的分。
 *
 * ── WHERE THIS CAME FROM ──────────────────────────────────────────────────
 *
 * The founder, 2026-08-27: 「我说看看如何融合 随便也去看看国外的landing pages是
 * 怎么去做的」. Measured the same day (npm run shoot:kits): a LOGO WALL is the
 * one section kind that appears across the open-source kits and the products
 * they imitate -- tailark, magicui, framer twice -- and is the one kind this
 * product had no block for at all.
 *
 * ── WHY IT IS NOT A LOGO WALL ─────────────────────────────────────────────
 *
 * A logo wall says 「these companies use us」, and a Kuala Lumpur contractor has
 * no customer logos to show. What this market shows instead, photographed on
 * the same day across 19 trading SME sites: 「JKKP-Certified Technicians」,
 * 「30-Day Service Warranty」, an authorised-dealer badge, and a Google rating
 * with a review count. Same job -- somebody ELSE vouching for you -- in the
 * currency this market actually holds.
 *
 * ── WHY IT SHIPS EMPTY ────────────────────────────────────────────────────
 *
 * Every field here is a claim about the world, and a claim we invented is a
 * claim that is false: we do not know whether this business is JKKP-certified
 * or what its Google score is. So it starts as an obvious labelled gap, and
 * publish-projection.ts drops the whole section while it is still one --
 * 编辑器负责催，公开的页面永远不出现「催」. That rule is the reason the previous
 * round of this work reached a stranger's screen with 「WhatsApp 012-345 6789」
 * and must not do it again with 「ISO 9001」.
 *
 * ── WHY IT IS NOT A STATS BAND ────────────────────────────────────────────
 *
 * A stats band was the other thing the kits have and we do not, and it is
 * DELIBERATELY not built: SiteHero already prints three figures (10 years · 24
 * hours · Klang Valley). 印 was cut from the register library on 2026-08-26 for
 * printing one number twice on one page; adding a section to do it again would
 * be shipping the thing we culled a register over.
 */
export function SiteCreds({
  heading,
  hint,
  shape = "strip",
  rating,
  items,
}: {
  heading?: string
  /** What the OWNER is asked for while this is still empty. It is never
   *  published: publish-projection.ts drops the whole block while nothing is
   *  filled, which is the rule the whole module runs on -- 编辑器负责催，公开的
   *  页面永远不出现「催」. */
  hint?: string
  /** 换款式. `strip` a single dotted line, `badges` ticked pills, `rating` the
   *  review score with the credentials small underneath. The register picks it;
   *  see design-doc.ts. */
  shape?: "strip" | "badges" | "rating"
  rating?: { score?: string; count?: string; source?: string; placeholder?: boolean }
  items?: { label: string; note?: string; placeholder?: boolean }[]
}) {
  const real = (items ?? []).filter((i) => i.label?.trim())
  const hasRating = Boolean(rating?.score?.trim())

  /* EMPTY IS A PROMPT, NOT NOTHING.
     Returning null here would have been the seventh time in this repo that a
     capability shipped with its wire unconnected: the owner would never see
     the section, so they would never fill it, so it would never publish. A
     labelled gap is how PhotoFrame already asks for the photograph. */
  if (!real.length && !hasRating) {
    if (!hint) return null
    return (
      <section
        data-prompt=""
        className="@container [border:1px_dashed_var(--border-strong)] [border-radius:var(--radius-lg)] [padding:var(--pad-card-lg)]"
      >
        {heading ? (
          <h2 className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {heading}
          </h2>
        ) : null}
        <p className="mt-2 max-w-[52ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {hint}
        </p>
      </section>
    )
  }

  const showRating = shape === "rating" && hasRating

  return (
    <section className="@container">
      {heading && shape !== "strip" ? (
        <h2 className="ds-display mb-8 [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
      ) : null}

      {showRating ? (
        <div className="mb-6 flex flex-wrap items-baseline [gap:var(--gap-inline)]">
          <span
            aria-hidden
            className="flex [gap:2px] self-center"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-5 w-5"
                style={{ fill: "var(--color-brass)", stroke: "var(--color-brass)" }}
              />
            ))}
          </span>
          <span className="[color:var(--color-paper)] [font-size:var(--text-2xl)] [font-weight:var(--fw-semibold)] [font-variant-numeric:tabular-nums]">
            {rating!.score}
          </span>
          {rating?.count ? (
            <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
              {rating.count}
              {rating.source ? ` · ${rating.source}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {shape === "strip" ? (
        /* One line, small caps, dot-separated -- the shape the aircond and
           windscreen sites use across the top of their first screen. It is a
           line of facts, not a grid of cards, and giving it a card each would
           make four short phrases take a whole screen. */
        <p className="flex flex-wrap items-center [gap:calc(var(--gap-inline)*1.2)] [color:var(--color-paper-dim)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] uppercase [letter-spacing:0.09em]">
          {real.map((c, i) => (
            <span key={c.label} className="flex items-center [gap:calc(var(--gap-inline)*1.2)]">
              {i > 0 ? (
                <span aria-hidden className="[color:var(--border-strong)]">
                  ·
                </span>
              ) : null}
              {c.label}
            </span>
          ))}
        </p>
      ) : (
        <ul className={`grid [gap:var(--gap-inline)] ${shape === "rating" ? "@2xl:grid-cols-4" : "@2xl:grid-cols-2"}`}>
          {real.map((c) => (
            <li
              key={c.label}
              className="flex items-start [gap:var(--gap-inline)] [border:var(--hairline)_solid_var(--border-subtle)] [border-radius:var(--radius-md)] [padding:var(--pad-card)]"
            >
              <span
                aria-hidden
                className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full [background:var(--color-primary-soft)] [color:var(--color-primary)]"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {c.label}
                </span>
                {c.note ? (
                  <span className="block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{c.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

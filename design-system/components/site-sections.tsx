import { Check, Star } from "lucide-react"
import { icon as tradeIcon } from "./trade-blocks"

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
            {/*
              THE ICON MAP, NOT THE RAIL'S.

              This called `railIcon`, which is the SIDEBAR's registry -- its
              keys are module names (customers, quotations, payments). The
              words a service carries are semantic (work, file, tag, money),
              none of which are in it, so `railIcon` returned null and every
              service card on every generated website drew an empty pale
              square where its icon should be. Three of them per page, on the
              first screen a stranger sees. The founder called the result 很丑
              and he was looking straight at this.

              `icon()` from trade-blocks.tsx is the registry these words belong
              to, and it falls back to a real glyph rather than to nothing --
              which is the property that would have prevented this.
            */}
            {(() => {
              const Glyph = tradeIcon(f.icon)
              return (
                <span
                  aria-hidden
                  className="grid h-11 w-11 place-items-center [background:var(--color-primary-soft)] [border-radius:var(--radius-md)] text-[color:var(--color-primary)]"
                >
                  <Glyph className="h-5 w-5" />
                </span>
              )
            })()}
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
    <section
      data-cta-band=""
      data-wide=""
      className="[background:var(--color-primary)] [border-radius:var(--radius-lg)] [padding-block:calc(var(--pad-card-lg)*2)] [padding-inline:var(--pad-card-lg)] text-center"
    >
      <h2 className="ds-display mx-auto max-w-[24ch] text-balance [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]">
        {heading}
      </h2>
      {note ? (
        <p className="mx-auto mt-4 max-w-[46ch] [color:color-mix(in_oklab,var(--color-on-primary)_78%,transparent)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
          {note}
        </p>
      ) : null}
      {primaryLabel || secondaryLabel ? (
        <div className="mt-8 flex flex-wrap justify-center [gap:var(--gap-inline)]">
          {primaryLabel ? (
            <a
              href={primaryHref || "#"}
              className="inline-flex min-h-12 items-center [background-color:var(--color-on-primary)] [border-radius:var(--radius-control)] [color:var(--color-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
            >
              {primaryLabel}
            </a>
          ) : null}
          {secondaryLabel ? (
            <a
              href={secondaryHref || "#"}
              className="inline-flex min-h-12 items-center border [border-color:color-mix(in_oklab,var(--color-on-primary)_45%,transparent)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
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
          <h2 className="[color:var(--color-on-primary)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
            {heading}
          </h2>
        ) : null}
        <p className="mt-2 max-w-[52ch] [color:color-mix(in_oklab,var(--color-on-primary)_78%,transparent)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {hint}
        </p>
      </section>
    )
  }

  const showRating = shape === "rating" && hasRating

  return (
    <section className="@container">
      {heading && shape !== "strip" ? (
        <h2 className="ds-display mb-8 [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]">{heading}</h2>
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
          <span className="[color:var(--color-on-primary)] [font-size:var(--text-2xl)] [font-weight:var(--fw-semibold)] [font-variant-numeric:tabular-nums]">
            {rating!.score}
          </span>
          {rating?.count ? (
            <span className="[color:color-mix(in_oklab,var(--color-on-primary)_78%,transparent)] [font-size:var(--text-sm)]">
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
        <p className="flex flex-wrap items-center [gap:calc(var(--gap-inline)*1.2)] [color:color-mix(in_oklab,var(--color-on-primary)_78%,transparent)] [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] uppercase [letter-spacing:0.09em]">
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
                <span className="block [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                  {c.label}
                </span>
                {c.note ? (
                  <span className="block [color:color-mix(in_oklab,var(--color-on-primary)_78%,transparent)] [font-size:var(--text-xs)]">{c.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * 作品墙 —— the photographs, in a shape that is not always three equal boxes.
 *
 * ── WHAT IT REPLACES AND WHY ──────────────────────────────────────────────
 *
 * `work` was a Columns of three PhotoFrames, hard-coded to thirds. Two things
 * were wrong with it. It is the section this market cares most about -- 14 of
 * 19 trading Malaysian SME sites give their first screen to a photograph, and
 * the renovation ones are photo galleries all the way down -- and it was the
 * one section where the register had no say at all, so fourteen 风格 showed
 * fourteen identical rows of three.
 *
 * ── WHERE THE SHAPES COME FROM ────────────────────────────────────────────
 *
 * tailark's block catalogue, read properly on 2026-08-27. shoot:kits measured
 * their HOMEPAGE the first time round, which has three sections on it; the
 * library behind it is 4 themes × 12 block kinds. Two of those kinds are
 * galleries this product had no answer to -- `bento` and `features-carousel`
 * -- and both are better than a row of three for showing work:
 *
 *   grid   three equal. Fine, and what we had.
 *   bento  one large beside two small, all three cut from ONE rectangle, so
 *          the section has a size to it rather than three of the same thing.
 *   strip  a horizontal scroller. For a contractor with eleven finished
 *          kitchens this is the only shape that does not run down the page.
 */
export function SiteGallery({
  heading,
  note,
  shape = "grid",
  items,
}: {
  heading?: string
  note?: string
  shape?: "grid" | "bento" | "strip"
  items?: { src?: string; alt?: string; caption?: string }[]
}) {
  const shots = items ?? []
  if (!shots.length) return null
  /*
    AN EMPTY GALLERY IS A STRIP, NOT THREE FULL SCREENS.

    The founder photographed his own phone on 2026-08-27: three 「Add a photo」
    boxes, each one taking a whole screen, one after another. At 390px a 4:3
    frame is 293px tall, and three of them plus captions is nearly 900px of
    nothing to scroll past before the page continues.

    The prompt has to stay -- an owner who never sees where the photographs go
    never adds any, and this is the section that matters most in this market.
    It does not have to be enormous. Unfilled frames collapse to a short row;
    the moment one has a photograph in it the gallery takes its real shape.
  */
  const anyFilled = shots.some((s) => s.src?.trim())

  const frame = (
    s: { src?: string; alt?: string; caption?: string },
    key: string,
    className = "",
    ratio = 4 / 3,
  ) => (
    <figure
      key={key}
      className={"flex min-w-0 flex-col [gap:calc(var(--gap-stack)*0.4)] " + className}
    >
      <div
        className="relative w-full overflow-hidden [background-color:var(--color-ink-850)] [border-radius:var(--radius-lg)] [border:var(--hairline)_solid_var(--color-ink-800)]"
        style={{ aspectRatio: anyFilled || s.src ? String(ratio) : "5 / 2" }}
      >
        {s.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase
          // storage, which Next's optimiser is not configured for here.
          <img
            src={s.src}
            alt={s.alt ?? s.caption ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
            {s.caption || s.alt || ""}
          </span>
        )}
      </div>
      {s.caption && s.src ? (
        <figcaption className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          {s.caption}
        </figcaption>
      ) : null}
    </figure>
  )

  return (
    /* `data-wide`: a gallery is pictures, and pictures take the room. The
       heading above them keeps the page measure -- see app/globals.css. */
    <section data-wide="" className="@container">
      {heading ? (
        <div className="mb-8 max-w-[46ch]">
          <h2 className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
          {note ? (
            <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}

      {shape === "strip" ? (
        /* Scrolls inside itself, never the page. A gallery that widens the
           document is the bug every wide table in this repo has already had. */
        <div className="-mx-2 flex snap-x snap-mandatory overflow-x-auto px-2 [gap:var(--gap-stack)] [scrollbar-width:thin]">
          {shots.map((s, i) => (
            <div key={i} className="w-[78cqw] shrink-0 snap-start @2xl:w-[38cqw]">
              {frame(s, "strip-" + i)}
            </div>
          ))}
        </div>
      ) : shape === "bento" && shots.length >= 3 ? (
        /* ONE RECTANGLE CUT IN THREE, not three rectangles placed together --
           the same argument the dashboard's bento makes. The tall one is first
           in the DOM so a phone, which stacks them, still opens on the best
           photograph. */
        <div className="grid [gap:var(--gap-stack)] @2xl:grid-cols-3 @2xl:grid-rows-2">
          <div className="@2xl:col-span-2 @2xl:row-span-2">
            {frame(shots[0], "bento-0", "h-full", 3 / 2)}
          </div>
          {shots.slice(1).map((s, i) => frame(s, "bento-" + (i + 1)))}
        </div>
      ) : (
        <div className="grid [gap:var(--gap-stack)] @2xl:grid-cols-3">
          {shots.map((s, i) => frame(s, "grid-" + i))}
        </div>
      )}
    </section>
  )
}

/**
 * 一段话配一张照片 —— the section every small business page has and this one
 * did not.
 *
 * tailark ships it as `content` in three of its four themes; every SME site in
 * the 2026-08-27 sample has one (「about us」, 「why choose us」, 「since 1993」).
 * Ours had no way to put a paragraph beside a picture at all: the page was
 * cards, rows and a table, which is a dashboard's vocabulary and reads like
 * one.
 *
 * IT IS THE ONE PLACE THE OWNER WRITES IN THEIR OWN VOICE. Everything else on
 * the page is generated from the questionnaire, so this ships as a short, true
 * line the owner is expected to replace -- never as agency filler, and never
 * with somebody else's photograph.
 */
export function SiteStory({
  heading,
  hint,
  body,
  shape = "side",
  photo,
  photoAlt,
  points,
}: {
  heading?: string
  /** What the OWNER is asked for while the body is still empty. Never
   *  published -- publish-projection.ts drops the whole section until there is
   *  a body, because a paragraph about a business we invented is a lie on a
   *  stranger's screen. */
  hint?: string
  body?: string
  /** `side` picture right, `side-reverse` picture left, `stack` picture over
   *  the words. The register chooses; see design-doc.ts. */
  shape?: "side" | "side-reverse" | "stack"
  photo?: string
  photoAlt?: string
  points?: { label: string }[]
}) {
  const marks = (points ?? []).filter((p) => p.label?.trim())

  /* EMPTY IS A PROMPT, NOT NOTHING -- the same rule SiteCreds follows. A block
     that renders nothing while unfilled is a block the owner never sees, never
     fills, and therefore never publishes. */
  if (!body?.trim() && !photo?.trim() && !marks.length) {
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
        <p className="mt-2 max-w-[56ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {hint}
        </p>
      </section>
    )
  }
  if (!heading?.trim() && !body?.trim()) return null

  const words = (
    <div className="min-w-0">
      {heading ? (
        <h2 className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
      ) : null}
      {body ? (
        <p className="mt-4 max-w-[52ch] [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
          {body}
        </p>
      ) : null}
      {marks.length ? (
        <ul className="mt-6 grid [gap:var(--gap-inline)]">
          {marks.map((m) => (
            <li key={m.label} className="flex items-start [gap:var(--gap-inline)]">
              <span
                aria-hidden
                className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full [background:var(--color-primary-soft)] [color:var(--color-primary)]"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="[color:var(--color-paper)] [font-size:var(--text-base)]">{m.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )

  const picture = photo?.trim() ? (
    <div className="min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={photoAlt || ""}
        className="w-full object-cover [border-radius:var(--radius-lg)]"
        style={{ aspectRatio: "4 / 3" }}
      />
    </div>
  ) : null

  if (!picture || shape === "stack") {
    return (
      <section className="@container">
        {picture ? <div className="mb-8">{picture}</div> : null}
        {words}
      </section>
    )
  }

  return (
    <section className="@container grid items-center [gap:calc(var(--gap-stack)*1.5)] @2xl:grid-cols-2">
      {shape === "side-reverse" ? (
        <>
          {/* The picture is second in the DOM either way and moved by `order`,
              so a phone always reads the words first -- the same rule
              site-hero.tsx makes for its own figure. */}
          <div className="@2xl:order-2">{words}</div>
          <div className="@2xl:order-1">{picture}</div>
        </>
      ) : (
        <>
          {words}
          {picture}
        </>
      )}
    </section>
  )
}

/**
 * 师傅团队 —— who actually turns up.
 *
 * ── TAKEN FROM THE LIBRARY, NOT INVENTED ─────────────────────────────────
 *
 * The founder, 2026-08-27: 「那 217 段的绝大多数 怎么还没拿啊 去拿啊」. He is
 * right that they were sitting there, and the honest report on what they are
 * is this: `components/blocks/team-1.tsx` is 215 lines with ZERO hardcoded
 * colours -- genuinely token-pure -- and a hardcoded `const members = [...]`
 * of SaaS founders with LinkedIn, Twitter and GitHub links and bios like
 * 「Former principal designer at Figma and Linear」.
 *
 * So a pulled section is a PICTURE, not a block. It takes no props, and its
 * data model is somebody else's business. What it gives is the composition and
 * the spacing, which is the expensive half; what it cannot give is the shape
 * of the facts. A renovation contractor's team has a name, a trade, how long
 * they have been doing it and a face -- and no GitHub.
 *
 * ── WHY THIS SECTION AND NOT ANOTHER ─────────────────────────────────────
 *
 * Measured, not guessed. Of the 19 trading Malaysian SME sites photographed on
 * 2026-08-27, the dental clinics lead with their DOCTORS and the aircond
 * companies with technicians in uniform. It is the same move the local market
 * makes with a photograph of the physical signboard: proof that real people
 * are behind the number you are about to call.
 *
 * ── AND IT SHIPS EMPTY ───────────────────────────────────────────────────
 *
 * Every field is a claim about a person. We do not know who works here. So it
 * prompts in the editor and publish-projection drops it until the owner fills
 * one in -- the same rule SiteCreds and SiteStory follow, and the rule that a
 * seeded phone number broke on a live page on 2026-08-26.
 */
export function SiteTeam({
  heading,
  note,
  hint,
  shape = "cards",
  members,
}: {
  heading?: string
  note?: string
  /** Shown to the OWNER while this is still empty. Never published. */
  hint?: string
  /** `cards` a bordered card each, `plain` a bare column, `row` faces in a
   *  line with the name beside them. The register chooses. */
  shape?: "cards" | "plain" | "row"
  members?: { name: string; role?: string; years?: string; photo?: string }[]
}) {
  const real = (members ?? []).filter((m) => m.name?.trim())

  if (!real.length) {
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
        <p className="mt-2 max-w-[56ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {hint}
        </p>
      </section>
    )
  }

  const face = (m: { name: string; photo?: string }, size: string) =>
    m.photo?.trim() ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={m.photo}
        alt=""
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    ) : (
      <span
        aria-hidden
        className={`${size} grid shrink-0 place-items-center rounded-full [background:var(--color-primary-soft)] [color:var(--color-primary)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]`}
      >
        {m.name.trim().charAt(0)}
      </span>
    )

  return (
    <section className="@container">
      {heading ? (
        <div className="mb-8 max-w-[46ch]">
          <h2 className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
          {note ? (
            <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
              {note}
            </p>
          ) : null}
        </div>
      ) : null}

      {shape === "row" ? (
        /* A line of faces with the name beside each. For a business whose team
           is three people, a grid of three cards is three-quarters whitespace. */
        <ul className="flex flex-wrap [gap:calc(var(--gap-stack)*1.4)]">
          {real.map((m) => (
            <li key={m.name} className="flex items-center [gap:var(--gap-inline)]">
              {face(m, "h-12 w-12")}
              <span className="min-w-0">
                <span className="block [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
                  {m.name}
                </span>
                <span className="block [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
                  {[m.role, m.years].filter(Boolean).join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid [gap:var(--gap-stack)] @2xl:grid-cols-3">
          {real.map((m) => (
            <li
              key={m.name}
              className={
                shape === "cards"
                  ? "ds-card flex flex-col items-start [gap:var(--gap-inline)] [padding:calc(var(--pad-card)*1.3)]"
                  : "flex flex-col items-start [gap:var(--gap-inline)]"
              }
            >
              {face(m, "h-16 w-16")}
              <span>
                <span className="block [color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                  {m.name}
                </span>
                {m.role ? (
                  <span className="block [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{m.role}</span>
                ) : null}
                {m.years ? (
                  <span className="mt-1 block [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
                    {m.years}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

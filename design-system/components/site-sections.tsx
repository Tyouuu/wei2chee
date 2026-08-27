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
  shape = "cards",
}: {
  heading?: string
  note?: string
  items: { label: string; value: string; icon?: string }[]
  /**
   * `cards` a bordered card each · `panel` all three on one painted ground,
   * split by hairlines · `bands` a numbered row each, ruled off, no boxes.
   *
   * ── THE MEASUREMENT THAT MADE THIS NECESSARY ────────────────────────────
   *
   * Counted on the live pages against three Wix templates, 2026-08-27 --
   * painted areas larger than 150px tall, per page:
   *
   *   我们 满图   10      Wix 装修   27
   *   我们 台账    2      Wix 油漆   27  (and 14 photographs to our 2-5)
   *   我们 瑞士    1      Wix 律师   20
   *
   * They compose a page out of twenty to twenty-seven painted areas. We
   * composed one out of one to ten, and out of bordered cards -- `ds-card`,
   * which is the DASHBOARD's card class. This section is the most repeated
   * element on every generated website and it was rendering admin furniture.
   * 任务 28 wrote the diagnosis months ago -- 「这套 token 是给后台做的」 -- and
   * every round since has rearranged that furniture instead of replacing it.
   *
   * So a register may now say what a service looks like, and the three
   * answers are genuinely different objects rather than one object restyled.
   */
  shape?: "cards" | "panel" | "bands" | "stated" | "dotted"
}) {
  if (!items?.length) return null

  const title = heading ? (
    <div className="mb-10 max-w-[46ch]">
      <h2 className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
      {note ? (
        <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
          {note}
        </p>
      ) : null}
    </div>
  ) : null

  /* NO 01 / 02 / 03. impeccable's Refuse list: 「Section numbers unless the
     sequence itself carries information the reader needs」. Three services a
     contractor offers are not a sequence -- you do not do the kitchen before
     the bathroom because it is numbered 01. 流程 keeps its numbers, because
     there the order IS the information. Added by me an hour before reading
     that list, which is the whole reason the list is worth having. */
  if (shape === "panel") {
    /* ONE PAINTED AREA HOLDING ALL THREE, split by hairlines rather than by
       gaps. Taken from Wix's Home Remodeling template, where the services sit
       inside a single filled rectangle instead of floating as three objects --
       which is what stops a page reading as a grid of widgets. */
    return (
      <section className="@container" data-wide="">
        {title}
        <ul className="grid overflow-hidden [background:var(--color-block,var(--color-primary-soft))] [border-radius:var(--radius-lg)] @2xl:grid-cols-3">
          {items.map((f, i) => (
            <li
              key={f.label}
              className={[
                "flex flex-col [gap:calc(var(--gap-inline)*0.6)] [padding:calc(var(--pad-card-lg)*1.1)]",
                i > 0 ? "[border-top:var(--hairline)_solid_var(--border-subtle)] @2xl:[border-top:0]" : "",
                i > 0 ? "@2xl:[border-inline-start:var(--hairline)_solid_var(--border-subtle)]" : "",
              ].join(" ")}
            >
              <span className="ds-display [color:var(--color-paper)] [font-size:var(--text-xl)] [font-weight:var(--fw-semibold)] [line-height:var(--leading-tight)]">
                {f.label}
              </span>
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                {f.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (shape === "dotted") {
    /*
      ── 左大右小两个标题 + 三张带点的框卡 ──────────────────────────────────

      Section four of the page 満図 copies whole (Wix a-reynolds, 2026-08-27:
      479px, no photographs). Two things in it that no other shape here does:

        the heading is a PAIR -- 「Our Specializations」 large on the left and
        「Where We Excel」 small on the right with one line under it. One
        heading announces a section; two of them frame it, and the right-hand
        one is where the sentence goes that would otherwise crowd the left.

        each card carries a small solid DOT above its title, in the register's
        own primary. It is the only mark on the card and it is what stops
        three bordered rectangles reading as a table.

      Why this rather than switching 満図 to `cards`: `cards` is already worn
      by two other registers, and the whole point of the shape layer is that
      no two wear the same one (重点 7c). This is the reference's section, not
      a restyling of somebody else's.
    */
    return (
      <section className="@container" data-wide="">
        <div className="mb-10 grid [gap:var(--gap-stack)] @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @3xl:items-end">
          {heading ? (
            <h2 className="ds-display [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{heading}</h2>
          ) : null}
          {note ? (
            <p className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
              {note}
            </p>
          ) : null}
        </div>
        <ul className="grid [gap:var(--gap-stack)] @2xl:grid-cols-3">
          {items.map((f) => (
            <li
              key={f.label}
              className="flex flex-col [background:color-mix(in_oklab,var(--color-primary)_5%,var(--color-canvas))] [border:var(--hairline)_solid_var(--border-subtle)] [border-radius:var(--radius-lg)] [gap:calc(var(--gap-inline)*0.7)] [padding:calc(var(--pad-card-lg)*1.05)]"
            >
              <span aria-hidden className="mb-1 block size-2 rounded-full [background:var(--color-primary)]" />
              <span className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [line-height:var(--leading-tight)]">
                {f.label}
              </span>
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                {f.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (shape === "stated") {
    /*
      ── 左标签 · 右大字 ──────────────────────────────────────────────────

      Copied off the current wave rather than off a template house style —
      founder, 2026-08-27: 「我不要抄这些比较旧的 给我抄新一点的」. Shot the same
      day (.screenshots/saas/current.jpg): Polar runs this shape FOUR TIMES
      down its page, and Linear, Vercel and Attio all use it.

        left    a short quiet label, sometimes two words: 「Platform」,
                「Meter everything」, 「Sell globally」, 「Intake and
                integrations」
        right   the sentence at display size, and its second half DIMMED —
                「Every token becomes revenue」 solid, 「the moment your model
                streams it」 dimmed.

      It is the section shape that reads as 2026, and it needs no photograph,
      no card and no icon: a label, a sentence, and a rule. Which is why it
      belongs to 瑞士, the register that refuses every other decoration.
    */
    return (
      <section className="@container">
        {title}
        <ul>
          {items.map((f) => (
            <li
              key={f.label}
              className="grid [border-top:var(--hairline)_solid_var(--border-subtle)] [gap:.5rem_calc(var(--gap-stack)*1.4)] [padding-block:calc(var(--pad-card-lg)*1.15)] @3xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
            >
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [letter-spacing:var(--tracking-label)]">
                {f.label}
              </span>
              <span
                className="ds-display max-w-[30ch] [color:var(--color-paper)] [font-weight:var(--fw-medium)] [line-height:1.22]"
                style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.9rem)" }}
              >
                {/* The dimmed continuation, which is the half that makes the
                    shape read as current rather than as a definition list. */}
                {f.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (shape === "bands") {
    /* NO BOXES AT ALL. A rule, a number, and the words -- the shape a printed
       schedule of works has, and the one 瑞士 and 台账 can wear without
       contradicting themselves. The label is set at display size because with
       nothing drawn around it, size is the only thing left to rank it by. */
    return (
      <section className="@container">
        {title}
        <ul>
          {items.map((f, i) => (
            <li
              key={f.label}
              className="grid [border-top:var(--hairline)_solid_var(--border-strong)] [gap:.35rem_calc(var(--gap-stack)*1.2)] [padding-block:calc(var(--pad-card-lg)*0.9)] @2xl:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.1fr)] @2xl:items-baseline"
            >
              <span className="ds-display [color:var(--color-paper)] [font-size:var(--text-2xl,1.5rem)] [font-weight:var(--fw-semibold)] [line-height:var(--leading-tight)]">
                {f.label}
              </span>
              <span className="[color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
                {f.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="@container">
      {title}

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
  shape = "cards",
}: {
  heading?: string
  /** `stars` is optional and defaults to five: a business putting a review on
   *  its own page is not publishing a three-star one, and an explicit 5 on
   *  every row is data nobody typed. */
  items: { quote: string; who: string; role?: string; stars?: number }[]
  /**
   * `cards` stars, then the quote, then the face -- read off tailark.
   * `ruled` the face first, then the name, then the quote, under a hairline
   *         and with no rating at all.
   *
   * The second is measured off the page 満図 copies whole (Wix a-reynolds,
   * 2026-08-27, section seven: 289px, three photographs). It has no stars.
   * That is not an omission -- a five-star row on every quote is a rating
   * nobody typed, and their section leads with a FACE instead, which is the
   * thing a stranger actually checks. 口碑在这个市场就是全部生意, and the two
   * shapes make two different arguments about how it is shown.
   */
  shape?: "cards" | "ruled"
}) {
  if (!items?.length) return null

  if (shape === "ruled") {
    return (
      <section className="@container">
        {heading ? (
          <h2 className="ds-display mb-8 [border-top:var(--hairline)_solid_var(--border-subtle)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)] [padding-top:calc(var(--pad-card-lg)*1.1)]">
            {heading}
          </h2>
        ) : null}
        <ul className="grid [gap:calc(var(--gap-stack)*1.5)] @2xl:grid-cols-3">
          {items.map((t, i) => (
            <li key={i} className="flex flex-col">
              <span
                aria-hidden
                className="mb-3 grid h-11 w-11 shrink-0 place-items-center rounded-full [background:var(--color-primary-soft)] [color:var(--color-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]"
              >
                {t.who.trim().charAt(0) || "·"}
              </span>
              <span className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
                {t.who}
              </span>
              <p className="mt-2 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                {t.quote}
              </p>
            </li>
          ))}
        </ul>
      </section>
    )
  }

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
  shape = "band",
  photo,
  photoAlt,
}: {
  heading: string
  note?: string
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  /**
   * `band` the ask centred on its own colour · `panel` the colour taking one
   * side with the register's own ground beside it · `rule` no fill at all, a
   * hairline with the words left and the buttons right.
   *
   * ── WHY THIS AXIS EXISTS ────────────────────────────────────────────────
   *
   * It did not, and that was the defect. All fourteen registers rendered the
   * identical centred band, and the only thing that changed between them was
   * the colour of it -- 重点 7c, 「换个配色它还是不是另一个设计？」, answered
   * 「no」 by a section this library shipped fourteen times over.
   *
   * `panel` is Wix's Home Remodeling Company template, shot 2026-08-27 from
   * its own address rather than the store's preview (.screenshots/stores/
   * tpl-wh-1125.png): a filled block holding the heading and the button, with
   * the other half given to something else entirely. They put a photograph
   * there. We put the register's own ground, because we have one -- the dot
   * grid, hatch, diamond and graph textures taken from uiverse-io/galaxy --
   * and because the mid-page ask has no photograph of its own to give. Two
   * sources meeting in one section, neither overwriting the other.
   *
   * `rule` exists because a block of solid colour across the page is the one
   * thing 瑞士 and 工作室 never do anywhere else. Wearing it here made the ask
   * look like it had been pasted in from a different website.
   */
  shape?: "band" | "panel" | "rule"
  /** The panel shape's other half. Empty falls back to a tint of the ground. */
  photo?: string
  photoAlt?: string
}) {
  const buttons = (onColour: boolean) =>
    primaryLabel || secondaryLabel ? (
      <div
        className={
          shape === "band"
            ? "mt-8 flex flex-wrap justify-center [gap:var(--gap-inline)]"
            : "mt-7 flex flex-wrap [gap:var(--gap-inline)]"
        }
      >
        {primaryLabel ? (
          <a
            href={primaryHref || "#"}
            className={
              onColour
                ? "inline-flex min-h-12 items-center [background-color:var(--color-on-primary)] [border-radius:var(--radius-control)] [color:var(--color-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
                : "inline-flex min-h-12 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
            }
          >
            {primaryLabel}
          </a>
        ) : null}
        {secondaryLabel ? (
          <a
            href={secondaryHref || "#"}
            className={
              onColour
                ? "inline-flex min-h-12 items-center border [border-color:color-mix(in_oklab,var(--color-on-primary)_45%,transparent)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
                : "inline-flex min-h-12 items-center border [border-color:var(--border-strong)] [border-radius:var(--radius-control)] [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-medium)] [padding-block:var(--pad-control-y)] [padding-inline:calc(var(--pad-control-x)*1.8)]"
            }
          >
            {secondaryLabel}
          </a>
        ) : null}
      </div>
    ) : null

  if (shape === "rule") {
    return (
      <section
        data-cta-band=""
        data-wide=""
        className="@container [border-top:var(--hairline)_solid_var(--border-strong)] [padding-block-start:calc(var(--pad-card-lg)*1.5)]"
      >
        <div className="flex flex-col justify-between [gap:var(--gap-stack)] @3xl:flex-row @3xl:items-end">
          <div>
            <h2 className="ds-display max-w-[20ch] text-balance [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
              {heading}
            </h2>
            {note ? (
              <p className="mt-4 max-w-[46ch] [color:var(--color-paper-dim)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
                {note}
              </p>
            ) : null}
          </div>
          <div className="shrink-0">{buttons(false)}</div>
        </div>
      </section>
    )
  }

  if (shape === "panel") {
    return (
      <section data-cta-band="" data-wide="" className="@container">
        <div className="grid overflow-hidden [border-radius:var(--radius-lg)] @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="[background:var(--color-primary)] [padding-block:calc(var(--pad-card-lg)*1.8)] [padding-inline:calc(var(--pad-card-lg)*1.2)]">
            <h2 className="ds-display max-w-[16ch] text-balance [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)]">
              {heading}
            </h2>
            {note ? (
              <p className="mt-4 max-w-[40ch] [color:color-mix(in_oklab,var(--color-on-primary)_78%,transparent)] [font-size:var(--text-lg)] [line-height:var(--leading-body)]">
                {note}
              </p>
            ) : null}
            {buttons(true)}
          </div>
          {/* The other half. It is the register's own canvas rather than more
              of the colour, so the section reads as two materials meeting --
              which is the whole shape. It collapses away below @3xl, where a
              second empty column would just be a gap. */}
          {photo?.trim() ? (
            /* THE OTHER HALF IS A PHOTOGRAPH.

               Founder, 2026-08-27: 「你要抄别人家的你就整套都抄」. Side by side with
               the reference at full page, this was the last remaining difference
               in the whole copied page: Wix sets its 「Serving Clients in Your
               Area」 panel beside a picture of two clients, and ours sat beside
               an empty tint. Four photographs against their nine, and this half
               was one of the missing five. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo}
              alt={photoAlt || ""}
              className="hidden size-full object-cover @3xl:block"
            />
          ) : (
          <div
            aria-hidden
            /* A TINT OF THE GROUND, NOT THE GROUND. Rendered on 招牌 -- whose
               canvas is nearly the page's own colour -- the plain canvas made
               this half invisible, so the section read as a colour block with
               a border drawn around some empty air. 8% of the primary keeps
               every register's own hue and guarantees the half is a third
               material: not the block, not the page. */
            className="hidden [background-color:color-mix(in_oklab,var(--color-primary)_8%,var(--color-canvas))] [border:var(--hairline)_solid_var(--border-subtle)] [border-inline-start:0] @3xl:block"
          />
          )}
        </div>
      </section>
    )
  }

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
      {buttons(true)}
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
    /* Padded and top-weighted rather than dropped in the middle: when this
       column carries the register's block colour it IS the panel, and a panel
       whose text starts at the top reads as a page, not as a label floating in
       a rectangle. */
    <div className="flex min-w-0 flex-col justify-center [padding-block:calc(var(--pad-card-lg)*0.9)] [padding-inline:calc(var(--pad-card-lg)*0.9)]">
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

  /* THE RATIO FOLLOWS THE SHAPE, and the reason is a render rather than a
     preference. 4:3 is right in a column beside the words -- roughly 520 wide
     and 390 tall. Applied at FULL width on `stack` the same ratio came out
     1100 x 825, which made a close-up of one pair of hands the largest thing
     on the page, taller than the first screen, on all six registers.
     Photographed 2026-08-27; the founder's word for it was 不好看.
     A picture under a paragraph is the evidence for the paragraph. It is not
     allowed to out-shout the opening. */
  const picture = photo?.trim() ? (
    <div className="min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={photoAlt || ""}
        className="w-full object-cover [border-radius:var(--radius-lg)]"
        style={
          shape === "stack"
            ? { aspectRatio: "21 / 9", maxHeight: "26rem" }
            : { aspectRatio: "4 / 3", maxHeight: "30rem" }
        }
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
    /* THE COLUMNS MATCH HEIGHT INSTEAD OF FLOATING. `items-center` left the
       words centred inside a column as tall as the photograph -- rendered at
       1440 on 2026-08-27, that was three lines of type with about 180px of the
       panel's own colour empty above them and as much below. A panel with its
       content in the middle and air at both ends is the shape that made the
       founder ask 「到底谁有去用啊」. */
    <section className="@container grid items-stretch [gap:calc(var(--gap-stack)*1.5)] @2xl:grid-cols-2">
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

/**
 * 一句话，占一整屏的气。
 *
 * ── WHERE IT COMES FROM ──────────────────────────────────────────────────
 *
 * lapa.ninja, 7,303 landing pages, mined 2026-08-27 after the founder pointed
 * out that the four remaining unmined sources in upstream.json were all ADMIN
 * templates and we are building landing pages. The real-business categories --
 * food & drinks 302, health & fitness 443, education 434 -- were shot as one
 * contact sheet (.screenshots/lapa/real-business.jpg) and looked at.
 *
 * Half the cards turned out to be Webflow and Mobbin ad banners, which is its
 * own lesson about grabbing by image size. Of the ones that were real work --
 * IRONHILL, FLAVORS THAT STAY, Câphê Roasters, MARBLE, Healing Begins With The
 * Breath -- the repeated move is the same in every one: after the first screen
 * comes a QUIET BAND. One sentence, large, centred, on a warm neutral, with
 * nothing else on the screen at all.
 *
 * ── WHY IT ADDS NO WORDS ─────────────────────────────────────────────────
 *
 * It prints the pitch -- the one line the owner already gave in the two-minute
 * questionnaire, which the hero has been printing under the headline since the
 * first version. So this is not a new sentence, it is an argument about WHERE
 * THAT SENTENCE LIVES: under the headline, or alone with a screen to itself.
 * A register whose skeleton names `statement` takes it out of the hero.
 *
 * Writing it twice was never an option: printing one fact in two places on one
 * page is exactly what got 印 culled on 2026-08-26.
 *
 * ── AND WHY IT NEVER SHIPS EMPTY-BUT-PROMPTING ───────────────────────────
 *
 * Unlike SiteCreds, SiteTeam and SiteStory, nothing here is a claim about the
 * world -- no licence, no employee, no years in trade. It is the owner's own
 * description of their own business, which we already have. So it is filled
 * from the first render, and if somebody empties it, it simply disappears.
 */
export function SiteStatement({
  body,
  attribution,
  shape = "centre",
}: {
  body?: string
  /** Optional -- the business name under the line, the way a signed statement
   *  reads. Off by default: a sentence about yourself does not need a byline. */
  attribution?: string
  /** `centre` the sentence alone in the middle · `rule` a hairline above it and
   *  the line set left · `quote` oversized with a hanging opening mark. The
   *  register chooses; see design-doc.ts. */
  shape?: "centre" | "rule" | "quote"
}) {
  const line = body?.trim()
  if (!line) return null

  /* THE SIZE, AND WHY IT IS SET HERE.

     `.ds-display` sets the FACE and nothing else -- every other place that
     uses it also carries a size class, and this one did not. Rendered, the
     band came out at body size in a narrow column: not a statement, just a
     small paragraph with a rule over it.

     Between the headline and the body, not equal to either. The hero is
     --text-hero (38px on 图纸, up to 56 on the loudest registers) and the
     references set this band clearly below that -- it is the second thing
     read, not a competing first. 0.62 keeps every register's own proportion,
     which is the multiplier rule the whole .ds-site finish layer follows. */
  const size = { fontSize: "clamp(1.35rem, calc(var(--text-hero) * 0.62), 2.4rem)", lineHeight: 1.3 }

  /* THE MEASURE IS WIDER THAN A HEADLINE'S, AND THAT IS FROM THE RENDER.

     26ch was copied off the references, where the band holds a short slogan --
     「Grow curiosity. Build confidence.」. Our sentence is the owner's own
     pitch, which is two clauses and about 140 characters, and at 26ch it came
     out six lines deep: a wall of large text rather than a statement. The
     sentence is not shortened to fit, because the second half is the half that
     says how they work. */

  if (shape === "rule") {
    return (
      <section className="@container" data-wide="">
        <div className="[border-top:var(--hairline)_solid_var(--border-subtle)] [padding-block-start:calc(var(--pad-card-lg)*1.6)]">
          <p style={size} className="ds-display max-w-[34ch] [color:var(--color-paper)] [font-weight:var(--fw-medium)] [text-wrap:balance]">
            {line}
          </p>
          {attribution ? (
            <p className="mt-6 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [letter-spacing:var(--tracking-label)]">
              {attribution}
            </p>
          ) : null}
        </div>
      </section>
    )
  }

  if (shape === "quote") {
    return (
      <section className="@container">
        <div className="relative [padding-inline-start:calc(var(--pad-card-lg)*1.2)]">
          {/* Hanging, not inline: a quotation mark that pushes the first word
              across is a mark that has become part of the sentence. */}
          <span
            aria-hidden
            /* NOT --color-primary-soft. That token is a TINT for filling a
               pill behind dark text, and 柔和's is so pale that the mark was
               invisible in the render -- a quotation shape with no quotation
               in it. Mixed straight off the primary instead, which keeps the
               register's own hue and stays visible on every one of them. */
            className="absolute left-0 top-[-0.15em] [color:color-mix(in_oklab,var(--color-primary)_60%,transparent)] [font-size:calc(var(--text-hero)*1.1)] [font-weight:var(--fw-semibold)] [line-height:1]"
          >
            &ldquo;
          </span>
          <p style={size} className="ds-display max-w-[32ch] [color:var(--color-paper)] [font-weight:var(--fw-semibold)] [text-wrap:balance]">
            {line}
          </p>
          {attribution ? (
            <p className="mt-6 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">— {attribution}</p>
          ) : null}
        </div>
      </section>
    )
  }

  /* THE ONE THE REFERENCES ACTUALLY USE. Centred, one measure wide, and the
     vertical padding is what does the work -- the sentence is not big so much
     as ALONE. Every one of the five real pages on the contact sheet gives this
     band more empty space than type. */
  return (
    <section className="@container [padding-block:calc(var(--pad-card-lg)*2.2)] text-center">
      <p style={size} className="ds-display mx-auto max-w-[36ch] [color:var(--color-paper)] [font-weight:var(--fw-medium)] [text-wrap:balance]">
        {line}
      </p>
      {attribution ? (
        <p className="mt-7 [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [letter-spacing:var(--tracking-label)]">
          {attribution}
        </p>
      ) : null}
    </section>
  )
}


/**
 * 一条满边的照片。
 *
 * ── WHY THIS SECTION EXISTS ───────────────────────────────────────────────
 *
 * Counted on 2026-08-27: Wix's Painting Company template carries 14
 * photographs and their Home Remodeling template 6; ours carried between 2 and
 * 5, and every one of them sat inside the page's measure with a radius and a
 * shadow. Two of theirs do not: a photograph runs the full width of the
 * viewport between sections, top and bottom edge to edge, and it is the thing
 * that makes their page read as a place rather than as a document about one.
 *
 * The founder, after being shown ours at full size: 「到底谁有去用啊」.
 *
 * ── AND WHY IT CARRIES NO WORDS BY DEFAULT ────────────────────────────────
 *
 * Because the type over a photograph has no guaranteed contrast and the owner
 * picks the photograph. `line` is optional and, when present, sits on a scrim
 * strong enough to survive whatever they upload -- the same rule 满图压字
 * follows in the hero.
 *
 * It ships EMPTY and publish-projection drops it, like every other section
 * that would otherwise put a grey box on a stranger's screen.
 */
export function SiteBand({
  photo,
  photoAlt,
  line,
  hint,
  height = "tall",
}: {
  photo?: string
  photoAlt?: string
  /** One line over the picture. Optional, and usually better absent. */
  line?: string
  /** Shown to the OWNER while this is still empty. Never published. */
  hint?: string
  /** `tall` a band you scroll through · `short` a rule made of photograph. */
  height?: "tall" | "short"
}) {
  if (!photo?.trim()) {
    if (!hint) return null
    return (
      <section
        data-prompt=""
        data-wide=""
        className="@container [border:1px_dashed_var(--border-strong)] [border-radius:var(--radius-lg)] [padding:var(--pad-card-lg)]"
      >
        <p className="max-w-[56ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {hint}
        </p>
      </section>
    )
  }

  return (
    <section data-bleed="" data-photo-ground="" className="@container relative isolate">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={photoAlt || ""}
        className="block w-full object-cover"
        style={{ height: height === "short" ? "clamp(9rem, 22vh, 15rem)" : "clamp(16rem, 52vh, 30rem)" }}
      />
      {line ? (
        <>
          <span aria-hidden className="absolute inset-0 block" style={{ background: "rgb(0 0 0 / 0.42)" }} />
          <p
            className="ds-display absolute inset-0 mx-auto flex max-w-[28ch] items-center justify-center px-6 text-center [color:#fff] [font-weight:var(--fw-medium)] [text-wrap:balance]"
            style={{ fontSize: "clamp(1.3rem, 3.4vw, 2.2rem)" }}
          >
            {line}
          </p>
        </>
      ) : null}
    </section>
  )
}


/**
 * 四点两栏，照片织在点之间。
 *
 * ── COPIED WHOLE, WHICH IS THE POINT ─────────────────────────────────────
 *
 * Founder, 2026-08-27: 「你要抄别人家的你就整套都抄」. He is right that grafting
 * one section from Wix and one rhythm from Polar onto our own twelve-section
 * page produces a chimera, and that a chimera is exactly why the colours and
 * the rhythms had been fighting.
 *
 * So the whole of Wix's `Home Remodeling` page was broken into its sections
 * (2026-08-27, measured in the browser):
 *
 *     772px  1img   hero: colour band + full-bleed photograph
 *     582px  0img   「Our Expertise」 — a heading and three text items, NO images
 *     455px  1img   a filled panel beside a photograph
 *     479px  0img   「Our Specializations」 — heading, second heading, three cards
 *     683px  1img   a full-bleed band
 *    1068px  2img   「Why Choose Us?」 — THE BIGGEST SECTION ON THE PAGE
 *     289px  3img   reviews, three across
 *     365px  0img   footer
 *
 * Eight sections, 4742px, nine photographs. Ours ran eleven to thirteen
 * sections — longer AND thinner.
 *
 * And the section we had nothing like is the largest one they have: four
 * claims in two columns with PHOTOGRAPHS WOVEN AMONG THEM rather than
 * quarantined into a gallery. That is the structural difference the whole day
 * kept circling: their pictures live inside the argument, ours were locked in
 * a room of their own.
 */
export function SiteWoven({
  heading,
  note,
  points,
  photos,
  hint,
}: {
  heading?: string
  note?: string
  points?: { label: string; value?: string }[]
  /** Two is the reference's number, and the shape is built for two. */
  photos?: string[]
  hint?: string
}) {
  const marks = (points ?? []).filter((p) => p.label?.trim())
  const shots = (photos ?? []).filter((p) => p?.trim())

  if (!marks.length) {
    if (!hint) return null
    return (
      <section
        data-prompt=""
        className="@container [border:1px_dashed_var(--border-strong)] [border-radius:var(--radius-lg)] [padding:var(--pad-card-lg)]"
      >
        <p className="max-w-[56ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{hint}</p>
      </section>
    )
  }

  /* The reference interleaves: two claims, a picture, two claims, a picture.
     Splitting the list rather than putting the pictures in a row is what makes
     the section read as one argument instead of as a list followed by a
     gallery. */
  const half = Math.ceil(marks.length / 2)
  const columns = [marks.slice(0, half), marks.slice(half)]

  return (
    <section className="@container" data-wide="">
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

      <div className="grid [gap:calc(var(--gap-stack)*1.4)] @3xl:grid-cols-2">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col [gap:calc(var(--gap-stack)*1.1)]">
            {col.map((m, i) => (
              <div key={m.label}>
                <p className="flex items-baseline [gap:var(--gap-inline)]">
                  <span
                    aria-hidden
                    className="inline-block size-2 shrink-0 rounded-full [background:var(--color-primary)]"
                  />
                  <span className="[color:var(--color-paper)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)]">
                    {m.label}
                  </span>
                </p>
                {m.value ? (
                  <p className="ml-5 mt-1 max-w-[40ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                    {m.value}
                  </p>
                ) : null}
                {/* THE PICTURE, INSIDE THE ARGUMENT. One per column, after its
                    first claim, exactly where the reference puts them. */}
                {i === 0 && shots[ci] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={shots[ci]}
                    alt=""
                    className="mt-6 w-full object-cover [border-radius:var(--site-radius,var(--radius-lg))]"
                    style={{ aspectRatio: ci === 0 ? "4 / 5" : "5 / 4", maxHeight: "26rem" }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

import Link from "next/link"
import type { ReactNode } from "react"

/**
 * The top bar and the foot of a customer's public website.
 *
 * ── WHY THESE DID NOT EXIST ──────────────────────────────────────────────
 *
 * Because the website was built out of the DASHBOARD's component set, and a
 * dashboard has neither: its navigation is the rail, and it has no foot because
 * it never ends. The founder photographed the result and asked why our
 * generated site looked so different from everyone else's. Measured the same
 * day against nobruf/shadcn-landing-page (MIT, our stack) and two real
 * Malaysian SME sites: all three open with a bar carrying the name and a few
 * links, and all three close with a foot carrying the contact details again.
 *
 * We opened cold on a headline and ended on a form.
 *
 * ── WHY THE FOOT REPEATS WHAT THE PAGE ALREADY SAID ──────────────────────
 *
 * Because that is what a foot is for. A visitor who has read to the bottom has
 * decided; making them scroll back up to find the number is where the decision
 * gets lost. Every reference does it, including the two local ones.
 */

export function SiteBar({
  brand,
  links,
  actionLabel,
  actionHref,
}: {
  brand: ReactNode
  /** The page's own sections. Three or four; a small business does not have
   *  eight, and a bar with eight links on it reads as a company that does. */
  links?: { label: string; href: string }[]
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <header
      /* Sticky, and on the page's own ground with a hairline under it rather
         than a shadow: a shadow on a register whose ground is a texture (瓷's
         floor tile) reads as a smudge, and every register here has a hairline. */
      data-chrome-top=""
      /* `@container`, not a viewport breakpoint: the editor canvas is narrower
         than the window and a phone preview is a 390px box inside a 1440px one.
         Same trap site-hero.tsx documents at length. */
      className="@container sticky top-0 z-30 w-full [background-color:var(--color-canvas)] [border-bottom:var(--hairline)_solid_var(--border-subtle)]"
    >
      <div className="mx-auto flex w-full max-w-[68rem] items-center justify-between [gap:var(--gap-stack)] [padding-block:calc(var(--pad-control-y)*1.1)] [padding-inline:1.5rem]">
        <span className="min-w-0 truncate [color:var(--color-paper)] [font-family:var(--font-display)] [font-size:var(--text-lg)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
          {brand}
        </span>

        {links?.length ? (
          // Hidden on a phone rather than folded into a burger: these are
          // anchors to sections of the SAME page, and on a phone scrolling is
          // the navigation. A burger that opens four in-page anchors is a
          // control that exists to be closed again.
          <nav className="hidden items-center [gap:calc(var(--gap-stack)*1.2)] @2xl:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [transition-duration:var(--dur)] [transition-property:color] hover:[color:var(--color-paper)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
        ) : null}

        {actionLabel ? (
          <a
            href={actionHref || "#"}
            className="inline-flex min-h-9 shrink-0 items-center [background-color:var(--color-primary)] [border-radius:var(--radius-control)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] [padding-block:calc(var(--pad-control-y)*0.7)] [padding-inline:var(--pad-control-x)]"
          >
            {actionLabel}
          </a>
        ) : null}
      </div>
    </header>
  )
}

export function SiteFoot({
  brand,
  tagline,
  rows,
  note,
  links,
  askLabel,
  askHref,
  small,
  copyright,
}: {
  brand: ReactNode
  tagline?: string
  /** The contact details again — number, address, hours. Rows the owner has
   *  not filled are dropped upstream, so an unfilled foot is a name and a line
   *  rather than a column of dashes. */
  rows?: { label: string; value: string }[]
  /** The one line at the very bottom. Not a copyright notice by default: a
   *  renovation contractor does not need one, and it is the only line on the
   *  page that would be about lawyers rather than about work. */
  note?: string
  /*
    THE PAGE'S OWN LINKS AGAIN, AND THE ASK ONE LAST TIME.

    Measured 2026-08-27 against the page this register copies: their foot is
    365px and carries a large 「About Services」 nav, a Contact button and two
    columns of links. Ours was 66px -- a name on a strip -- because its three
    seeded contact rows are stripped on publication and nothing else was ever
    given to it. A visitor who reaches the bottom without pressing anything
    meets a dead end.

    Both of these are already true and already on the page, which is the only
    reason they may be here: the links are the same sections the 顶栏 points at,
    and the ask is the same WhatsApp the hero opens with. Nothing new is
    claimed at the bottom of the page.
  */
  links?: { label: string; href: string }[]
  askLabel?: string
  askHref?: string
  /** 社交 / 条款 —— their footer's two small link columns under the rule. */
  small?: { label: string; href: string }[]
  /** © 2026 名字. Always true, never a claim about the world, and the one line
   *  that stops the page ending on nothing. */
  copyright?: string
}) {
  const filled = (rows ?? []).filter((r) => r.value?.trim())
  const jumps = (links ?? []).filter((l) => l.label?.trim())
  const minor = (small ?? []).filter((l) => l.label?.trim())
  return (
    /*
      THE FOOT WEARS THE REGISTER'S NAVIGATION COLOURS.

      ── THE MEASUREMENT ──────────────────────────────────────────────────
      Sampled 2026-08-27 against five reference sites, converting every pixel
      of a 1440px screenshot to OKLab:

                        ground L*   darkest L*   contrast span
        ours              0.95         0.69          0.31
        linear            0.15         0.11          0.55
        launch-ui         0.15         0.13          0.55
        stripe            1.00         0.60          0.40
        framer            0.00         0.00          0.98

      The darkest pixel on our entire page was L* 0.69. There was nothing dark
      on it at all -- every surface sat in a narrow pale band, which is what
      「感觉是配色的问题」 looks like from the inside. The references either go
      dark or go saturated; we did neither.

      ── WHY THE NAV COLOURS AND NOT A NEW DARK ───────────────────────────
      Every register ALREADY declares a committed dark surface with a
      contrast-checked foreground -- its sidebar. 台账 deep navy, 瓷 charcoal
      brown, 柔和 forest, 漆 oxblood, 夜 near-black. The website has no sidebar,
      which is the entire reason it had no dark area.

      So this is not a new colour decision. It is fourteen colour decisions
      that were already made, already tested (nav-contrast.test.ts), and never
      used on this page. 重点 7c holds: fourteen registers get fourteen
      different feet, not one black one.
    */
    <footer
      data-chrome-foot=""
      className="@container w-full [background-color:var(--color-nav-bg)] [border-top:var(--hairline)_solid_var(--color-nav-border)]"
    >
      <div className="mx-auto flex w-full max-w-[68rem] flex-col [gap:var(--gap-stack)] [padding-block:calc(var(--pad-card-lg)*1.8*var(--site-figure,1))] [padding-inline:1.5rem]">
        <div className="flex flex-wrap items-baseline [gap:var(--gap-inline)]">
          <span className="[color:var(--color-nav-fg)] [font-family:var(--font-display)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] [letter-spacing:var(--tracking-title)]">
            {brand}
          </span>
          {tagline ? (
            <span className="[color:var(--color-nav-fg-dim)] [font-size:var(--text-sm)]">{tagline}</span>
          ) : null}
        </div>

        {jumps.length || askHref ? (
          <div className="flex flex-wrap items-center justify-between [gap:var(--gap-stack)]">
            <nav className="flex flex-wrap [gap:calc(var(--gap-inline)*1.6)]">
              {jumps.map((l) => (
                <a
                  key={l.href + l.label}
                  href={l.href}
                  className="ds-display [color:var(--color-nav-fg)] [font-size:var(--text-title)] [font-weight:var(--fw-semibold)] hover:underline"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            {askHref ? (
              <a
                href={askHref}
                className="inline-flex items-center [background:var(--color-primary)] [border-radius:var(--radius-pill)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-medium)] [padding:0.7rem_1.4rem]"
              >
                {askLabel}
              </a>
            ) : null}
          </div>
        ) : null}

        {/*
          THE BOTTOM BAND.

          Founder, 2026-08-27, on a crop of our foot next to theirs: 「还是抄的
          不完全」. Theirs does not stop at the nav -- under a hairline it runs
          three columns: the address, the phone and email, and the copyright.
          Ours stopped at the nav, which is why the page still ended abruptly.

          What is NOT copied is the half of theirs that is noise: a San
          Francisco address that belongs to nobody and 「Powered and secured by
          Wix」. The columns that carry something go in; the columns that carry
          somebody else's advertising do not.

          The contact column is empty on a page whose owner has not typed their
          own number, and that is correct -- 假联络资料不再上线. The copyright is
          always there, because it is the one line that is true on every page.
        */}
        {filled.length || minor.length || copyright ? (
          <div className="grid [border-top:var(--hairline)_solid_var(--color-nav-border)] [gap:var(--gap-stack)] [padding-top:var(--gap-stack)] @2xl:grid-cols-3">
            <dl>
              {filled.map((r) => (
                <div key={r.label} className="mb-2">
                  <dt className="[color:var(--color-nav-fg-dim)] [font-size:var(--text-xs)] [letter-spacing:var(--tracking-label)] [text-transform:var(--label-transform)]">
                    {r.label}
                  </dt>
                  <dd className="[color:var(--color-nav-fg)] [font-size:var(--text-sm)]">{r.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="flex flex-col [gap:.35rem]">
              {minor.map((l) => (
                <li key={l.href + l.label}>
                  <a href={l.href} className="[color:var(--color-nav-fg-dim)] [font-size:var(--text-sm)] hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            {copyright ? (
              <p className="[color:var(--color-nav-fg-dim)] [font-size:var(--text-sm)]">{copyright}</p>
            ) : null}
          </div>
        ) : null}

        {note ? (
          <p className="[border-top:var(--hairline)_solid_var(--color-nav-border)] [color:var(--color-nav-fg-dim)] [font-size:var(--text-xs)] [padding-top:var(--gap-stack)]">
            {note}
          </p>
        ) : null}
      </div>
    </footer>
  )
}

/** Kept so a hand-written page can still link out; unused by the generator. */
export const SiteLink = Link

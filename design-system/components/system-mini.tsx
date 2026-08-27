"use client"

import { useEffect, useRef, useState } from "react"
import { Render, type Data, type Config } from "@puckeditor/core"

/**
 * 他自己的系统，缩小放在官网第一屏上。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Put beside linear, vercel and resend on 2026-08-27, the biggest remaining
 * gap in our first screen was not colour and not type: their object is DENSE
 * and real -- linear shows its own application -- and ours was a drawn
 * quotation with three lines and a great deal of white.
 *
 * The drawn figure cannot honestly be made denser. hero-figure.tsx carries the
 * rule and it is the right one: no figure states a price, an amount or a date
 * the owner did not give us, because this is published on a real company's
 * page and a stranger does not read corner badges. Filling the space with
 * 「RM 48,500」 would be the same class of error as the seeded phone number that
 * went out live on 2026-08-26.
 *
 * So the object becomes the thing that is BOTH real and dense: the dashboard
 * this business already has. Not a mock of it -- the same layout the same
 * builder produces for the owner's own screen. It is also the product's own
 * claim (看到的就是拿到的) making its argument in the one place a stranger looks
 * first, which is the one thing a website builder cannot copy: Wix has no
 * system to show.
 *
 * ── WHY IT COMPOSES WIDE AND THEN SCALES ──────────────────────────────────
 *
 * Every block sizes itself from density tokens (--row-h, --pad-cell-x,
 * --text-*), so rendering into a 700px box would produce a genuinely different
 * cramped layout rather than a small picture of the real one. Same argument
 * page-preview.tsx makes for the style gallery; this is its lighter sibling --
 * no travelling strip, no crossfade, because a hero shows one page and stays
 * still.
 *
 * ── WHY THE CONFIG ARRIVES LATE ───────────────────────────────────────────
 *
 * Importing it at module scope is a cycle: puck-config imports site-hero,
 * site-hero imports this, and this would import puck-config back. Vitest saw
 * it first -- five suites failed with 「Cannot read properties of undefined
 * (reading 'components')」, which is what a half-initialised module looks like
 * from the far side of a loop.
 *
 * So the config is fetched in an effect. The miniature is decorative and
 * `aria-hidden`, so appearing a beat after hydration costs nothing a visitor
 * can act on -- and a beat is the honest price of not restructuring the whole
 * registry to put a picture on a page.
 *
 * ── WHY IT IS INERT ───────────────────────────────────────────────────────
 *
 * `pointer-events: none` and `aria-hidden`. It is a picture of a system, and a
 * visitor who tabs into a scaled-down navigation rail is a visitor lost inside
 * an illustration.
 */
export function SystemMini({ data }: { data: unknown }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    let live = true
    void import("@/design-system/editor/puck-config-client").then((m) => {
      if (live) setConfig(m.registerAwarePuckConfig as unknown as Config)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    /* A ResizeObserver rather than a container query: scale() needs a unitless
       number and `calc(100cqw / 1180)` resolves to a length, which it rejects.
       Same reason page-preview.tsx measures instead of querying. */
    const ro = new ResizeObserver(() => setScale(el.clientWidth / COMPOSE_W))
    ro.observe(el)
    setScale(el.clientWidth / COMPOSE_W)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={box}
      aria-hidden
      className="relative w-full overflow-hidden [border:var(--hairline)_solid_var(--border-subtle)] [border-radius:var(--radius-lg)]"
      style={{ height: scale ? COMPOSE_H * scale : undefined, aspectRatio: scale ? undefined : "16 / 10" }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: COMPOSE_W, height: COMPOSE_H, transform: `scale(${scale})` }}
      >
        {config ? <Render config={config} data={data as Data} /> : null}
      </div>
    </div>
  )
}

/** Composed at roughly the editor canvas width, so the miniature keeps the
 *  proportions the owner saw while editing. */
const COMPOSE_W = 1180
/** How much of the page the object shows. A dashboard is much taller than a
 *  hero slot; cropping here is what lets it run off the bottom the way every
 *  reference's object does. */
const COMPOSE_H = 740

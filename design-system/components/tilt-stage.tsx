"use client"

import { useRef, type ReactNode } from "react"

/**
 * 会跟着手转的那一块 —— the first screen's figure, on a plane.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * The founder, 2026-08-27: 「你可以看到现在的landing pages 大家都做的多么的好啊
 * 加一点动效 3D的 有交互感的」. He is describing the one thing every current
 * landing page does that a generated page does not: the largest object on the
 * first screen is not a flat rectangle. It sits on a plane, it catches light,
 * and it answers the pointer.
 *
 * ── WHY IT IS FOUR DEGREES AND NOT FIFTEEN ────────────────────────────────
 *
 * This runs on a Kuala Lumpur homeowner's mid-range Android while they decide
 * whether to message a contractor. A card that swings is a card that is showing
 * off; a card that leans a few degrees under the finger reads as a real object
 * and costs nothing. Every reference that does this does it small.
 *
 * ── WHAT IT COSTS ─────────────────────────────────────────────────────────
 *
 * One passive pointermove listener that writes two custom properties, and a
 * transform the compositor owns. No state, no re-render, no layout: React never
 * hears about the movement at all, which is why this can sit in a page that
 * also renders sixty other blocks.
 *
 * On a touch screen there is no pointer, so nothing fires and the card stays
 * square -- which is correct, because a phone has no hover and the tilt would
 * only ever be a jump on tap. Under `prefers-reduced-motion` the transform is
 * disabled in CSS and this component still mounts; the listener writes
 * properties nobody reads, which is cheaper than branching on a media query
 * that can change while the page is open.
 */
export function TiltStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      data-tilt=""
      onPointerMove={(e) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        // −0.5 … 0.5 from the centre, so the card leans away from the finger
        // the way a sheet of card on a table does.
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        el.style.setProperty("--tilt-x", String(-y * 8))
        el.style.setProperty("--tilt-y", String(x * 8))
        el.style.setProperty("--tilt-lx", `${(x + 0.5) * 100}%`)
        el.style.setProperty("--tilt-ly", `${(y + 0.5) * 100}%`)
      }}
      onPointerLeave={() => {
        const el = ref.current
        if (!el) return
        el.style.setProperty("--tilt-x", "0")
        el.style.setProperty("--tilt-y", "0")
      }}
    >
      {children}
    </div>
  )
}

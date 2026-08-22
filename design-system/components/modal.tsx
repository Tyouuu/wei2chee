"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

/**
 * A centered dialog, portaled to `document.body`.
 *
 * Portaling matters more than it looks like it should: a modal rendered
 * inline inside a row (or any other element with its own stacking context —
 * e.g. `position: relative; z-index: n`) inherits that ancestor's stacking
 * context. Two sibling rows that each carry the same z-index for an
 * unrelated reason (e.g. so a row's action column can escape a
 * stretched full-row link) will then have their z-index values compete
 * against *each other* in DOM order — which means a later row's button can
 * be clicked right through an earlier row's still-open modal backdrop,
 * since that backdrop is trapped inside the earlier row's losing stacking
 * context. Portaling to `document.body` — one shared ancestor outside every
 * row's stacking context — is what actually fixes this; no z-index value
 * chosen locally can, because the bug is about *which* stacking context the
 * modal belongs to, not what number it carries within it.
 *
 * The scrim is deliberately plain black, not a token colour: dimming
 * whatever's behind the modal needs to work the same way regardless of
 * which of this design system's token sets is currently active.
 *
 * Ported and generalized from a real client codebase's `modal.tsx`.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Callers are expected to start `open` as local state defaulting to
  // false and only flip it true from a client-side event handler — so
  // `open` should never be true during a server render, and `document.body`
  // below should never be reached before it exists.
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 [padding:var(--pad-card)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`ds-overlay w-full max-w-sm [padding:var(--pad-card)] ${className ?? ""}`}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

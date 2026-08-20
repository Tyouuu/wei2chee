"use client"

import { useRef, useState, type ReactNode } from "react"
import { Modal } from "./modal"

/**
 * A submit button that confirms in an app-styled modal before actually
 * submitting the surrounding form, instead of the browser's own native
 * `confirm()` — which is unstyled and reads as coming from the browser/OS
 * rather than the app it interrupted.
 *
 * Drops into an existing `<form>` unchanged: rendered as a plain
 * `type="button"` (so it never submits on its own click), and on confirm it
 * calls `form?.requestSubmit()` on the form it's already inside, which is
 * exactly what a real `type="submit"` button would have done.
 *
 * Ported and generalized from a real client codebase's
 * `confirm-submit-button.tsx`.
 */
export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
}: {
  children: ReactNode
  className: string
  confirmMessage: string
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  function confirmAndSubmit() {
    setOpen(false)
    buttonRef.current?.form?.requestSubmit()
  }

  return (
    <>
      <button ref={buttonRef} type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <p className="[font-size:var(--text-base)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">{confirmMessage}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="[border-radius:var(--radius-md)] border [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] transition-colors [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)]"
          >
            Cancel
          </button>
          <button type="button" onClick={confirmAndSubmit} className={className}>
            Confirm
          </button>
        </div>
      </Modal>
    </>
  )
}

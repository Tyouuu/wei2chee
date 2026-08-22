"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import { useSystemWords } from "@/design-system/system-lang-context"

/**
 * A file-attachment box: click (or tap) anywhere in it to open the file
 * picker, and the chosen filename is shown back in its place — an upload
 * control that gives no sign it took the file is one people click twice.
 *
 * Client-only so the chosen filename can be echoed back immediately; actual
 * size/type validation belongs on whatever server action or route handler
 * receives the file, not here.
 *
 * Two ways to use it, matching two real shapes of upload flow:
 *   - Uncontrolled (no `onUpload`): renders a real `name`d file input, so it
 *     posts as part of a plain server-rendered `<form>` with zero wiring.
 *   - Controlled (`onUpload` passed): the caller owns the actual upload
 *     (e.g. it goes straight to storage via its own RPC rather than being
 *     posted with the rest of the form) and also owns the filename shown
 *     back, via `uploadedName`. Everything visible is identical either way
 *     — two upload boxes on one page that looked or behaved differently is
 *     the failure mode this component exists to remove.
 *
 * Ported and generalized from a real client codebase's `receipt-field.tsx`
 * — there, a domain-specific component for one particular document type
 * tied to one particular storage bucket. Generalized here into a plain
 * `FileUploadField`: the accept-string is now a caller-supplied `accept`
 * prop instead of an app-specific constant, and the callback is renamed
 * `onUpload` to describe what it's for rather than what UI event fired it.
 * Kept in this file (`receipt-field.tsx`) for now — the rename is tracked
 * as a follow-up, not blocking.
 */
export function FileUploadField({
  label = "Attach a file",
  hint,
  name = "file",
  accept,
  onUpload,
  uploadedName,
}: {
  label?: string
  /** Says what's expected here, in the caller's own words — e.g. "PDF or photo, up to 10MB". */
  hint: string
  /** The field name in the posted form. Ignored once `onUpload` is passed. */
  name?: string
  /** Restricts the file picker — e.g. `"image/*,.pdf"`. Omit to accept anything. */
  accept?: string
  /** Set when the caller uploads the file itself rather than posting it with the form. It then owns the shown filename too, via `uploadedName`. */
  onUpload?: (file: File | null) => void
  uploadedName?: string | null
}) {
  const w = useSystemWords()
  const [ownName, setOwnName] = useState<string | null>(null)
  const shownName = onUpload ? (uploadedName ?? null) : ownName

  return (
    <div>
      <span className="block [font-size:var(--text-sm)] tracking-[var(--tracking-sm)] text-[color:var(--color-paper)] [font-weight:var(--fw-medium)]">
        {label} <span className="text-[color:var(--color-paper-dim)] [font-weight:var(--fw-medium)]">（{w.optional}）</span>
      </span>
      <label className="mt-1.5 flex cursor-pointer items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] border border-dashed [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-paper-dim)] transition-colors [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]">
        <Upload aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className={shownName ? "truncate" : "min-w-0 text-left"}>{shownName ?? w.uploadPrompt}</span>
        <input
          type="file"
          name={onUpload ? undefined : name}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            if (onUpload) onUpload(file)
            else setOwnName(file?.name ?? null)
          }}
        />
      </label>
      <p className="mt-2 [font-size:var(--text-xs)] text-[color:var(--color-paper-dim)]">{hint}</p>
    </div>
  )
}

"use client"

import { useId, type ReactNode } from "react"

/**
 * A labelled form field with the label properly associated with its control
 * via a real `id`/`htmlFor` pair, generated once per field and handed to the
 * caller through a render-prop.
 *
 * Render-prop rather than `cloneElement`-based children: cloning breaks
 * silently the moment a caller wraps its control in anything (a positioning
 * wrapper, an icon slot), and a control is not always a bare `<input>` —
 * custom controls like a date picker or a combobox need the same id wired
 * onto whatever DOM node they render as their focusable element.
 *
 * `Field` only generates and displays the id; it does not attach
 * `aria-describedby` for you. The caller renders `children(id)` and is
 * responsible for passing that id — and, when `error` is set,
 * `aria-describedby={`${id}-error`}` — to the control it renders. That
 * responsibility is what the function-typed `children` prop encodes: there
 * is no way to call this component and end up with an unassociated label,
 * because the id can only reach the control through the render-prop.
 *
 * Ported and generalized from a real client codebase's `field.tsx`, written
 * to remove a systemic bug: every field in that app rendered a `<label>` as
 * a plain sibling of its control, with no `htmlFor` and no wrapping, so a
 * screen reader reaching the field could not say what it was for and
 * clicking the label did not focus the control. An automated accessibility
 * scan only caught a fraction of the instances, because it accepts a
 * placeholder as a fallback accessible name and most inputs happened to
 * have one — which made a systemic problem look like a handful of one-offs.
 * This component removes the whole class of bug rather than the instances.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  /** Sits under the control. Explains the field; never repeats the label. */
  hint?: ReactNode
  /** Shown in place of the hint when present — an error belongs beside the
      field it describes, not collected at the top of the form. */
  error?: string
  required?: boolean
  /** Render-prop: receives the field's generated id. Wire it as the `id`
      (and, when `error` is set, `aria-describedby={`${id}-error`}`) on
      whatever control you render. */
  children: (id: string) => ReactNode
}) {
  const id = useId()

  return (
    <div>
      <label
        htmlFor={id}
        className="block [font-size:var(--text-sm)] tracking-[var(--tracking-sm)] text-[color:var(--color-paper)] [font-weight:var(--fw-medium)]"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-[color:var(--color-clay-bright)]">
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children(id)}</div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 [font-size:var(--text-xs)] [font-weight:var(--fw-medium)] text-[color:var(--color-clay-bright)]"
        >
          {error}
        </p>
      ) : hint ? (
        <span id={`${id}-hint`} className="mt-1 block [font-size:var(--text-xs)] text-[color:var(--color-paper-dim)]">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

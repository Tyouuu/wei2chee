"use client"

import { useEffect, useMemo, useRef, useState } from "react"

/**
 * A plain text field that also suggests matches as you type — unlike
 * `Combobox` (strict: the value must be one of its options), this never
 * rejects free text. Meant for fields where the suggestion list is a set of
 * known-good values but not an exhaustive one, so a forced-choice select
 * would block entering a value that legitimately isn't in the preset list
 * yet.
 *
 * Ported and generalized from a real client codebase's
 * `text-autocomplete.tsx`, where it backed one specific free-text field
 * whose suggestions came from a normalization helper that only snapped a
 * known value to its canonical casing and never rejected an unknown one —
 * the same shape as any "known values, but not a closed set" field.
 */
export function TextAutocomplete({
  name,
  value,
  defaultValue,
  onChange,
  suggestions,
  placeholder,
  required,
}: {
  name: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
}) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? "")
  const current = isControlled ? (value ?? "") : internal
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  function set(v: string) {
    if (!isControlled) setInternal(v)
    onChange?.(v)
  }

  const filtered = useMemo(() => {
    const q = current.trim().toLowerCase()
    if (!q) return suggestions
    return suggestions.filter((s) => s.toLowerCase().includes(q))
  }, [suggestions, current])

  return (
    <div className="relative" ref={ref} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <input
        ref={inputRef}
        name={name}
        type="text"
        value={current}
        onChange={(e) => {
          set(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full [border-radius:var(--radius-md)] border [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none transition-colors [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] placeholder:text-[color:var(--color-paper-dim)] focus-visible:[border-color:var(--color-primary)]"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-auto z-10 mt-1 max-h-56 w-full min-w-full overflow-y-auto [border-radius:var(--radius-md)] border p-1.5 [box-shadow:var(--shadow-raised)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                set(s)
                setOpen(false)
                inputRef.current?.focus()
              }}
              className={`block w-full [border-radius:var(--radius-md)] px-2.5 py-2 text-left [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)] transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-primary-soft)] ${
                s === current ? "text-[color:var(--color-primary-deep)] [background-color:var(--color-primary-soft)]" : "text-[color:var(--color-paper)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

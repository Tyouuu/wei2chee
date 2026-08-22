"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { useSystemWords } from "@/design-system/system-lang-context"

export type ListboxOption = { value: string; label: string; dotColor?: string }

/**
 * A single-select dropdown, self-contained by default: pass `name` and it
 * writes a hidden input, so it drops into any plain server-rendered
 * `<form>` with no client-side wiring beyond `defaultValue`/`options`. Also
 * supports controlled usage (`value`/`onChange`) for cases where the
 * selection needs to drive other client-side state.
 *
 * Ported and generalized from a real client codebase's `listbox.tsx`.
 */
export function Listbox({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options,
  placeholder,
}: {
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options: ListboxOption[]
  /** Shown when nothing is selected. */
  placeholder?: string
}) {
  const w = useSystemWords()
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value ?? "")
  const value = isControlled ? controlledValue : internalValue
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  function closePanel() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function pick(v: string) {
    if (!isControlled) setInternalValue(v)
    onChange?.(v)
    closePanel()
  }

  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative" ref={ref} onKeyDown={(e) => e.key === "Escape" && closePanel()}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 [border-radius:var(--radius-md)] border [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-left [font-size:var(--text-sm)] text-[color:var(--color-paper)] transition-colors [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)]"
      >
        {selected?.dotColor && (
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: selected.dotColor }} />
        )}
        <span className="flex-1 truncate">{selected?.label ?? placeholder ?? w.pickOne}</span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--color-paper-dim)] transition-transform [transition-duration:var(--dur-fast)] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-10 mt-1 w-full min-w-full [border-radius:var(--radius-md)] border p-1.5 [box-shadow:var(--shadow-raised)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              onClick={() => pick(o.value)}
              className={`flex w-full items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] px-2.5 py-2 text-left [font-size:var(--text-sm)] text-[color:var(--color-paper)] transition-colors [font-weight:var(--fw-semibold)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-primary-soft)] ${
                value === o.value ? "[background-color:var(--color-primary-soft)]" : ""
              }`}
            >
              {o.dotColor && (
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.dotColor }} />
              )}
              <span className="flex-1 truncate">{o.label}</span>
              {value === o.value && (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-primary)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

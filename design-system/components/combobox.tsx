"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, ChevronDown, Search } from "lucide-react"

export type ComboboxOption = {
  value: string
  label: string
  sublabel?: string
  /** Optional leading visual for the option — an avatar, an initials chip,
      an icon — supplied by the caller. Kept as a plain render slot rather
      than a component this file owns, so `Combobox` has no dependency on
      any one avatar/icon implementation. */
  icon?: ReactNode
}

/**
 * A searchable single-select, fully controlled (`value`/`onChange`) —
 * unlike `Listbox`, which also supports an uncontrolled/self-contained
 * mode. A controlled component is needed here because callers that reach
 * for search typically also need the selection to drive other state (e.g.
 * auto-filling related fields, a "recent selections" shortcut list); a
 * hidden-input-only component isn't enough for that.
 *
 * Ported and generalized from a real client codebase's `combobox.tsx`.
 */
export function Combobox({
  name,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "搜索…",
  emptyMessage = "没有找到结果。",
}: {
  name?: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder?: string
  /** Shown when the search query matches nothing. */
  emptyMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  function openPanel() {
    setQuery("")
    setOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  function closePanel() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative" ref={ref} onKeyDown={(e) => e.key === "Escape" && closePanel()}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : openPanel())}
        className="flex w-full items-center gap-2 [border-radius:var(--radius-md)] border [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-left [font-size:var(--text-sm)] transition-colors [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)]"
      >
        {selected?.icon}
        <span
          className={`flex-1 truncate ${
            selected ? "text-[color:var(--color-paper)]" : "text-[color:var(--color-paper-dim)]"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--color-paper-dim)] transition-transform [transition-duration:var(--dur-fast)] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-full overflow-hidden [border-radius:var(--radius-md)] border [box-shadow:var(--shadow-raised)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
          <div className="flex items-center gap-2 border-b [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] [border-color:var(--color-ink-800)]">
            <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-paper-dim)]" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent [font-size:var(--text-sm)] text-[color:var(--color-paper)] outline-none placeholder:text-[color:var(--color-paper-dim)]"
            />
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length ? (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  onClick={() => {
                    onChange(o.value)
                    closePanel()
                  }}
                  className={`flex w-full items-center [gap:var(--gap-inline)] [border-radius:var(--radius-md)] px-2 py-2 text-left transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-primary-soft)] ${
                    value === o.value ? "[background-color:var(--color-primary-soft)]" : ""
                  }`}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate [font-size:var(--text-sm)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
                      {o.label}
                    </span>
                    {o.sublabel && (
                      <span className="block truncate [font-size:var(--text-xs)] text-[color:var(--color-paper-dim)]">{o.sublabel}</span>
                    )}
                  </span>
                  {value === o.value && (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-primary)]" />
                  )}
                </button>
              ))
            ) : (
              <p className="px-3 py-6 text-center [font-size:var(--text-sm)] text-[color:var(--color-paper-dim)]">{emptyMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

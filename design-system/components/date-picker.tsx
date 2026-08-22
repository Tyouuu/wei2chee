"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { useSystemWords } from "@/design-system/system-lang-context"

// Weekday initials and month names follow the system language --
// design-system/system-words.ts. A picker that still says 「3月」 inside an
// English system is the most visible half of a half-done translation.

function parseISO(v: string | undefined): { y: number; m: number; d: number } | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [y, m, d] = v.split("-").map(Number)
  return { y, m: m - 1, d }
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

// A locale-respecting display formatter, not a fixed pattern — a shared
// design-system component shouldn't assume any one app's date-formatting
// convention (or its i18n library) the way the real source's own
// app-specific formatter did.
function formatDisplay(iso: string): string {
  const parsed = parseISO(iso)
  if (!parsed) return iso
  return new Date(parsed.y, parsed.m, parsed.d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

function firstWeekday(y: number, m: number): number {
  return new Date(y, m, 1).getDay()
}

/**
 * A calendar-grid date field. Controlled (`value`/`onChange`) or
 * uncontrolled (`defaultValue`, writes a hidden input so it drops into a
 * plain server-rendered `<form>` with zero client wiring) — the same
 * controlled/uncontrolled split as `Listbox` vs `Combobox`.
 *
 * `todayIso` is a prop rather than read from `new Date()` internally so a
 * server-rendered "today" (whichever timezone the app's server considers
 * canonical) and the client's picker never disagree about which cell is
 * "today" — the same reasoning `MonthPicker` documents for its own `today`
 * prop.
 *
 * Ported and generalized from a real client codebase's `date-picker.tsx`.
 */
export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  placeholder,
  allowClear = false,
  required,
  todayIso,
}: {
  name: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  min?: string
  max?: string
  placeholder?: string
  allowClear?: boolean
  required?: boolean
  todayIso?: string
}) {
  const isControlled = value !== undefined
  const w = useSystemWords()
  const [internal, setInternal] = useState(defaultValue ?? "")
  const current = isControlled ? (value ?? "") : internal
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const anchor =
    parseISO(current) ?? parseISO(max) ?? parseISO(todayIso) ?? { y: new Date().getFullYear(), m: new Date().getMonth(), d: 1 }
  const [viewY, setViewY] = useState(anchor.y)
  const [viewM, setViewM] = useState(anchor.m)

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

  function closePanel() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function openPanel() {
    const a = parseISO(current) ?? parseISO(max) ?? parseISO(todayIso)
    if (a) {
      setViewY(a.y)
      setViewM(a.m)
    }
    setOpen((o) => !o)
  }

  function isDisabled(iso: string) {
    if (min && iso < min) return true
    if (max && iso > max) return true
    return false
  }

  function pick(day: number) {
    const iso = toISO(viewY, viewM, day)
    if (isDisabled(iso)) return
    set(iso)
    closePanel()
  }

  function changeMonth(delta: number) {
    let m = viewM + delta
    let y = viewY
    if (m < 0) {
      m = 11
      y -= 1
    } else if (m > 11) {
      m = 0
      y += 1
    }
    setViewM(m)
    setViewY(y)
  }

  const total = daysInMonth(viewY, viewM)
  const lead = firstWeekday(viewY, viewM)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  const selected = parseISO(current)
  const today = parseISO(todayIso)

  return (
    <div className="relative" ref={ref} onKeyDown={(e) => e.key === "Escape" && closePanel()}>
      <input type="hidden" name={name} value={current} required={required} />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={openPanel}
        className="flex w-full items-center gap-2 [border-radius:var(--radius-md)] border [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-left [font-size:var(--text-sm)] text-[color:var(--color-paper)] transition-colors [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)] [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)]"
      >
        <CalendarDays aria-hidden="true" className="h-[15px] w-[15px] shrink-0 text-[color:var(--color-paper-dim)]" />
        <span className={current ? "" : "text-[color:var(--color-paper-dim)]"}>{current ? formatDisplay(current) : (placeholder ?? w.pickDate)}</span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--color-paper-dim)] transition-transform [transition-duration:var(--dur-fast)] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-[280px] [border-radius:var(--radius-md)] border p-0 [box-shadow:var(--shadow-raised)] [background-color:var(--color-ink-900)] [border-color:var(--color-ink-800)]">
          <div className="flex items-center justify-between [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]">
            <button
              type="button"
              aria-label={w.prevMonth}
              className="grid h-6 w-6 place-items-center [border-radius:var(--radius-sm)] border text-[color:var(--color-paper-dim)] [border-color:var(--color-ink-800)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft aria-hidden="true" className="h-3 w-3" />
            </button>
            <span className="[font-size:var(--text-sm)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
              {w.months[viewM]} {viewY}
            </span>
            <button
              type="button"
              aria-label={w.nextMonth}
              className="grid h-6 w-6 place-items-center [border-radius:var(--radius-sm)] border text-[color:var(--color-paper-dim)] [border-color:var(--color-ink-800)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight aria-hidden="true" className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 px-3">
            {w.weekdays.map((day, i) => (
              <span
                key={i}
                className="grid h-6 place-items-center [font-size:var(--text-micro)] uppercase [font-weight:var(--fw-semibold)] text-[color:color-mix(in_srgb,var(--color-paper-dim)_70%,transparent)]"
              >
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 px-3 pb-3">
            {cells.map((day, i) => {
              if (day == null) return <span key={i} />
              const iso = toISO(viewY, viewM, day)
              const disabled = isDisabled(iso)
              const isSelected = !!selected && selected.y === viewY && selected.m === viewM && selected.d === day
              const isToday = !!today && today.y === viewY && today.m === viewM && today.d === day
              return (
                <button
                  type="button"
                  key={i}
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={`grid h-8 w-8 place-items-center [border-radius:var(--radius-md)] [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] transition-colors [transition-duration:var(--dur-fast)] ${
                    disabled
                      ? "cursor-not-allowed text-[color:color-mix(in_srgb,var(--color-paper-dim)_30%,transparent)]"
                      : isSelected
                        ? "[background-color:var(--color-primary)] [color:var(--color-on-primary)]"
                        : isToday
                          ? "border-[1.5px] text-[color:var(--color-paper)] [border-color:var(--color-ink-800)] hover:[background-color:var(--color-ink-850)]"
                          : "text-[color:var(--color-paper)] hover:[background-color:var(--color-ink-850)]"
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-xs [font-weight:var(--fw-semibold)] [border-color:var(--color-ink-800)]">
            {allowClear ? (
              <button
                type="button"
                className="text-[color:var(--color-paper-dim)] hover:underline"
                onClick={() => {
                  set("")
                  closePanel()
                }}
              >
                Clear
              </button>
            ) : (
              <span />
            )}
            {todayIso && !isDisabled(todayIso) && (
              <button
                type="button"
                className="text-[color:var(--color-primary-deep)] hover:underline"
                onClick={() => {
                  const t = parseISO(todayIso)!
                  setViewY(t.y)
                  setViewM(t.m)
                  set(todayIso)
                  closePanel()
                }}
              >
                Today
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useSystemWords } from "@/design-system/system-lang-context";

// Month names follow the system language, so a system switched to English
// does not still say 「3月」 the moment anyone opens the picker.
// See design-system/system-words.ts.
function formatLabel(value: string, months: string[]): string {
  if (!value) return "";
  const [y, m] = value.split("-").map(Number);
  return `${months[m - 1]} ${y}`;
}

// `today` is "YYYY-MM", the same shape this component's own value already
// uses — pass whatever your server considers canonical "today" (its own
// clock/timezone), since falling back to the browser's clock below would
// disagree with a server-computed "today" for any user whose device isn't
// on the same clock.
function currentYearMonth(today?: string): [number, number] {
  if (today) {
    const [y, m] = today.split("-").map(Number);
    return [y, m - 1];
  }
  const now = new Date();
  return [now.getFullYear(), now.getMonth()];
}

/**
 * A year/month grid picker. Self-contained: writes a hidden input, so it
 * drops into a plain server-rendered `<form>` (GET or POST) with zero
 * wiring beyond `name`/`defaultValue` — no controlled state needed from the
 * parent.
 *
 * Ported and generalized from a real client codebase's `month-picker.tsx`.
 */
export function MonthPicker({
  name,
  defaultValue,
  placeholder,
  allowClear = false,
  today,
  submitOnPick = false,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  allowClear?: boolean;
  today?: string;
  /**
   * Submit the surrounding form as soon as a month is chosen, instead of
   * waiting for a button beside it. For a picker that is the *only*
   * control in its form, a separate submit button is a second step that
   * says nothing the choice didn't already say.
   */
  submitOnPick?: boolean;
}) {
  const w = useSystemWords();
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    defaultValue
      ? Number(defaultValue.split("-")[0])
      : currentYearMonth(today)[0],
  );
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const [todayY, todayM] = currentYearMonth(today);
  const selY = value ? Number(value.split("-")[0]) : null;
  const selM = value ? Number(value.split("-")[1]) - 1 : null;

  function closePanel() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(monthIdx: number) {
    setValue(`${viewYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    closePanel();
    // After the state lands, so the hidden input carries the new month
    // rather than the one it's replacing.
    if (submitOnPick) {
      requestAnimationFrame(() => triggerRef.current?.form?.requestSubmit());
    }
  }

  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(e) => e.key === "Escape" && closePanel()}
    >
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        /* 🔴 **44 只给触控那一边**（2026-09-07）：390 上量出来 42px —— 差两个像素。
           `sm:min-h-0` —— 电脑那一边照旧。 */
        className="ds-control flex min-h-11 w-full items-center gap-2 [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-left [font-size:var(--text-sm)] text-[color:var(--color-paper)] transition-colors [transition-duration:var(--dur-fast)] hover:[background-color:var(--color-ink-850)] sm:min-h-0"
      >
        <CalendarDays
          aria-hidden="true"
          className="h-[15px] w-[15px] shrink-0 text-[color:var(--color-paper-dim)]"
        />
        <span className={value ? "" : "text-[color:var(--color-paper-dim)]"}>
          {value ? formatLabel(value, w.months) : (placeholder ?? w.pickMonth)}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--color-paper-dim)] transition-transform [transition-duration:var(--dur-fast)] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        // left-0 right-auto overrides this component's default right-
        // anchoring — on a phone-width filter bar, a compact/narrow trigger
        // would otherwise anchor a wider panel's right edge to its own
        // narrow right edge, pushing the panel's left edge off-screen.
        // Anchoring from the trigger's left edge keeps it on-screen
        // wherever this compact trigger is used.
        <div className="ds-raised absolute left-0 right-auto z-10 mt-1 w-[260px] [border-radius:var(--radius-md)] p-0">
          <div className="flex items-center justify-between [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)]">
            <button
              type="button"
              aria-label={w.prevYear}
              className="grid h-6 w-6 place-items-center [border-radius:var(--radius-sm)] border text-[color:var(--color-paper-dim)] [border-color:var(--color-ink-800)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
              onClick={() => setViewYear((y) => y - 1)}
            >
              <ChevronLeft aria-hidden="true" className="h-3 w-3" />
            </button>
            <span className="[font-size:var(--text-sm)] text-[color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
              {viewYear}
            </span>
            <button
              type="button"
              aria-label={w.nextYear}
              className="grid h-6 w-6 place-items-center [border-radius:var(--radius-sm)] border text-[color:var(--color-paper-dim)] [border-color:var(--color-ink-800)] hover:[background-color:var(--color-ink-850)] hover:text-[color:var(--color-paper)]"
              onClick={() => setViewYear((y) => y + 1)}
            >
              <ChevronRight aria-hidden="true" className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
            {w.months.map((m, i) => {
              const isToday = viewYear === todayY && i === todayM;
              const isSelected = viewYear === selY && i === selM;
              return (
                <button
                  type="button"
                  key={m}
                  onClick={() => pick(i)}
                  className={`[border-radius:var(--radius-md)] border-[1.5px] py-2 [font-size:var(--text-xs)] [font-weight:var(--fw-semibold)] transition-colors [transition-duration:var(--dur-fast)] ${
                    isSelected
                      ? "[border-color:var(--color-primary)] [background-color:var(--color-primary)] [color:var(--color-on-primary)]"
                      : isToday
                        ? "text-[color:var(--color-paper)] [border-color:var(--color-ink-800)] hover:[background-color:var(--color-ink-850)]"
                        : "border-transparent text-[color:var(--color-paper)] hover:[background-color:var(--color-ink-850)]"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t [padding-inline:var(--pad-control-x)] [padding-block:var(--pad-control-y)] text-xs [font-weight:var(--fw-semibold)] [border-color:var(--color-ink-800)]">
            {allowClear ? (
              <button
                type="button"
                className="text-[color:var(--color-paper-dim)] hover:underline"
                onClick={() => {
                  setValue("");
                  closePanel();
                }}
              >
                Clear
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="text-[color:var(--color-primary-deep)] hover:underline"
              onClick={() => {
                setViewYear(todayY);
                setValue(`${todayY}-${String(todayM + 1).padStart(2, "0")}`);
                closePanel();
              }}
            >
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

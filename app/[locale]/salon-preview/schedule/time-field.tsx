"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Our own time picker (Task 437) -- the native <input type="time"> is the
 * OS's own scrollable digit-wheel, which doesn't match this product's look.
 * A button that opens a scrollable list of quarter-hour slots, styled like
 * every other dropdown in this file (same card, same hover row, same black
 * selected state as the Client combobox's suggestion list).
 *
 * Positioned with position: fixed (computed from the button's own screen
 * rect) rather than absolute. This field lives inside the booking Sheet,
 * whose body scrolls (overflow-y-auto) -- an absolutely positioned popover
 * there gets silently clipped by that scroll container the moment it
 * extends past the modal's edge, which it does here since Time sits near
 * the bottom of a short form. Fixed positioning escapes that clipping.
 */

const SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 0) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

function formatLabel(hhmm: string): string {
  if (!hhmm || !hhmm.includes(":")) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function TimeField({
  label,
  value,
  onChange,
  fieldClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fieldClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: "center" });
  }, [open]);

  const openList = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        onClick={openList}
        className={fieldClassName + " flex items-center justify-between gap-2 text-left"}
      >
        <span className={value ? "" : "text-[#5e5e67]/70"}>{value ? formatLabel(value) : "Select time"}</span>
        <span className="material-symbols-outlined text-[16px] text-[#5e5e67] shrink-0">schedule</span>
      </button>
      {open && pos && (
        <div
          ref={listRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="max-h-56 overflow-y-auto rounded-lg border border-[#c8c5cb]/50 bg-[#ffffff] shadow-md z-[200]"
        >
          {SLOTS.map((t) => (
            <button
              key={t}
              type="button"
              data-selected={t === value}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={
                "w-full text-left px-3 py-1.5 text-[13px] border-b border-[#e8e8ec] last:border-b-0 " +
                (t === value ? "bg-[#000000] text-[#ffffff] font-medium hover:bg-[#1b1b1e]" : "text-[#1a1c1f] hover:bg-[#f3f3f7]")
              }
            >
              {formatLabel(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

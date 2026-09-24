"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The right-hand panel every salon page opens for "do something to this one
 * thing" (Task 415 / 416): a new appointment, a new client, editing a
 * profile, using a package session.
 *
 * Fresha, Mangomint and Vagaro all do this from the side rather than from a
 * centred pop-up, so the page underneath stays in view -- you can still see
 * the free stretch you are filling, or the folio you are editing. Kept in one
 * place so every panel has the same edges, the same close button and the same
 * Escape behaviour; the Schedule panels and the Clients panels both import
 * this instead of each drawing their own.
 */

export const LABEL = "text-[11.5px] leading-4 tracking-[0.06em] font-semibold uppercase text-[#5e5e67]";
export const FIELD =
  "h-9 w-full rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] px-3 text-[13.5px] text-[#1a1c1f] outline-none focus:border-[#000000] transition-colors placeholder:text-[#5e5e67]/70";

/** The database's own sentence, capitalised and ended -- shown as it is. */
export function sentence(msg: string) {
  const s = msg.trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".");
}

export function Sheet({
  label,
  title,
  subtitle,
  onClose,
  busy,
  footer,
  children,
}: {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  busy: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    // A very light scrim: clicking outside closes, but the page stays readable.
    <div className="fixed inset-0 z-[60] bg-black/10" onClick={() => !busy && onClose()}>
      <aside
        role="dialog"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-[#ffffff] border-l border-[#c8c5cb]/40 shadow-2xl flex flex-col"
      >
        <div className="px-5 py-4 border-b border-[#c8c5cb]/30 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[#1a1c1f] truncate">{title}</h2>
            {subtitle && <div className="text-[12px] text-[#5e5e67] mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label="Close panel"
            disabled={busy}
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg hover:bg-[#f3f3f7] text-[#5e5e67] hover:text-[#1a1c1f] flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">{children}</div>
        <div className="px-5 py-4 border-t border-[#c8c5cb]/30 bg-[#ffffff]">{footer}</div>
      </aside>
    </div>
  );
}

/** Cancel + one big primary action, the footer every form panel uses. */
export function PanelFooter({
  busy,
  onClose,
  onSubmit,
  submitLabel,
  busyLabel,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  busyLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onClose}
        className="h-10 px-4 rounded-lg border border-[#c8c5cb]/60 bg-[#ffffff] hover:bg-[#f3f3f7] text-[13.5px] font-medium transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        className="flex-1 h-10 rounded-lg bg-[#000000] hover:bg-neutral-800 text-[#ffffff] text-[13.5px] font-medium transition-colors disabled:opacity-50"
      >
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  );
}

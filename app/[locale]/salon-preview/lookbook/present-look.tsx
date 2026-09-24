"use client";

import { useEffect } from "react";
import type { LookCard } from "./types";

/**
 * "Present Look": one look, full screen, for showing a client across the chair
 * on the shop's tablet. Deliberately leaves the colour formula out -- the
 * client is being shown a result, and the formula is the shop's own craft.
 * Arrow keys (or the arrows) step through whatever the current filters show;
 * Escape closes.
 */
export function PresentLook({
  looks,
  index,
  onIndex,
  onClose,
}: {
  looks: LookCard[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const look = looks[index];
  const count = looks.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex((index + 1) % count);
      else if (e.key === "ArrowLeft") onIndex((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onIndex, onClose]);

  if (!look) return null;

  return (
    <div
      role="dialog"
      aria-label={`Presenting ${look.title}`}
      data-testid="lookbook-presenter"
      className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0d] text-white md:flex-row"
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        {look.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, expiring URL from a private bucket
          <img src={look.photoUrl} alt={look.title} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40">
            <span className="material-symbols-outlined text-[64px]">photo_camera</span>
            <span className="text-[13px]">No photo for this look yet</span>
          </div>
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous look"
              onClick={() => onIndex((index - 1 + count) % count)}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              type="button"
              aria-label="Next look"
              onClick={() => onIndex((index + 1) % count)}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-4 overflow-y-auto border-t border-white/10 p-6 md:w-[26rem] md:border-l md:border-t-0 md:p-8">
        <div className="flex items-center justify-between">
          <span className="text-[12px] tracking-wide text-white/50 tabular-nums">{index + 1} / {count}</span>
          <button
            type="button"
            aria-label="Close presentation"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {look.category && <span className="rounded bg-white px-2 py-0.5 text-[11.5px] font-medium text-black">{look.category}</span>}
          {look.level && <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[11.5px]">Level {look.level}</span>}
        </div>
        <h2 className="text-[26px] font-semibold leading-8 tracking-[-0.02em]">{look.title}</h2>
        {look.note && <p className="text-[14.5px] leading-6 text-white/70">{look.note}</p>}
        {look.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {look.tags.map((t) => <span key={t} className="rounded bg-white/10 px-2.5 py-1 text-[12.5px] text-white/85">{t}</span>)}
          </div>
        )}
        {look.stylistName && (
          <p className="mt-auto flex items-center gap-2 text-[13px] text-white/60">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: look.stylistColor }} />
            Done by {look.stylistName}
          </p>
        )}
      </div>
    </div>
  );
}

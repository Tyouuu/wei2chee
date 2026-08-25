"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * 桌面 / 手机 — the one control the founder named twice.
 *
 * 「这个是wix的 我觉得他有一点好用的点就是 这个编辑器的窗口很好看 还有就是可以
 * 切换 桌面跟电话」(2026-08-25), and again the next time the editor came up.
 *
 * ── WHY IT IS NOT PUCK'S OWN VIEWPORT SWITCHER ────────────────────────────
 *
 * Puck ships one, and it is unreachable here: it works by resizing the `srcdoc`
 * iframe it normally renders the canvas into, and this editor passes
 * `iframe={{ enabled: false }}` because the iframe is a second document with a
 * second CSSOM, which is where the `.ledger` / `.hearth` register scope classes
 * stopped reaching (task 5a). Trading correct register colours for a width
 * control would be a bad trade in a product whose registers are the thing being
 * sold.
 *
 * So the width is ours: a fixed 390px column in the middle of the canvas, which
 * is the width of the phone a Malaysian SME owner actually holds (an iPhone
 * 12–15 or a mid-range Android, both 390–393 CSS px).
 *
 * ── WHAT THIS HONESTLY SHOWS, AND WHAT IT DOES NOT ────────────────────────
 *
 * It shows the page at 390px. It does NOT simulate a 390px viewport, so any
 * layout keyed to the window rather than to its own container behaves as it
 * does on the desktop. That is a real gap and it is the system's, not this
 * control's: `SystemShell` draws its 228px rail at every width, so a customer
 * opening their system on a phone today sees a rail and a sliver. Showing that
 * truthfully is the point — a preview that quietly tidied it up would hide the
 * defect this control exists to find.
 */

export type CanvasDevice = "desktop" | "phone";

/** The width of the phone this previews. Not 375 (iPhone SE, shrinking share)
 *  and not 414 (the old Plus): 390 is the iPhone 12–15 and within 3px of the
 *  mid-range Androids that dominate Malaysia. */
export const PHONE_WIDTH = 390;

const DeviceContext = createContext<{
  device: CanvasDevice;
  setDevice: (d: CanvasDevice) => void;
}>({ device: "desktop", setDevice: () => {} });

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<CanvasDevice>("desktop");
  return (
    <DeviceContext.Provider value={{ device, setDevice }}>{children}</DeviceContext.Provider>
  );
}

export function useCanvasDevice() {
  return useContext(DeviceContext);
}

/**
 * Two icons in one pill, in the top bar beside 预览.
 *
 * Icons rather than the words 桌面 / 手机: this bar already carries five text
 * controls and a sixth would push the save state off a 1280px window. A monitor
 * and a phone are the two glyphs in this whole product that need no label —
 * every editor the owner has ever seen uses them, and both carry a `title` and
 * an accessible name for the case where that is not true.
 */
export function DeviceToggle({
  desktopLabel,
  phoneLabel,
}: {
  desktopLabel: string;
  phoneLabel: string;
}) {
  const { device, setDevice } = useCanvasDevice();

  const item = (active: boolean) =>
    `grid h-6 w-7 place-items-center rounded-[5px] transition-colors [transition-duration:var(--dur-fast)] ${
      active
        ? "[background-color:var(--color-ink-800)] [color:var(--color-paper)]"
        : "[color:var(--color-paper-dim)] hover:[color:var(--color-paper)]"
    }`;

  return (
    <div
      role="group"
      aria-label={`${desktopLabel} / ${phoneLabel}`}
      className="flex items-center gap-0.5 rounded-md p-0.5 [background-color:var(--color-ink-850)]"
    >
      <button
        type="button"
        onClick={() => setDevice("desktop")}
        aria-pressed={device === "desktop"}
        title={desktopLabel}
        className={item(device === "desktop")}
      >
        <span className="sr-only">{desktopLabel}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="1.5"
            y="2.5"
            width="13"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M6 14h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setDevice("phone")}
        aria-pressed={device === "phone"}
        title={phoneLabel}
        className={item(device === "phone")}
      >
        <span className="sr-only">{phoneLabel}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="4.5"
            y="1.5"
            width="7"
            height="13"
            rx="1.8"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M7 12.6h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * THE WINDOW.
 *
 * 「这个编辑器的窗口很好看」 — the founder on Wix, and he read it right: Wix
 * presents the canvas as an OBJECT sitting on a surface, and both Durable and
 * this editor presented it as the background with a scrollbar down the side.
 * A page you are looking at reads differently from a page you are inside, and
 * the difference is a frame.
 *
 * Two states, one shape. On desktop the canvas fills its plinth and gains a
 * title strip that names what it is and how wide. On phone it becomes a 390px
 * slab standing in the middle of the plinth, and the strip says so — so the
 * customer can always tell which of the two they are looking at without
 * measuring, which is the failure mode of every device preview that only
 * changes the width.
 */
export function CanvasFrame({
  label,
  children,
}: {
  /** What the strip says on the left — the page's own name. */
  label: string;
  children: ReactNode;
}) {
  const { device } = useCanvasDevice();
  const phone = device === "phone";

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* The strip is Formae's, not the customer's: it names the window rather
          than being part of the page inside it. Kept to 26px so it reads as an
          edge and not as a second toolbar — the whole argument of this editor
          is that only one bar is docked. */}
      <div className="flex h-[26px] shrink-0 items-center gap-2 [padding-inline:10px] [background-color:var(--color-ink-900)] [border-bottom:1px_solid_var(--color-ink-800)]">
        <span className="flex gap-1" aria-hidden>
          <span className="h-[7px] w-[7px] rounded-full [background-color:var(--color-ink-700)]" />
          <span className="h-[7px] w-[7px] rounded-full [background-color:var(--color-ink-700)]" />
          <span className="h-[7px] w-[7px] rounded-full [background-color:var(--color-ink-700)]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-center [color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
          {label}
        </span>
        <span className="tnum shrink-0 [color:var(--color-paper-dim)] [font-size:var(--text-micro)]">
          {phone ? `${PHONE_WIDTH}px` : ""}
        </span>
      </div>

      {phone ? (
        // `overflow-y-auto` on the surround and `min-h-full` on the slab: a
        // phone page is taller than the window it is being previewed in, and
        // scrolling the surround keeps the slab's own edges visible the whole
        // way down. Scrolling the slab instead would clip its rounded corner
        // against a scrollbar.
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto [background-color:var(--color-ink-950)] [padding-block:18px]">
          <div
            style={{ width: PHONE_WIDTH }}
            className="h-fit min-h-full shrink-0 overflow-hidden [border:6px_solid_var(--color-ink-800)] [border-radius:26px] [box-shadow:var(--shadow-raised)]"
          >
            {children}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">{children}</div>
      )}
    </div>
  );
}

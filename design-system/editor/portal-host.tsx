"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * WHERE A DIALOG OR A DRAWER SHOULD LAND WHEN IT IS ONLY A PICTURE OF ITSELF.
 *
 * ── THE BUG THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * The 版段库 front door mounts several shelves at once, and three of the 216
 * sections are an OPEN dialog or drawer — a command palette, a notifications
 * panel, a confirm box. Radix renders those through a portal onto
 * `document.body` with `position: fixed; inset: 0`, which no `overflow: hidden`
 * on the tile can contain. Screenshotted at 1440: the gallery was a notification
 * drawer down the right-hand side, a command palette across the middle, and a
 * black scrim over everything else. The library was unusable and had been for
 * as long as those sections have existed — the old front door simply opened on
 * a shelf that did not contain one.
 *
 * `transform: scale()` on the Specimen does create a containing block for fixed
 * descendants, which is why this is not already contained; a PORTALLED node is
 * not a descendant at all. It is a child of `<body>`. There is nothing to
 * contain.
 *
 * ── THE FIX ──────────────────────────────────────────────────────────────
 *
 * Radix's Portal takes a `container`. Every dialog and sheet in this repo goes
 * through our own wrappers in components/ui/, so the wrappers can read a
 * container out of context and the primitives keep their default (`body`)
 * everywhere else. A gallery tile provides one; the real editor and the real
 * pages provide none and behave exactly as before.
 *
 * WHY NOT AN IFRAME, which is what a live-preview site would reach for: the
 * specimen has to inherit the register's CSS custom properties from its
 * ancestors, and an iframe is a separate document. Every register token would
 * have to be serialised across the boundary — for a problem that is three
 * sections wide.
 */
const PortalHostContext = createContext<HTMLElement | null>(null);

/** The container a portalled overlay should render into, or null for `body`. */
export function usePortalHost() {
  return useContext(PortalHostContext);
}

/**
 * Catches portalled overlays rendered by anything inside it.
 *
 * The host is a positioned, clipping box laid over the children, so an overlay
 * that asks for `fixed; inset: 0` fills THIS box instead of the viewport —
 * `position: fixed` resolves against the nearest ancestor with a transform, and
 * the host carries one for exactly that reason.
 */
export function PortalBoundary({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  // State rather than a ref: the context value has to change once the node
  // exists, and a ref mutation does not re-render the consumers.
  const [host, setHost] = useState<HTMLElement | null>(null);

  return (
    <PortalHostContext.Provider value={host}>
      <div className={`relative isolate ${className}`}>
        {children}
        <div
          ref={setHost}
          // `translate-x-0` is a transform, and a transform is what makes this
          // the containing block for the `position: fixed` overlay that lands
          // inside it. Without it the overlay would still find the viewport.
          className="pointer-events-none absolute inset-0 translate-x-0 overflow-hidden"
        />
      </div>
    </PortalHostContext.Provider>
  );
}

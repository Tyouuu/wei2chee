"use client"

import { createContext, type ReactNode } from "react"

/**
 * WHERE THE NAVIGATION SITS, published from SystemShell to whatever the
 * customer dropped into its sidebar slot.
 *
 * WHY A CONTEXT AND NOT A SECOND FIELD ON THE RAIL. The first version of this
 * made it two controls -- `SystemShell.nav="top"` AND `RailNav.variant="topbar"`
 * -- and a customer who set one without the other got a horizontal bar inside a
 * flex ROW, which squeezed the whole page into a 20px vertical sliver. Caught in
 * a browser screenshot. It is exactly the kind of trap a system designer must
 * not contain: two controls that are only correct when they agree, with nothing
 * on either one to say so.
 *
 * So the axis is ONE choice, made on the component that actually has to become
 * a column instead of a row, and read by the rail. The rail's own `variant` is
 * then orthogonal -- how dense the navigation is -- which multiplies rather
 * than conflicts: three densities x two axes x two grounds, from three
 * independent choices.
 *
 * WHY ITS OWN FILE. `system-shell.tsx` is a server component, and
 * `createContext` is not available in one. Splitting the two lines out keeps
 * the shell on the server (it is rendered there, through puck-config, by every
 * auth page) while the provider is its own small client boundary.
 */
export const NavAxisContext = createContext<"side" | "top">("side")

export function NavAxisProvider({
  value,
  children,
}: {
  value: "side" | "top"
  children: ReactNode
}) {
  return <NavAxisContext.Provider value={value}>{children}</NavAxisContext.Provider>
}

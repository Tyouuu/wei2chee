import { notFound } from "next/navigation";

/**
 * Catches every URL under a locale that matches no real route, so it reaches
 * `app/[locale]/not-found.tsx` instead of Next's built-in error page.
 *
 * WHY THIS FILE IS NEEDED AT ALL. `not-found.tsx` only renders for a
 * `notFound()` thrown INSIDE its own segment. A URL that matches no route never
 * enters the `[locale]` segment, so Next falls back to its own default — which
 * is what a browser check found: /zh/anything showed the unstyled black-on-white
 * "404 | This page could not be found" in English. A catch-all that immediately
 * calls notFound() puts those URLs inside the segment, where the real page is.
 *
 * Static and dynamic segments both take priority over a catch-all in Next's
 * matcher, so /zh/login, /zh/portal/quotations and everything else still resolve
 * to their own routes. This only ever runs when nothing else matched.
 */
export default function CatchAll() {
  notFound();
}
